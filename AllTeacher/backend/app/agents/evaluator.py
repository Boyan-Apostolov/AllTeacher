"""Evaluator agent.

Given an exercise (its content_json) and the user's submission, score it
and produce feedback in the user's native_language.

Stateless. Returns a structured verdict + feedback the Tracker / Adapter
can later use to re-plan.

Output shape:
{
  "score":      0.0..1.0,
  "verdict":    "correct" | "partial" | "incorrect" | "reviewed",
  "feedback":   "...",        # in native_language
  "weak_areas": ["..."],      # short tags, in native_language
  "strengths":  ["..."],      # short tags the user nailed, in native_language
  "next_focus": "..."         # one-sentence pointer in native_language
}

Scoring rules (the model is told these in the prompt):
- multiple_choice: exact match → 1.0 + verdict=correct, else 0.0 + incorrect
- flashcard: trust the user's self_rating
    easy   → 1.0 + reviewed
    medium → 0.6 + reviewed
    hard   → 0.2 + reviewed
- short_answer: substring / semantic match against `expected`. Partial
  credit allowed. Use `rubric` if present.
- essay_prompt: rubric-based, 0..1, partial allowed. Verdict=partial unless
  the response either fully meets the rubric (correct) or is way off / blank
  (incorrect).
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config


# --- types ---

class EvaluatorInput(TypedDict, total=False):
    native_language: str
    target_language: str | None
    domain: str
    level: str
    feedback_preference: str | None    # if known from notes
    exercise: dict[str, Any]           # the content_json blob
    submission: dict[str, Any]         # what the user sent in


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Evaluator. Score one exercise submission.

Language: write `feedback`, `weak_areas` entries, `strengths` entries, and `next_focus` in `native_language`, in its native script. `verdict` stays as a lowercase English machine identifier.

Scoring by type:
- multiple_choice: submission.choice_index == exercise.correct_index → score=1.0 verdict="correct"; else 0.0 "incorrect". Briefly explain why in feedback.
- flashcard: trust submission.self_rating. easy→1.0, medium→0.6, hard→0.2; verdict="reviewed". Give one memory hook in feedback.
- short_answer: compare submission.text to exercise.expected, lenient on case/whitespace/punctuation/synonyms. Meaning-equivalent → 1.0 "correct". Right idea, wrong detail → 0.4–0.8 "partial". Wrong/empty → 0.0 "incorrect". Use rubric if present.
- essay_prompt: average rubric coverage to one decimal. ≥0.85 "correct", 0.30–0.85 "partial", <0.30 "incorrect". Call out hit/missed rubric points.

Feedback: warm, specific, actionable. 1–3 sentences for short types; 2–5 for essay. Honor `feedback_preference` if provided (gentle / direct / detailed / minimal).

`weak_areas`: 0–3 short tags in native_language; empty if the answer was correct/easy. `strengths`: 0–3 short tags in native_language naming what the user clearly has down (only when score≥0.8 or the answer shows real mastery — empty otherwise). `next_focus`: one short native_language sentence pointing at what to drill next; empty string is fine when score=1.0.\
"""


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "number", "minimum": 0, "maximum": 1},
        "verdict": {
            "type": "string",
            "enum": ["correct", "partial", "incorrect", "reviewed"],
        },
        "feedback": {"type": "string"},
        "weak_areas": {
            "type": "array",
            "items": {"type": "string"},
        },
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
        },
        "next_focus": {"type": "string"},
    },
    "required": [
        "score",
        "verdict",
        "feedback",
        "weak_areas",
        "strengths",
        "next_focus",
    ],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def evaluate(payload: EvaluatorInput) -> dict[str, Any]:
    """Score a single exercise submission. Returns the parsed Evaluator
    response (dict with
    score/verdict/feedback/weak_areas/strengths/next_focus)."""
    client = _client()

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "evaluator_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.3,
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
