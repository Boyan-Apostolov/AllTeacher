"""Explainer agent.

Given a single concept (one of the planner's `weeks[].modules[]` entries),
produce a short lesson the user reads BEFORE exercising that concept. The
session screen flows: lesson(module_i) → exercises(module_i) → lesson(i+1)
→ exercises(i+1) → ... — the Explainer feeds the lesson half of that loop.

Length adapts to the user's level (beginner / intermediate / advanced) via
prompt instructions. We keep the JSON shape fixed so the orchestrator and
iOS don't have to branch on level.

Stateless: takes structured input, returns structured output. The
Orchestrator owns persistence into the `lessons` table.

Output shape:
{
  "concept_title": "...",          # short, native_language
  "intro": "...",                  # one-paragraph hook, native_language
  "key_points": ["...", "..."],    # 2–6 bullets, native_language
  "example": "...",                # one worked example, may include code or
                                   #   target_language phrases as needed
  "pitfalls": ["...", "..."],      # common misconceptions, may be empty
  "next_up": "..."                 # one-line bridge into the exercises
}
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config


# --- types ---

class ConceptInput(TypedDict, total=False):
    title: str
    kind: str           # planner-emitted vocab (e.g. "vocabulary", "grammar")
    description: str


class ExplainerInput(TypedDict, total=False):
    goal: str
    native_language: str
    target_language: str | None
    domain: str
    level: str                              # beginner / intermediate / advanced
    learning_style: str                     # mixed / visual / aural / ...
    week_number: int
    week_title: str
    week_objective: str
    concept: ConceptInput                   # the module being taught
    exercise_focus: list[str]               # week-level focus tags
    recent_weak_areas: list[str]            # bias intro/example toward these
    recent_avg_score: float | None          # 0..1; None if no submissions
                                            # yet. Adapter signal for
                                            # implicit re-leveling.


# --- prompt ---

SYSTEM_PROMPT = """\
You are AllTeacher's Explainer. Teach ONE concept clearly and concisely,
right before the user practices it. The user has not seen this material
yet — your lesson is the first thing they read about it.

Language: write `concept_title`, `intro`, `key_points`, `pitfalls`, and
`next_up` in `native_language`. The `example` may use `target_language`
content (a phrase, dialogue line, code snippet, formula, musical term)
when that's what the user is here to learn. Code stays in its own language.

Adapt length to `level`:
- beginner → warm intro grounded in everyday intuition; 4–6 short
  `key_points`; one fully-worked `example` with steps spelled out;
  1–3 `pitfalls`.
- intermediate → terser intro that assumes the basics; 3–4 `key_points`
  focused on the rule that distinguishes this from related concepts;
  one tight `example`; 1–2 `pitfalls`.
- advanced → 1–2 sentence refresher; 2–3 `key_points` with the edge
  cases or non-obvious nuance; one `example` showing the nuance; 0–2
  `pitfalls` only if there's a real foot-gun.

Honor `learning_style` (visual learners get concrete imagery, aural
learners get sound/rhythm framing, etc.) without changing the JSON shape.

If `recent_weak_areas` is non-empty AND any of those tags overlap with
this concept, lean the `intro` and `example` toward addressing them —
this is the user's chance to recover before drilling.

Implicit re-leveling: `recent_avg_score` (0..1, may be null) is the
user's recent average. If it's <0.55 the user is struggling — slow
down: longer `intro`, more explicit `key_points`, simpler `example`,
add a `pitfalls` entry that addresses the obvious confusion. If it's
>0.85 the user is coasting — tighten everything, treat the lesson as a
pre-drill refresher even at intermediate level. Otherwise hold to the
level-based defaults above.

`next_up` is one short sentence that hands off to the exercises ("Now
let's practice ..."), in `native_language`.

Quality bar: the whole lesson should read in under ~90 seconds for
beginners, under 60 for intermediate, under 30 for advanced. No filler.
No restating the obvious. No "in this lesson we will" preambles — go
straight to the substance.

The schema requires every field. `pitfalls` may be an empty array but
must be present.\
"""


RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "concept_title": {"type": "string"},
        "intro": {"type": "string"},
        "key_points": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 2,
            "maxItems": 6,
        },
        "example": {"type": "string"},
        "pitfalls": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 3,
        },
        "next_up": {"type": "string"},
    },
    "required": [
        "concept_title", "intro", "key_points", "example",
        "pitfalls", "next_up",
    ],
    "additionalProperties": False,
}


# --- client ---

def _client() -> OpenAI:
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def write_lesson(payload: ExplainerInput) -> dict[str, Any]:
    """Run the Explainer once. Returns a dict matching `RESPONSE_SCHEMA`.

    The orchestrator persists the result into `lessons.content_json` and
    sets `lessons.concept_title` from the returned `concept_title` for
    cheap list-view rendering.
    """
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
                "name": "explainer_response",
                "schema": RESPONSE_SCHEMA,
                "strict": True,
            },
        },
        temperature=0.5,
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
