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
  "gap":        "...",        # in native_language — explains *why* this
                              #   specific submission missed the goal;
                              #   empty for fully correct/easy answers
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
  credit allowed. Use `rubric` if present. (Replaces the deprecated
  essay_prompt type — long-form writing prompts are now also short_answer
  with a longer rubric and expected text.)
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
    # Existing weak-area tags on this curriculum, in native_language. The
    # evaluator should REUSE these verbatim when the same theme applies
    # rather than coining new variants like
    # "time management" / "time management strategies" / "gestión del tiempo"
    # — keeps the FinishedView "To revisit" list canonical.
    existing_weak_areas: list[str]
    existing_strengths: list[str]


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Evaluator. Score one exercise submission.

LANGUAGE RULE — read carefully. EVERY user-facing text field — `feedback`, `gap`, every entry in `weak_areas`, every entry in `strengths`, and `next_focus` — MUST be written in `native_language`, in its native script. ALL of them. No exceptions. The exercise content itself may be in a different language (the target_language or English); ignore that. The user reads in `native_language`, full stop. `verdict` is the only field that stays a lowercase English machine identifier.

Mixing languages inside a single response — even one tag in a different language — is a bug. If you wrote `feedback` in English while the input said native_language is Hindi, you broke the rule. If you wrote one weak_areas tag in Spanish while another is in Hindi in the same response, you broke the rule. Re-read your output before returning and confirm every text field is in the requested native_language script.

CANONICAL TAGS — if `existing_weak_areas` or `existing_strengths` are provided, REUSE them verbatim (exact same string, same script) when a tag in your output would name the same theme. Do not coin near-variants like "time management" vs "time management strategies" vs "gestión del tiempo" — pick the existing one. Only introduce a new tag when the theme is genuinely new.

Scoring by type:
- multiple_choice: submission.choice_index == exercise.correct_index → score=1.0 verdict="correct"; else 0.0 "incorrect". Briefly explain why in feedback.
- flashcard: trust submission.self_rating. easy→1.0, medium→0.6, hard→0.2; verdict="reviewed". Give one memory hook in feedback.
- short_answer: compare submission.text to exercise.expected, lenient on case/whitespace/punctuation/synonyms. Meaning-equivalent → 1.0 "correct". Right idea, wrong detail → 0.4–0.8 "partial". Wrong/empty → 0.0 "incorrect". Use rubric if present (longer prompts may use rubric+expected_length to set scope).

Feedback: warm, specific, actionable. 1–3 sentences for short answers, 2–4 for longer responses. Honor `feedback_preference` if provided (gentle / direct / detailed / minimal).

`gap`: 1–2 sentences in native_language naming the SPECIFIC gap between the user's submission and the exercise's goal — what their answer was missing or got wrong relative to the expected/rubric. NOT a restatement of the prompt or the criteria. NOT a generic "you should study X". Cite something the user actually wrote (or didn't write) when possible. Empty string when verdict="correct" or score≥0.9 — don't manufacture a gap if there isn't one. For "reviewed" flashcards: empty unless they self-rated hard, in which case point at the friction.

`weak_areas`: 0–3 short tags (1–3 words each) in native_language; empty if the answer was correct/easy. `strengths`: 0–3 short tags in native_language naming what the user clearly has down (only when score≥0.8 or the answer shows real mastery — empty otherwise). `next_focus`: one short native_language sentence pointing at what to drill next; empty string is fine when score=1.0.\
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
        "gap": {"type": "string"},
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
        "gap",
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
        temperature=0.1,
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
