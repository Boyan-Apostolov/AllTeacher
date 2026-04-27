"""Explainer phase — short adaptive lessons that play *before* exercises.

The session screen now flows:

    lesson(module_0)  →  exercises(module_0)
        →  lesson(module_1)  →  exercises(module_1)
            →  ...  →  finished

One lesson per planner module (`weeks[].modules[]` from the Planner). This
mixin owns:

  - generate_lesson    → look up or create the lesson row for one
                         (curriculum, week, module_index)
  - mark_lesson_seen   → flip status='seen' once the user advances past
                         the lesson screen
  - list_lessons       → read-only listing for the iOS session bootstrap

The Explainer agent stays pure (structured input → structured output);
this mixin handles the row caching, ownership checks, and "find the next
unseen module" logic.
"""
from __future__ import annotations

from typing import Any

from app.agents import explainer

from ._base import now_iso
from .errors import Conflict, NotFound, OrchestratorError
from .types import LessonPayload


class _LessonsMixin:
    """Provided by `_OrchestratorBase`: `db`, `_load_curriculum`,
    `_resolve_week`. See the sibling mixins for the same MRO note about
    not stubbing methods here."""

    db: Any

    # ----- public methods -----

    def generate_lesson(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        week_id: str | None = None,
        module_index: int | None = None,
    ) -> LessonPayload:
        """Return a lesson for one (curriculum, week, module_index).

        If `module_index` is omitted, picks the lowest module in the week
        that does not yet have a lesson with status='seen' — i.e. the next
        thing the user should read. If the row already exists with content,
        we return it as-is (lessons are stable per module; we don't burn
        tokens regenerating). Otherwise we call the Explainer and insert.
        """
        row = self._load_curriculum(curriculum_id, user_id)
        if row.get("planner_status") != "complete":
            raise Conflict(code="planner_not_complete")

        week_row = self._resolve_week(curriculum_id, week_id)
        if week_row is None:
            raise NotFound(code="week_not_found")

        week_plan = week_row.get("plan_json") or {}
        modules = week_plan.get("modules") or []
        if not modules:
            raise Conflict(code="week_has_no_modules")

        # If caller didn't specify, find the next module the user hasn't
        # marked seen yet. Default to module 0 if every existing row is
        # 'seen' (the user has finished the week — caller can decide what
        # to do; here we just return the first module's lesson again).
        if module_index is None:
            existing = (
                self.db.table("lessons")
                .select("module_index,status")
                .eq("curriculum_id", curriculum_id)
                .eq("week_id", week_row["id"])
                .execute()
            ).data or []
            seen_indices = {
                int(r["module_index"]) for r in existing
                if r.get("status") == "seen"
            }
            module_index = next(
                (i for i in range(len(modules)) if i not in seen_indices),
                0,
            )

        if module_index < 0 or module_index >= len(modules):
            raise NotFound(code="module_index_out_of_range")

        # Cache hit: row already populated for this module.
        existing_row = (
            self.db.table("lessons")
            .select("*")
            .eq("curriculum_id", curriculum_id)
            .eq("week_id", week_row["id"])
            .eq("module_index", module_index)
            .limit(1)
            .execute()
        ).data or []
        if existing_row:
            persisted = existing_row[0]
            content = persisted.get("content_json") or {}
            if content:  # don't trust an empty row — fall through to regen
                return _to_payload(persisted)

        # Cache miss — run the Explainer.
        summary = (row.get("assessment_json") or {}).get("summary") or {}
        concept = modules[module_index]
        payload = {
            "goal": row.get("goal") or row.get("topic") or "",
            "native_language": row.get("native_language") or "en",
            "target_language": (
                row.get("target_language")
                or summary.get("target_language")
            ),
            "domain": row.get("domain") or summary.get("domain") or "",
            "level": row.get("level") or summary.get("level") or "beginner",
            "learning_style": (
                row.get("learning_style")
                or summary.get("learning_style") or "mixed"
            ),
            "week_number": int(
                week_plan.get("week_number")
                or week_row.get("week_number")
                or 1
            ),
            "week_title": week_plan.get("title") or "",
            "week_objective": week_plan.get("objective") or "",
            "concept": {
                "title": concept.get("title") or "",
                "kind": concept.get("kind") or "",
                "description": concept.get("description") or "",
            },
            "exercise_focus": week_plan.get("exercise_focus") or [],
            "recent_weak_areas": list(row.get("recent_weak_areas") or []),
        }

        try:
            content = explainer.write_lesson(payload)
        except Exception as e:
            raise OrchestratorError(
                code="explainer_failed",
                status=500,
                detail=str(e),
            )

        insert_row = {
            "curriculum_id": curriculum_id,
            "week_id": week_row["id"],
            "module_index": module_index,
            "concept_title": (
                content.get("concept_title")
                or concept.get("title")
                or ""
            ),
            "content_json": content,
            "status": "ready",
        }

        # If a stub row exists (existing_row but empty content) update it
        # instead of inserting — the unique index would otherwise reject.
        if existing_row:
            updated = (
                self.db.table("lessons")
                .update(insert_row)
                .eq("id", existing_row[0]["id"])
                .execute()
            ).data or []
            persisted = updated[0] if updated else {**existing_row[0], **insert_row}
        else:
            inserted = (
                self.db.table("lessons")
                .insert(insert_row)
                .execute()
            ).data or []
            if not inserted:
                raise OrchestratorError(
                    code="lesson_persist_failed",
                    status=500,
                )
            persisted = inserted[0]

        return _to_payload(persisted)

    def mark_lesson_seen(
        self,
        *,
        user_id: str,
        lesson_id: str,
    ) -> LessonPayload:
        """Flip a lesson's status to 'seen'. Idempotent — safe to call more
        than once (the timestamp updates on the first transition only)."""
        lesson = self._load_lesson(lesson_id, user_id)

        if lesson.get("status") == "seen":
            return _to_payload(lesson)

        updated = (
            self.db.table("lessons")
            .update({"status": "seen", "seen_at": now_iso()})
            .eq("id", lesson_id)
            .execute()
        ).data or []
        return _to_payload(updated[0] if updated else lesson)

    def list_lessons(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        week_id: str | None = None,
    ) -> list[LessonPayload]:
        """List lessons the user has ever generated for this curriculum,
        optionally filtered to one week. Ordered by week then module_index
        so the iOS session screen can render them in study order."""
        # Ownership check via the curriculum.
        self._load_curriculum(curriculum_id, user_id)

        q = (
            self.db.table("lessons")
            .select("*")
            .eq("curriculum_id", curriculum_id)
            .order("week_id")
            .order("module_index")
        )
        if week_id:
            q = q.eq("week_id", week_id)
        rows = q.execute().data or []
        return [_to_payload(r) for r in rows]

    # ----- internals -----

    def _load_lesson(self, lesson_id: str, user_id: str) -> dict[str, Any]:
        """Load a lessons row and verify the user owns its parent
        curriculum. Mirrors `_load_exercise` in `_exercises.py`."""
        lesson = (
            self.db.table("lessons")
            .select("*")
            .eq("id", lesson_id)
            .single()
            .execute()
        ).data
        if not lesson:
            raise NotFound()
        owner_check = (
            self.db.table("curricula")
            .select("id")
            .eq("id", lesson.get("curriculum_id"))
            .eq("user_id", user_id)
            .single()
            .execute()
        ).data
        if not owner_check:
            raise NotFound()
        return lesson


# ----- helpers -----

def _to_payload(row: dict[str, Any]) -> LessonPayload:
    """Project a `lessons` DB row down to the JSON shape routes return.

    Kept narrow so the iOS client doesn't accidentally key off internal
    columns the API hasn't promised to keep stable.
    """
    return {
        "id": row.get("id"),
        "curriculum_id": row.get("curriculum_id"),
        "week_id": row.get("week_id"),
        "module_index": row.get("module_index"),
        "concept_title": row.get("concept_title") or "",
        "content_json": row.get("content_json") or {},
        "status": row.get("status") or "ready",
        "seen_at": row.get("seen_at"),
        "created_at": row.get("created_at"),
    }
