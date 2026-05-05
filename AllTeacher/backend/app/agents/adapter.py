"""Curriculum Adapter agent.

Runs after a session completes and the orchestrator wants the plan to react
to the user's progress. Takes:

  - the original Planner overview (title, summary, phases)
  - every week — completed AND upcoming — with status + per-week stats
  - accumulated weak_areas and strengths (recent + lifetime top tags)
  - the original goal + assessment summary, so context is preserved

…and returns a rewrite of the *upcoming* weeks plus optional *bonus* weeks
that target stubborn weak areas. Completed weeks are never touched —
they're context, not output.

Output shape:
{
  "upcoming_weeks": [
    {
      "week_number": int,           # MUST be > current_week (preserved)
      "title": "...",               # native_language
      "objective": "...",
      "modules": [{"title", "kind", "description"}, ...],
      "milestone": "...",
      "daily_minutes": int,
      "exercise_focus": ["...", ...],
      "is_bonus": false             # the model can flag bonus weeks here
    },
    ...
  ],
  "summary_note": "..."             # native_language, 1-2 sentences explaining
                                    # what changed and why
}

The orchestrator then deletes the upcoming weeks (keeping completed ones
verbatim), inserts the new plan, and bumps replan_count. Bonus weeks land
with curriculum_weeks.is_bonus = true so the UI can flag them.
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config
from app.services import usage_meter


# --- types ---

class AdapterInput(TypedDict, total=False):
    goal: str
    native_language: str
    domain: str
    level: str
    learning_style: str
    target_language: str | None
    time_budget_mins_per_day: int
    notes: str

    plan_title: str
    plan_summary_for_user: str
    phases: list[dict[str, Any]]

    current_week: int                       # last completed week's number
    total_weeks: int                        # current planned length
    completed_weeks: list[dict[str, Any]]   # week_number, title, avg_score, status
    upcoming_weeks: list[dict[str, Any]]    # week_number, title, objective, modules

    recent_weak_areas: list[str]
    recent_strengths: list[str]
    top_weak_areas: list[dict[str, Any]]    # [{tag, count}, ...]
    top_strengths: list[dict[str, Any]]


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Curriculum Adapter. The user has finished one or more sessions; the original Planner arc may no longer match what they actually need. Rewrite ONLY the upcoming weeks (week_number > current_week) and, optionally, append a small number of bonus weeks for stubborn weak areas.

Hard rules:
- Never change or output completed weeks — they are context only.
- Keep `week_number` strictly increasing and contiguous starting at current_week + 1. If you append bonus weeks, give them the next free week_numbers (no gaps).
- `total_weeks` after your rewrite should stay close to the original (within ±2). Add at most 2 bonus weeks per run.
- All user-facing strings (title, objective, milestone, module title/description, exercise_focus entries) in `native_language`, in its native script. `kind` values stay machine-identifier lowercase English.
- Respect the user's time budget — `daily_minutes` close to `time_budget_mins_per_day` (within ~25%).
- The plan as a whole still has to reach the user's `goal`. Don't drop late-stage skills just to drill weak areas — fold remediation INTO upcoming weeks where possible, and only use bonus weeks for things that genuinely need more reps.

Module `kind` vocabulary by domain (use the closest column):
- language: vocabulary, grammar, listening, reading, speaking, writing, pronunciation, culture, review
- code: concept, syntax, exercise, project, debugging, reading_code, refactor, review
- music: technique, theory, ear_training, repertoire, sight_reading, improvisation, performance, review
- academic: concept, reading, problem_set, derivation, essay, lab, review
- creative: technique, study, exercise, project, critique, review
- fitness: technique, drill, conditioning, mobility, assessment, recovery
- professional: concept, case_study, exercise, project, reflection, review

Strategy:
1. Read completed_weeks for what the user has actually demonstrated (avg_score, status). High avg_score on a topic → don't re-cover the same ground; lean into the next stage.
2. Use top_weak_areas + recent_weak_areas to choose what to reinforce. If a single weak_area keeps showing up across multiple weeks, mark a bonus week dedicated to it (`is_bonus: true`).
3. Use top_strengths + recent_strengths to figure out what to compress or skip — don't bore the user re-covering nailed material.
4. Keep the original phase structure if it still makes sense; rebalance pacing if needed.

`summary_note` (1-2 short native_language sentences) explains what changed and why, addressing the user directly.\
"""


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "upcoming_weeks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "week_number": {"type": "integer", "minimum": 1},
                    "title": {"type": "string"},
                    "objective": {"type": "string"},
                    "modules": {
                        "type": "array",
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
                    "daily_minutes": {"type": "integer", "minimum": 5},
                    "exercise_focus": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "is_bonus": {"type": "boolean"},
                },
                "required": [
                    "week_number",
                    "title",
                    "objective",
                    "modules",
                    "milestone",
                    "daily_minutes",
                    "exercise_focus",
                    "is_bonus",
                ],
                "additionalProperties": False,
            },
        },
        "summary_note": {"type": "string"},
    },
    "required": ["upcoming_weeks", "summary_note"],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def adapt(payload: AdapterInput, *, difficulty_boost: bool = False) -> dict[str, Any]:
    """Re-plan upcoming weeks. Returns the parsed Adapter response — see
    module docstring for the shape.

    When `difficulty_boost` is True (user tapped "Make it harder"), an
    extra instruction is injected into the user message asking the model to
    raise the difficulty ceiling — harder vocabulary, more complex sentences
    or problems, longer exercises — without skipping topics or shrinking the
    plan.
    """
    client = _client()

    user_content = json.dumps(payload, ensure_ascii=False)
    if difficulty_boost:
        user_content += (
            "\n\n[DIFFICULTY BOOST REQUESTED] The user has explicitly asked to make "
            "the remaining curriculum harder. Raise the difficulty level across ALL "
            "upcoming weeks: use more advanced vocabulary, longer or more complex "
            "exercises, reduce scaffolding and hints, and increase the pace where "
            "appropriate. Do NOT skip topics or shrink the number of weeks — the arc "
            "must still reach the goal. Reflect the increased challenge in each week's "
            "title, objective, and module descriptions. The summary_note MUST mention "
            "that the curriculum has been made harder at the user's request."
        )

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "adapter_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.4,
    )

    usage_meter.record(
        model=Config.OPENAI_MODEL,
        usage=completion.usage,
        agent="adapter",
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
