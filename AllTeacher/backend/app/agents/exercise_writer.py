"""Exercise Writer agent.

Given a week's plan + the user's profile (level, native_language,
target_language, learning_style, exercise_focus), produce a batch of
domain-appropriate exercises the user can attempt right now.

Stateless: takes structured input, returns structured output. The
Orchestrator handles persistence and dedupe against `seen_titles`.

Output shape:
{
  "exercises": [
    {
      "type": "multiple_choice" | "flashcard" | "short_answer",
      "title": "...",                 # short label, native_language
      # multiple_choice:
      "prompt": "...",                # in native_language unless target-language drill
      "options": ["...", "...", ...],
      "correct_index": 0,
      # flashcard:
      "front": "...",
      "back": "...",
      # short_answer:
      "expected": "...",
      "rubric": ["...", "..."],       # optional — only when there are
                                      # multiple acceptable answers / a
                                      # multi-criterion judgement is needed
    },
    ...
  ]
}

Because OpenAI structured outputs require a fixed schema, ALL fields are
declared on every exercise object — but they're optional in the prompt
(the model leaves the irrelevant ones empty). The Orchestrator strips
empty fields before persisting.

Note: the long-form `essay_prompt` type was removed — long writing tasks
are now expressed as `short_answer` with a rubric. Per-answer "why this
fell short" comes from the Evaluator's `gap` field at submission time, so
exercises no longer carry a static `explanation` blurb.
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config
from app.services import usage_meter


# --- types ---

class WriterInput(TypedDict, total=False):
    goal: str
    native_language: str
    target_language: str | None
    domain: str
    level: str
    learning_style: str
    week_number: int
    week_title: str
    week_objective: str
    week_modules: list[dict[str, Any]]      # [{title, kind, description}, ...]
    exercise_focus: list[str]
    seen_titles: list[str]                  # dedupe against these
    recent_weak_areas: list[str]            # adaptive bias for follow-up sessions
    recent_avg_score: float | None          # 0..1 across the user's most
                                            # recent evaluated answers; None
                                            # if they haven't submitted any yet.
                                            # Used for implicit re-leveling —
                                            # the writer slows down when low,
                                            # raises difficulty when high.
    bonus_focus: bool                       # when True, this is a bonus
                                            # weak-area drill — every item
                                            # must target one of recent_weak_areas
    count: int                              # how many exercises to generate


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Exercise Writer. Generate a batch of exercises the user can attempt now.

Language: write `title` and `rubric` entries in `native_language`. Write `prompt` and `options` in native_language UNLESS this is a target-language drill (vocab/reading/listening/grammar with `domain="language"` and a `target_language`) — those may use target_language so the user actually practices it. For translation drills, pick the most useful direction for the user's level. Code snippets stay in their language. Type values are lowercase English machine identifiers.

Types — pick the right one per item; mix types across the batch:
- multiple_choice: prompt + 3–5 options + correct_index (0-based). Vocab recognition, grammar judgement, concept recall, code-output prediction, theory.
- flashcard: front (cue) + back (answer). Self-graded by the user. Vocabulary, terminology, formulas, repertoire hooks.
- short_answer: open prompt where the user types a free-text response. Use this for translation, definitions, problem-set numericals — AND for longer writing/explanation/critique tasks. For longer prompts include `rubric` (3–5 bullets) so the Evaluator can grade by criteria. `expected` may be a model answer (short types) OR a brief sketch of what a good response covers (longer types).

Quality: keep each exercise doable in ~2 minutes; longer writing prompts may take ~5 min. Calibrate difficulty to `level`. Honor `exercise_focus` (if empty, derive from week modules + objective). Honor `learning_style`. Skip any title in `seen_titles`; if a topic must repeat, vary phrasing AND angle.

Adaptation: if `recent_weak_areas` is non-empty, bias the batch toward those tags — at least half of the items should target one of them — without losing the week's `exercise_focus`. If `recent_weak_areas` is empty (e.g. first session), generate a balanced introductory batch instead.

Bonus mode: when `bonus_focus` is true, EVERY item must target a tag from `recent_weak_areas`. No new topics, no warm-up filler — this batch is a recovery drill, so favor concrete recall and small-step reasoning over open-ended prompts (prefer multiple_choice and flashcard, sprinkle one short_answer at most).

Implicit re-leveling: `recent_avg_score` (0..1) is the user's recent average. If <0.55 the user is struggling — drop one notch in difficulty, prefer multiple_choice + flashcards, keep prompts concrete and short. If >0.85 the user is coasting — push one notch up, add a harder short_answer, vary phrasing more aggressively. Otherwise hold steady.

Generate exactly `count` exercises.

The schema requires every field on every exercise. For fields irrelevant to the chosen type, return empty string / empty array / 0 — never omit them.\
"""


# Single fixed schema with optional fields per type. Strict mode requires
# every property in `required`, so we declare them all and let the model
# zero out the ones that don't apply (see prompt instructions above).
EXERCISE_TYPE_ENUM = ["multiple_choice", "flashcard", "short_answer"]

EXERCISE_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": EXERCISE_TYPE_ENUM},
        "title": {"type": "string"},
        "prompt": {"type": "string"},
        "options": {
            "type": "array",
            "items": {"type": "string"},
        },
        "correct_index": {"type": "integer"},
        "front": {"type": "string"},
        "back": {"type": "string"},
        "expected": {"type": "string"},
        "rubric": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": [
        "type", "title", "prompt", "options", "correct_index",
        "front", "back", "expected", "rubric",
    ],
    "additionalProperties": False,
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "exercises": {
            "type": "array",
            "minItems": 1,
            "maxItems": 8,
            "items": EXERCISE_SCHEMA,
        },
    },
    "required": ["exercises"],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def _strip_empty(ex: dict[str, Any]) -> dict[str, Any]:
    """Remove zero-value fields the model filled in to satisfy the strict
    schema but that don't apply to this exercise's `type`. Keeps the
    persisted `content_json` clean.

    Note: legacy rows in the DB may still carry an `essay_prompt` type or
    `explanation` / `expected_length` fields from the previous schema. The
    iOS renderer treats `essay_prompt` as `short_answer` and ignores
    `explanation`, so we don't migrate the data — just stop emitting them
    from new generations."""
    out: dict[str, Any] = {"type": ex.get("type"), "title": ex.get("title", "")}
    t = out["type"]
    keep_by_type = {
        "multiple_choice": ["prompt", "options", "correct_index"],
        "flashcard": ["front", "back"],
        "short_answer": ["prompt", "expected", "rubric"],
    }
    for k in keep_by_type.get(t, []):
        v = ex.get(k)
        # always include — even if empty — so the UI has a stable shape.
        out[k] = v if v is not None else ("" if isinstance(v, str) else v)
        if v is None:
            out[k] = [] if k in ("options", "rubric") else (
                0 if k == "correct_index" else ""
            )
    return out


def write_batch(payload: WriterInput) -> dict[str, Any]:
    """Run the Exercise Writer once. Returns
    `{"exercises": [<cleaned exercise>, ...]}` — already stripped of the
    schema's filler fields."""
    client = _client()
    count = int(payload.get("count") or 5)
    payload = {**payload, "count": count}

    completion = client.chat.completions.create(
        model=Config.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "exercise_writer_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.7,
    )

    usage_meter.record(
        model=Config.OPENAI_MODEL,
        usage=completion.usage,
        agent="exercise_writer",
    )

    raw = completion.choices[0].message.content or "{}"
    parsed = json.loads(raw)
    parsed["exercises"] = [_strip_empty(e) for e in parsed.get("exercises", [])]
    return parsed
