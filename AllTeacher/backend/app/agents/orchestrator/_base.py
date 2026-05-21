"""Shared state + low-level row loaders used by every orchestrator mixin.

Every Orchestrator instance is built per-request with a Supabase client. The
loaders here apply ownership checks (curriculum.user_id matches the JWT
subject) and raise `NotFound` so route handlers don't need to know whether
the row was missing or simply belonged to someone else.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .errors import NotFound


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class _OrchestratorBase:
    """Base for the Orchestrator mixin stack — owns `db` + the row loaders."""

    def __init__(self, db):
        self.db = db

    # ----- row loaders (with ownership checks) -----

    def _load_curriculum(self, curriculum_id: str, user_id: str) -> dict[str, Any]:
        row = (
            self.db.table("curricula")
            .select("*")
            .eq("id", curriculum_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        ).data
        if not row:
            raise NotFound()
        return row

    def _load_exercise(self, exercise_id: str, user_id: str) -> dict[str, Any]:
        """Load an exercise row and verify it belongs to a curriculum the user
        owns. Raises NotFound otherwise."""
        ex = (
            self.db.table("exercises")
            .select("*")
            .eq("id", exercise_id)
            .single()
            .execute()
        ).data
        if not ex:
            raise NotFound()
        # ownership check via the parent curriculum
        owner_check = (
            self.db.table("curricula")
            .select("id")
            .eq("id", ex.get("curriculum_id"))
            .eq("user_id", user_id)
            .single()
            .execute()
        ).data
        if not owner_check:
            raise NotFound()
        return ex

    def _resolve_week(
        self,
        curriculum_id: str,
        week_id: str | None,
    ) -> dict[str, Any] | None:
        """Returns the curriculum_weeks row for `week_id`, or — if None — the
        lowest-numbered week_row that isn't yet 'complete'."""
        if week_id:
            row = (
                self.db.table("curriculum_weeks")
                .select("*")
                .eq("id", week_id)
                .eq("curriculum_id", curriculum_id)
                .single()
                .execute()
            ).data
            return row

        rows = (
            self.db.table("curriculum_weeks")
            .select("*")
            .eq("curriculum_id", curriculum_id)
            .order("week_number")
            .execute()
        ).data or []
        for r in rows:
            if r.get("status") != "complete":
                return r
        return rows[0] if rows else None
