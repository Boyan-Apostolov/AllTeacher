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
  "next_up": "...",                # one-line bridge into the exercises
  "diagram_mermaid": "...",        # optional Mermaid diagram source. Empty
                                   #   string when the concept doesn't earn a
                                   #   visual. iOS renders it client-side via
                                   #   a WebView + mermaid.min.js.
  "image_query": "..."             # optional Unsplash search query (2–5 words).
                                   #   Empty string when no photo adds value.
}
"""
from __future__ import annotations

import json
from typing import Any, TypedDict

from openai import OpenAI

from config import Config
from app.services import usage_meter


# --- types ---

class ConceptInput(TypedDict, total=False):
    title: str
    kind: str           # planner-emitted vocab (e.g. "vocabulary", "grammar")
    description: str


class ExplainerInput(TypedDict, total=False):
    goal: str
    native_language: str
    native_language_name: str           # full name, e.g. "Bulgarian" for "bg"
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
    mastered_concepts: list[str]            # strength tags seen ≥ 2 times
                                            # across prior exercises. Used
                                            # to open the lesson with a
                                            # brief revision of known wins.


# --- prompt ---

SYSTEM_PROMPT = """\
OUTPUT LANGUAGE: Write every word of your response in the language
specified by `native_language` / `native_language_name`. If that field
says "bg" / "Bulgarian", write in Bulgarian. If it says "es" / "Spanish",
write in Spanish. The goal field may be in a different language — ignore
that when choosing your output language. Do NOT fall back to English
under any circumstances.

You are AllTeacher's Explainer. Teach ONE concept clearly and concisely,
right before the user practices it. The user has not seen this material
yet — your lesson is the first thing they read about it.

LANGUAGE — every field the user reads is in `native_language_name`
(`native_language` BCP-47 code). This is non-negotiable.

  - `concept_title`, `intro`, `key_points`, `pitfalls`, and `next_up`
    MUST be in `native_language_name`. No exceptions, no fallback to
    English, no fallback to `target_language`.
  - `example` is also in `native_language_name` for its prose /
    commentary / setup. The ONLY content allowed in another language is
    the actual artifact being taught — a target-language phrase the user
    is learning to read or say, a code snippet (code stays in its own
    programming language), a musical term, a chemical formula, etc.
    Frame it like: "<native-language explanation>: <foreign artifact>
    — <native-language gloss>". Never let the example slip wholesale
    into `target_language`.
  - Even technical jargon and concept names that have a well-known
    native-language form should use the native form. Keep
    widely-untranslated terms (proper nouns, framework names, file
    extensions) as-is.

When in doubt, ask yourself: "Could a user who speaks ONLY
`native_language_name` read this lesson and understand it?" If no, rewrite.

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

MASTERED CONCEPTS — `mastered_concepts`:
If `mastered_concepts` is non-empty, open the `intro` with ONE short
sentence that acknowledges what the user has already locked in — e.g.
"You've already got X and Y down solid." — then pivot directly into
the new concept. Keep the acknowledgement to one sentence maximum; it's
a confidence booster, not a review lesson. Do not list more than 3–4
concepts even if more are supplied; pick the ones most relevant to the
current concept or week. If `mastered_concepts` is empty, skip this
entirely — no "so far you know nothing" phrasing.

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

IMAGE QUERY — `image_query`:
Default to INCLUDING an image. Set `image_query` to a short 2–5 word Unsplash
search query for almost every lesson. Pick something that makes the concept
feel immediately real and concrete to the learner.

For language/vocabulary lessons: the central object or scene being taught
("apple orchard", "Bulgarian market stall", "French bakery bread").
For cultural lessons: the place, tradition, or artifact ("flamenco dancer",
"Tokyo street food", "Bulgarian rose valley").
For skills (cooking, fitness, music, etc.): the action or tool ("chef knife
technique", "yoga downward dog", "violin bow closeup").
For science or nature: the phenomenon or organism ("water cycle diagram" is bad —
a photo works better: "rainstorm clouds dark", "frog on leaf").

Leave `image_query` EMPTY only for: abstract programming syntax (variable
declarations, operators), pure math equations, or grammar rules with zero
tangible referent. When in doubt, include a photo — a slightly imperfect
image is better than a wall of text. The photo appears at the top of the
lesson card as a visual hook before the intro paragraph.

DIAGRAMS — `diagram_mermaid`:
Optional. Default to an EMPTY STRING. Emit a Mermaid diagram source ONLY
when the concept genuinely has structure that a picture clarifies more
than prose: a process / pipeline (`flowchart LR ...`), a hierarchy or
classification (`flowchart TD ...` or `classDiagram`), a sequence of
interactions (`sequenceDiagram`), a decision tree, a comparison
(parallel branches). DO NOT emit one for vocabulary, single-fact
concepts, short language drills, or anything you'd be tempted to
illustrate with a single labelled box — that's noise. Aim for ≤ 8
nodes; bigger diagrams overwhelm the small mobile viewport.

When you do emit one:
- Write all node labels in `native_language`.
- Use Mermaid's `flowchart` / `classDiagram` / `sequenceDiagram` /
  `mindmap` syntaxes only — they're the four mermaid.js core renderers
  and the most reliable on a small WebView.
- Quote labels with double-quotes when they contain spaces or
  punctuation (`A["My label"] --> B`).
- No HTML, no inline styles, no `init` config blocks — keep the source
  parse-clean so the WebView template doesn't have to whitelist syntax.

Quality bar: the whole lesson should read in under ~90 seconds for
beginners, under 60 for intermediate, under 30 for advanced. No filler.
No restating the obvious. No "in this lesson we will" preambles — go
straight to the substance.

The schema requires every field. `pitfalls` may be an empty array but
must be present. `diagram_mermaid` may be an empty string but must be
present.\
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
        # Empty string when the concept doesn't earn a diagram. Required
        # by strict schema; iOS treats "" as "no diagram, render text only".
        "diagram_mermaid": {"type": "string"},
        # Empty string when no photo adds value. Orchestrator resolves to
        # image_url via Unsplash API and stores it in content_json.
        "image_query": {"type": "string"},
    },
    "required": [
        "concept_title", "intro", "key_points", "example",
        "pitfalls", "next_up", "diagram_mermaid", "image_query",
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

    usage_meter.record(
        model=Config.OPENAI_MODEL,
        usage=completion.usage,
        agent="explainer",
    )

    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)
