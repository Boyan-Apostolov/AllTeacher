"""Curriculum Planner agent.

Takes the Assessor's structured summary and produces a complete week-by-week
plan tailored to the user's domain, level, daily time budget, learning style,
motivation, and preferences.

Output shape:
{
  "title": "...",                       # in native_language
  "summary_for_user": "...",            # in native_language, 1-2 paragraphs
  "total_weeks": 10,
  "phases": [
    {"name": "...", "description": "...", "week_numbers": [1, 2, 3]},
    ...
  ],
  "weeks": [
    {
      "week_number": 1,
      "title": "...",
      "objective": "...",               # what the user will be able to DO
      "modules": [
        {"title": "...", "kind": "...", "description": "..."},
        ...
      ],
      "milestone": "...",
      "daily_minutes": 20,
      "exercise_focus": ["...", "..."]
    },
    ...
  ]
}

Domain-aware: the prompt instructs the model to pick `module.kind` from a
domain-appropriate vocabulary. We don't enum-restrict it server-side because
domains have very different surface vocabularies — flexibility wins here.
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config


# --- types ---

class PlannerInput(TypedDict, total=False):
    goal: str
    native_language: str
    domain: str
    level: str
    learning_style: str
    time_budget_mins_per_day: int
    target_language: str | None
    notes: str


# --- prompt ---

SYSTEM_PROMPT = """\
You are the Curriculum Planner for AllTeacher, a personalized learning app.

You receive an Assessor summary describing the user's goal, domain, level,
daily time budget, learning style, motivation, deadline, and preferences.
Your job: produce a complete week-by-week curriculum that the user could
realistically follow.

============================================================
LANGUAGE RULE
============================================================
The user's `native_language` is a BCP-47 code (e.g. "en", "bg", "es", "ja").

EVERY field shown to the user — `title`, `summary_for_user`, every phase
`name`/`description`, every week `title`/`objective`/`milestone`, every
module `title`/`description`, every entry in `exercise_focus` — MUST be
written in `native_language`, in its native script.

Exceptions: proper nouns (programming language names, library names, song
titles, the name of a target language like "Spanish"/"Español") may stay
in their original form when no native translation is standard.

The enum-like field `kind` on each module is a short machine identifier
in lowercase English (see below). Don't translate it.

============================================================
LENGTH AND PACING
============================================================
- Default to 8-12 weeks. Use the user's deadline (if present in `notes`)
  to pick a length. If the user signaled a tight deadline, compress; if
  open-ended and serious, lean toward 12.
- `daily_minutes` per week MUST equal (or stay close to) the user's
  `time_budget_mins_per_day`. You may vary slightly week-to-week (e.g.
  a heavier project week) but never blow past the budget by more than
  ~25%.
- Each week needs 3-6 modules. A "module" is a chunk of work the user
  can complete in roughly 1-3 sessions.

============================================================
DOMAIN-AWARE MODULES
============================================================
Pick `module.kind` from the vocabulary appropriate to the domain:

- domain=language:    vocabulary, grammar, listening, reading, speaking,
                      writing, pronunciation, culture, review
- domain=code:        concept, syntax, exercise, project, debugging,
                      reading_code, refactor, review
- domain=music:       technique, theory, ear_training, repertoire,
                      sight_reading, improvisation, performance, review
- domain=academic:    concept, reading, problem_set, derivation,
                      essay, lab, review
- domain=creative:    technique, study, exercise, project, critique,
                      review
- domain=fitness:     technique, drill, conditioning, mobility,
                      assessment, recovery
- domain=professional: concept, case_study, exercise, project,
                       reflection, review

If the user's domain doesn't match perfectly, pick the closest column
and use sensible kinds.

============================================================
PHASES
============================================================
Group weeks into 2-4 named phases (e.g. "Foundations", "Practice",
"Application", "Mastery"). Phase names must be in native_language.
Phase `week_numbers` together must cover [1..total_weeks] exactly once.

============================================================
PERSONALIZATION
============================================================
- Adapt to `learning_style`: visual → more diagrams/videos, reading →
  more articles/books, practice → more drills, conversation → more
  speaking/discussion, mixed → balanced.
- Honor `motivation` / `notes`: if the user wants to learn for a trip,
  weight conversation + survival vocab. If for a job interview, weight
  the topics asked at interviews. If for an exam, structure around
  the exam's syllabus.
- Honor `feedback_preference` if mentioned in notes — but that's the
  Evaluator's concern more than yours; only mention it if relevant
  in `summary_for_user`.

Output schema is enforced. Stick to it. Be concrete and specific —
NO filler weeks, NO vague modules, every module must be something
the user could plausibly start tomorrow.\
"""


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary_for_user": {"type": "string"},
        "total_weeks": {"type": "integer", "minimum": 1, "maximum": 26},
        "phases": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "week_numbers": {
                        "type": "array",
                        "items": {"type": "integer", "minimum": 1},
                        "minItems": 1,
                    },
                },
                "required": ["name", "description", "week_numbers"],
                "additionalProperties": False,
            },
        },
        "weeks": {
            "type": "array",
            "minItems": 1,
            "maxItems": 26,
            "items": {
                "type": "object",
                "properties": {
                    "week_number": {"type": "integer", "minimum": 1},
                    "title": {"type": "string"},
                    "objective": {"type": "string"},
                    "modules": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 8,
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "kind": {"type": "string"},
                                "description": {"type": "string"},
                            },
                            "required": ["title", "kind", "description"],
                            "additionalProperties": False,
                        },
                    },
                    "milestone": {"type": "string"},
                    "daily_minutes": {"type": "integer", "minimum": 1},
                    "exercise_focus": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "week_number", "title", "objective", "modules",
                    "milestone", "daily_minutes", "exercise_focus",
                ],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "summary_for_user", "total_weeks", "phases", "weeks"],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def plan(payload: PlannerInput) -> dict[str, Any]:
    """Run the Planner once. Returns the parsed structured output."""
    client = _client()
    native_language = payload.get("native_language") or "en"

    reminder = (
        f"Reminder: native_language='{native_language}'. "
        f"Write every user-facing string in that language, in its native "
        f"script. Module 'kind' values are machine identifiers and stay "
        f"in lowercase English."
    )

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": reminder},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "planner_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.5,
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
