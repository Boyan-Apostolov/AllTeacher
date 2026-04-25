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
You are AllTeacher's Curriculum Planner. Turn the Assessor summary into a complete week-by-week plan.

Language: every user-facing string (title, summary_for_user, phase name/description, week title/objective/milestone, module title/description, exercise_focus entries) is in `native_language`, in its native script. Proper nouns may stay original. Module `kind` values are machine identifiers — keep lowercase English.

Length: 8–12 weeks. Compress for tight deadlines, lean to 12 if open-ended. 3–6 modules per week. `daily_minutes` close to the user's `time_budget_mins_per_day` (within ~25%). Group weeks into 2–4 named phases whose `week_numbers` together cover [1..total_weeks] exactly once.

Module `kind` vocabulary by domain (pick the closest column if domain doesn't match exactly):
- language: vocabulary, grammar, listening, reading, speaking, writing, pronunciation, culture, review
- code: concept, syntax, exercise, project, debugging, reading_code, refactor, review
- music: technique, theory, ear_training, repertoire, sight_reading, improvisation, performance, review
- academic: concept, reading, problem_set, derivation, essay, lab, review
- creative: technique, study, exercise, project, critique, review
- fitness: technique, drill, conditioning, mobility, assessment, recovery
- professional: concept, case_study, exercise, project, reflection, review

Personalize to `learning_style` and to motivation/notes (trip → conversation + survival vocab, interview → interview topics, exam → syllabus). Be concrete — no filler weeks, no vague modules; every module must be something the user could plausibly start tomorrow.\
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

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
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
