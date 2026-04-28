"""Assessor agent.

Runs an adaptive multiple-choice quiz against the user's goal to detect:
  - level                  (beginner / intermediate / advanced)
  - learning_style         (visual / reading / practice / conversation / mixed)
  - time_budget_mins_per_week
  - domain                 (language / code / music / academic / creative / fitness / professional)
  - target_language        (if domain == language, otherwise null)

All output is emitted in the user's native_language.

The agent is stateless on this side — state lives in `curricula.assessment_json.transcript`.
Each call receives the full transcript and returns EITHER the next question OR
the final structured summary.

OpenAI structured outputs force the exact shape of the response, so parsing
can't drift.
"""
from __future__ import annotations

import json
from typing import Any, Literal, TypedDict

from openai import OpenAI

from config import Config
from app.services import usage_meter


# --- types ---

class TranscriptEntry(TypedDict, total=False):
    question: str
    options: list[str]
    answer: str | None


class AssessorResult(TypedDict, total=False):
    kind: Literal["question", "complete"]
    question: dict[str, Any] | None       # {"text": "...", "options": [...]}
    summary: dict[str, Any] | None        # {"level": ..., "learning_style": ..., ...}


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Assessor. Each call: ask the next MCQ or finish with a summary.

Language: write every question text and option in `native_language` (BCP-47), in its native script — even when `goal` is in another language. Proper nouns may stay original. `summary.notes` is also in native_language. Enum values (domain, level, learning_style) stay lowercase English.

Ask 8–10 questions (min 7, max 12). One question per call, 3–5 options. Don't repeat questions in the transcript. Each question should narrow what you don't yet know.

Cover before finishing: domain (language/code/music/academic/creative/fitness/professional); for language-domain, target_language; current level + prior experience; daily time budget (<10 / 10–20 / 20–45 / 45+ min, store midpoint in time_budget_mins_per_day); learning_style (visual/reading/practice/conversation/mixed); motivation; deadline or open-ended; preferred exercise format; feedback preference.

Return kind="complete" only once every required topic has at least one answer. Put loose details in `summary.notes` (native_language).\
"""


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["question", "complete"]},
        "question": {
            "type": ["object", "null"],
            "properties": {
                "text": {"type": "string"},
                "options": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 2,
                    "maxItems": 5,
                },
            },
            "required": ["text", "options"],
            "additionalProperties": False,
        },
        "summary": {
            "type": ["object", "null"],
            "properties": {
                "domain": {
                    "type": "string",
                    "enum": [
                        "language", "code", "music", "academic",
                        "creative", "fitness", "professional",
                    ],
                },
                "level": {"type": "string", "enum": ["beginner", "intermediate", "advanced"]},
                "learning_style": {
                    "type": "string",
                    "enum": ["visual", "reading", "practice", "conversation", "mixed"],
                },
                "time_budget_mins_per_day": {"type": "integer"},
                "target_language": {"type": ["string", "null"]},
                "notes": {"type": "string"},
            },
            "required": [
                "domain", "level", "learning_style",
                "time_budget_mins_per_day", "target_language", "notes",
            ],
            "additionalProperties": False,
        },
    },
    "required": ["kind", "question", "summary"],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def step(
    *,
    goal: str,
    native_language: str,
    transcript: list[TranscriptEntry],
) -> AssessorResult:
    """Call the Assessor once.

    Returns either a next question or a final summary. The caller is responsible
    for persisting the transcript and summary.
    """
    client = _client()

    # Compact transcript view for the model.
    transcript_view = [
        {
            "question": t.get("question"),
            "options": t.get("options"),
            "answer": t.get("answer"),
        }
        for t in transcript
    ]

    # native_language goes first AND is repeated in an explicit directive so
    # the model can't forget it even when the goal is written in English.
    user_payload = {
        "native_language": native_language,
        "goal": goal,
        "transcript": transcript_view,
    }

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "assessor_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.4,
    )

    usage_meter.record(
        model=Config.OPENAI_MODEL,
        usage=completion.usage,
        agent="assessor",
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
