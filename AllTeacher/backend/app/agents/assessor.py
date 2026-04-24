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
You are the Assessor for AllTeacher, a personalized learning app.

Your job: given the user's learning goal and the conversation so far, decide
either (a) what multiple-choice question to ask next, or (b) that you have
enough signal to produce a final assessment.

============================================================
LANGUAGE RULE — THIS IS THE MOST IMPORTANT RULE
============================================================
The user's `native_language` is a BCP-47 language code (e.g. "en", "bg",
"es", "fr", "de", "it", "pt", "ja", "zh", "ar", "hi", "tr", "pl", "nl",
"sv", "ro", "uk", "ko"…).

EVERY question text and EVERY option string MUST be written in that
language, using that language's native script. No exceptions.

This rule OVERRIDES the language of the user's `goal`. Even if the goal is
written in English, if native_language is "bg" then write in Bulgarian
(Cyrillic). If native_language is "ja" write in Japanese. If "ar" write in
Arabic. Do NOT mirror the goal's language — mirror native_language.

The only things that may stay in the original language are proper nouns
inside an option (e.g. "Python", "JavaScript", the name of a target
language like "Spanish" / "Español") when there is no standard native
equivalent.

The `summary.notes` field, if written, MUST also be in native_language.
The enum values (domain, level, learning_style) stay in English — those
are machine identifiers and are never shown to the user as-is.

============================================================
GENERAL RULES
============================================================
- Aim for 8-10 questions. Hard max 12. Do NOT stop before 7 questions
  unless you already have strong, specific signal on every required topic
  below.
- Ask ONE question at a time with 3-5 concise options.
- Adapt: each question should narrow down what you don't yet know.
- Topics to cover before finishing (all required unless marked optional):
  1. Domain (language / code / music / academic / creative / fitness / professional)
  2. For domain=language: which target language
  3. Current level (beginner / intermediate / advanced), with
     domain-appropriate signals. Ask about prior experience / what the
     user has already tried.
  4. Time budget PER DAY (pick one: <10 / 10-20 / 20-45 / 45+ minutes).
     This is daily, NOT weekly. Store the midpoint (or chosen minutes) in
     `time_budget_mins_per_day`.
  5. Primary learning style (visual / reading / practice / conversation / mixed)
  6. Motivation / why — what outcome does the user want? (hobby, job,
     exam, travel, a specific project, etc.)
  7. Deadline or urgency — is there a target date, or is this open-ended?
  8. Preferred exercise format (short drills / longer project work /
     quizzes / reading + reflection / live-style conversation / mix)
  9. Feedback preference (gentle & encouraging / direct & blunt /
     detailed explanations / minimal, just tell me what was wrong)
- Cover each topic with at least one question before returning "complete".
- DO NOT repeat a question already in the transcript.
- When you have enough info, return kind="complete" with the full summary.
  Put anything useful that doesn't fit a structured field into `notes`
  (written in native_language).

Output schema is enforced. Stick to it.\
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
    reminder = (
        f"Reminder: native_language='{native_language}'. "
        f"Write every question text and every option in that language, "
        f"in its native script. Do NOT write them in the language of the goal."
    )

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": reminder},
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

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
