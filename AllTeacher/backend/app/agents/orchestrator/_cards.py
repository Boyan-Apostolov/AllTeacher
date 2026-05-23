"""Cards mixin — auto-populate knowledge_cards from evaluated exercises and lessons.

Sources:
  - flashcard     → front/back are already explicit card pairs
  - multiple_choice → front = prompt, back = correct option
  - short_answer  → front = prompt, back = expected answer
  - listen_choice → front = audio_text (spoken phrase), back = correct option
  - video_choice  → front = prompt, back = correct option
  - lesson key_terms → [{front, back}] extracted by the Explainer agent

All paths upsert on (user_id, source_id) to avoid duplicates when the same
exercise is re-submitted (bonus drills). Mastery is blended on update.
All paths fail soft — card failures never bubble into user-facing responses.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

log = logging.getLogger(__name__)

_DOMAIN_EMOJI = {
    "language": "🗣️",
    "math": "📐",
    "code": "💻",
    "music": "🎵",
    "cooking": "🍳",
    "science": "🔬",
    "history": "📜",
    "art": "🎨",
    "fitness": "🏋️",
    "business": "📊",
}


def _domain_emoji(domain: str) -> str:
    return _DOMAIN_EMOJI.get((domain or "general").lower(), "📝")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _mastery_from_score(score: float | None) -> int:
    """Map Evaluator 0–1 score to an initial mastery percentage."""
    if score is None:
        return 20
    s = float(score)
    if s >= 0.9: return 80
    if s >= 0.7: return 60
    if s >= 0.5: return 40
    return 20


def _next_due_from_mastery(mastery: int) -> str:
    if mastery >= 75: days = 7
    elif mastery >= 55: days = 4
    elif mastery >= 35: days = 2
    else: days = 1
    return _iso(_now() + timedelta(days=days))


def _difficulty_from_score(score: float | None) -> str:
    if score is None: return "medium"
    s = float(score)
    if s >= 0.85: return "easy"
    if s >= 0.55: return "medium"
    return "hard"


def _derive_front_back(
    ex_type: str,
    content: dict[str, Any],
) -> tuple[str, str] | None:
    """Extract a (front, back) card pair from any exercise type.

    Returns None when the exercise doesn't contain enough structured content
    to make a useful card (e.g. a grammar drill with no clear term→meaning pair).
    """
    if ex_type == "flashcard":
        front = (content.get("front") or "").strip()
        back  = (content.get("back")  or "").strip()
        return (front, back) if front and back else None

    if ex_type in ("multiple_choice", "video_choice"):
        prompt  = (content.get("prompt") or "").strip()
        options = content.get("options") or []
        idx     = content.get("correct_index")
        if prompt and options and isinstance(idx, int) and 0 <= idx < len(options):
            back = (options[idx] or "").strip()
            return (prompt, back) if back else None

    if ex_type == "short_answer":
        prompt   = (content.get("prompt") or "").strip()
        expected = (content.get("expected") or "").strip()
        return (prompt, expected) if prompt and expected else None

    if ex_type == "listen_choice":
        # audio_text is the spoken phrase (target_language) — the thing being learned.
        # The correct option is its meaning/translation in native_language.
        audio_text = (content.get("audio_text") or "").strip()
        options    = content.get("options") or []
        idx        = content.get("correct_index")
        if audio_text and options and isinstance(idx, int) and 0 <= idx < len(options):
            back = (options[idx] or "").strip()
            return (audio_text, back) if back else None

    return None


class _CardsMixin:
    """Provided by `_OrchestratorBase`: `db`."""

    db: Any

    # ── Public: called from _exercises.py ─────────────────────────────────

    def _upsert_card_from_exercise(
        self,
        *,
        user_id: str,
        exercise: dict[str, Any],
        curriculum: dict[str, Any],
        score: float | None,
    ) -> None:
        """Create or update a KnowledgeCard from any completed exercise type.

        The upsert key is (user_id, source_id). Re-submitting the same exercise
        (e.g. a bonus drill) only updates mastery, never creates a duplicate.
        Fails soft.
        """
        content: dict[str, Any] = exercise.get("content_json") or {}
        ex_type = (
            exercise.get("type")
            or content.get("type")
            or ""
        )

        pair = _derive_front_back(ex_type, content)
        if not pair:
            return  # type has no extractable card pair

        front, back = pair
        exercise_id  = exercise.get("id")
        summary      = (curriculum.get("assessment_json") or {}).get("summary") or {}
        domain       = (curriculum.get("domain") or summary.get("domain") or "general").lower()
        curriculum_name = curriculum.get("goal") or curriculum.get("topic") or ""
        curriculum_id   = curriculum.get("id")
        mastery    = _mastery_from_score(score)
        difficulty = _difficulty_from_score(score)
        now_str    = _iso(_now())

        self._upsert_one_card(
            user_id=user_id,
            front=front,
            back=back,
            example=None,
            domain=domain,
            curriculum_name=curriculum_name,
            curriculum_id=curriculum_id,
            mastery=mastery,
            difficulty=difficulty,
            now_str=now_str,
            source="exercise",
            source_id=exercise_id,
        )

    # ── Public: called from _lessons.py ───────────────────────────────────

    def _upsert_cards_from_lesson(
        self,
        *,
        user_id: str,
        lesson_id: str,
        key_terms: list[dict[str, Any]],
        curriculum: dict[str, Any],
    ) -> None:
        """Create KnowledgeCards from key_terms extracted by the Explainer.

        key_terms is a list of {front, back, example?} dicts. Each term gets
        its own card keyed on (user_id, source_id=lesson_id+":"+i) — a stable
        per-term key so re-generating the same lesson doesn't duplicate cards.
        Fails soft.
        """
        if not key_terms:
            return

        summary = (curriculum.get("assessment_json") or {}).get("summary") or {}
        domain  = (curriculum.get("domain") or summary.get("domain") or "general").lower()
        curriculum_name = curriculum.get("goal") or curriculum.get("topic") or ""
        curriculum_id   = curriculum.get("id")
        now_str = _iso(_now())

        for i, term in enumerate(key_terms):
            front   = (term.get("front") or "").strip()
            back    = (term.get("back")  or "").strip()
            example = (term.get("example") or "").strip() or None
            if not front or not back:
                continue
            # Stable per-term key: lesson_id + ordinal
            source_id = f"{lesson_id}:{i}"
            self._upsert_one_card(
                user_id=user_id,
                front=front,
                back=back,
                example=example,
                domain=domain,
                curriculum_name=curriculum_name,
                curriculum_id=curriculum_id,
                mastery=0,           # new from a lesson — not yet tested
                difficulty="medium",
                now_str=now_str,
                source="lesson",
                source_id=source_id,
            )

    # ── Shared low-level upsert ────────────────────────────────────────────

    def _upsert_one_card(
        self,
        *,
        user_id: str,
        front: str,
        back: str,
        example: str | None,
        domain: str,
        curriculum_name: str,
        curriculum_id: str | None,
        mastery: int,
        difficulty: str,
        now_str: str,
        source: str,
        source_id: str | None,
    ) -> None:
        try:
            existing: list[dict] = []
            if source_id:
                existing = (
                    self.db.table("knowledge_cards")
                    .select("id,mastery")
                    .eq("user_id", user_id)
                    .eq("source_id", source_id)
                    .limit(1)
                    .execute()
                ).data or []

            if existing:
                old_mastery = existing[0].get("mastery") or 0
                # Blend: 60% old, 40% new — keeps improvement gradual
                blended = max(0, min(100, int(old_mastery * 0.6 + mastery * 0.4)))
                self.db.table("knowledge_cards").update({
                    "mastery": blended,
                    "difficulty": difficulty,
                    "last_reviewed": now_str,
                    "next_due": _next_due_from_mastery(blended),
                }).eq("id", existing[0]["id"]).execute()
            else:
                self.db.table("knowledge_cards").insert({
                    "user_id": user_id,
                    "front": front,
                    "back": back,
                    "example": example,
                    "domain": domain,
                    "curriculum": curriculum_name,
                    "curriculum_id": curriculum_id,
                    "emoji": _domain_emoji(domain),
                    "difficulty": difficulty,
                    "mastery": mastery,
                    "last_reviewed": now_str if mastery > 0 else None,
                    "next_due": _next_due_from_mastery(mastery),
                    "source": source,
                    "source_id": source_id,
                }).execute()
        except Exception as exc:
            log.warning("_upsert_one_card failed (non-fatal): source=%s id=%s err=%s",
                        source, source_id, exc)
