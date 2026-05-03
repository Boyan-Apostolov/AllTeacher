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
from app.agents.tracker import mastered_concepts as _mastered_concepts
from app.services import media
from config import Config

from ._base import lang_name, now_iso
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
                # Back-fill image_url on cached lessons that were generated
                # before the Unsplash feature landed (they have no image_url).
                # Derive a query from concept_title + domain when image_query
                # is absent — same fallback logic as _materialise_images.
                if Config.UNSPLASH_ACCESS_KEY and not content.get("image_url"):
                    summary_c = (row.get("assessment_json") or {}).get("summary") or {}
                    domain_c = row.get("domain") or summary_c.get("domain") or ""
                    q = (content.get("image_query") or "").strip()
                    if not q:
                        title_c = (
                            content.get("concept_title")
                            or persisted.get("concept_title")
                            or ""
                        ).strip()
                        if title_c:
                            q = (
                                f"{title_c} {domain_c}".strip()
                                if domain_c and len(title_c.split()) <= 3
                                else title_c
                            )
                    if q:
                        img_url = media.unsplash_photo_url(q)
                        if img_url:
                            content["image_url"] = img_url
                            # Persist so the next cache hit already has the URL.
                            try:
                                self.db.table("lessons").update(
                                    {"content_json": content}
                                ).eq("id", persisted["id"]).execute()
                            except Exception:
                                pass  # non-fatal — image still shown this request
                return _to_payload({**persisted, "content_json": content})

        # Cache miss — run the Explainer.
        summary = (row.get("assessment_json") or {}).get("summary") or {}
        concept = modules[module_index]
        _native_lang_code = row.get("native_language") or "en"
        payload = {
            "goal": row.get("goal") or row.get("topic") or "",
            "native_language": _native_lang_code,
            "native_language_name": lang_name(_native_lang_code),
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
            # Implicit re-leveling — see _ExercisesMixin._recent_avg_score.
            # The Explainer mixin sits later in the MRO than the Exercises
            # mixin, so the helper is reachable on `self` at runtime.
            "recent_avg_score": (
                self._recent_avg_score(curriculum_id)  # type: ignore[attr-defined]
                if hasattr(self, "_recent_avg_score") else None
            ),
        }

        # Derive mastered concepts from exercise feedback so the Explainer
        # can open the lesson with a brief revision of what the user has
        # already confirmed they know (strength tags seen ≥ 2 times).
        try:
            _ex_rows = (
                self.db.table("exercises")
                .select("feedback_json")
                .eq("curriculum_id", curriculum_id)
                .eq("status", "evaluated")
                .not_.is_("feedback_json", "null")
                .execute()
            ).data or []
            payload["mastered_concepts"] = _mastered_concepts(_ex_rows)
        except Exception:
            payload["mastered_concepts"] = []

        try:
            content = explainer.write_lesson(payload)
        except Exception as e:
            raise OrchestratorError(
                code="explainer_failed",
                status=500,
                detail=str(e),
            )

        # Unsplash image — resolve to a photo URL and store in content_json
        # so the iOS lesson card shows a visual hook above the intro.
        # Priority: (1) Explainer-provided image_query; (2) concept_title +
        # domain fallback so abstract/coding topics still get a photo even
        # when the Explainer correctly leaves image_query empty.
        # Fails soft — lesson is still returned without an image on error.
        if Config.UNSPLASH_ACCESS_KEY and not content.get("image_url"):
            _q = (content.get("image_query") or "").strip()
            if not _q:
                _title = (
                    content.get("concept_title")
                    or concept.get("title")
                    or ""
                ).strip()
                _domain = row.get("domain") or summary.get("domain") or ""
                if _title:
                    _q = (
                        f"{_title} {_domain}".strip()
                        if _domain and len(_title.split()) <= 3
                        else _title
                    )
            if _q:
                _img = media.unsplash_photo_url(_q)
                if _img:
                    content["image_url"] = _img

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
