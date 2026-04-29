"""Tracker + Adapter phase.

Two read paths and one write path:

  - dashboard_summary(user_id)            → home/progress screen
  - curriculum_progress(curriculum_id)    → per-curriculum drilldown
  - run_adapter(curriculum_id)            → re-plan upcoming weeks
                                            (called from submit_exercise)

The actual aggregation lives in `app.agents.tracker` (pure DB reads). The
LLM call lives in `app.agents.adapter`. This mixin owns ownership checks,
DB writes for the rewrite, and the conditional logic between them.
"""
from __future__ import annotations

from typing import Any

from app.agents import adapter as adapter_agent
from app.agents import tracker
from app.middleware.tier_check import TIER_RANK

from config import Config

from .errors import NotFound, OrchestratorError


def _adapter_tier_ok(tier: str) -> bool:
    """True when the user's tier meets `ADAPTER_TIER_MIN`. Defensive on
    unknown tier strings — anything we don't recognise is treated as
    'free' so we never accidentally hand a free user a paid feature."""
    have = TIER_RANK.get((tier or "free").lower(), 0)
    need = TIER_RANK.get(Config.ADAPTER_TIER_MIN, 1)
    return have >= need


class _TrackerMixin:
    """Provided by `_OrchestratorBase`: `db`, `_load_curriculum`.

    See the note in `_ExercisesMixin`: don't add `def _load_curriculum(...)
    -> ...: ...` stubs here, even for type-checking. At runtime the `...`
    body returns None and shadows the real loader.
    """

    db: Any

    # ----- read paths -----

    def dashboard_summary(self, *, user_id: str) -> dict[str, Any]:
        """Global rollup across every curriculum the user owns."""
        return tracker.dashboard_summary(self.db, user_id)

    def curriculum_progress(
        self,
        *,
        user_id: str,
        curriculum_id: str,
    ) -> dict[str, Any]:
        """Per-curriculum drilldown. Verifies ownership before reading."""
        # Ownership check first — `_load_curriculum` raises NotFound if the
        # row isn't there or doesn't belong to the user.
        self._load_curriculum(curriculum_id, user_id)
        out = tracker.curriculum_progress(self.db, curriculum_id)
        if not out:
            raise NotFound()
        return out

    # ----- write paths (Adapter) -----

    def run_adapter(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        tier: str = "free",
    ) -> dict[str, Any]:
        """Public form of the adapter — for an explicit "re-plan now"
        button. The auto path goes through `_run_adapter_if_eligible` from
        submit_exercise; this one verifies ownership and re-raises agent
        errors as OrchestratorErrors so the route layer can surface them.

        Tier gate: explicit re-plan is a Pro+ feature. Free users hit a
        402 here so the iOS layer can show an upgrade CTA. The auto path
        also tier-checks but soft-skips so a Free user's submit still
        completes cleanly without the re-plan side effect.
        """
        if not _adapter_tier_ok(tier):
            raise OrchestratorError(
                code="tier_adapter_required",
                status=402,
                detail=(
                    f"Re-planning is part of {Config.ADAPTER_TIER_MIN.title()}+. "
                    f"Upgrade to have your curriculum adapt to your performance."
                ),
            )
        row = self._load_curriculum(curriculum_id, user_id)
        result = self._run_adapter_if_eligible(row, tier=tier)
        if result is None:
            return {"changed": False, "reason": "no_upcoming_weeks"}
        return result

    def _run_adapter_if_eligible(
        self,
        curriculum: dict[str, Any],
        *,
        tier: str = "free",
    ) -> dict[str, Any] | None:
        """Run the Adapter if there are upcoming weeks to rewrite. Returns
        None when there's nothing to do (e.g. all weeks complete) OR when
        the user's tier doesn't include Adapter access — the auto-path
        callers in `_persist_evaluator_result` rely on `None` meaning
        "skip silently", so the tier check belongs here, not at the
        call site. Raises OrchestratorError on agent failure — call sites
        that want fail-soft behaviour need their own try/except."""
        if not _adapter_tier_ok(tier):
            return None
        curriculum_id = curriculum["id"]

        weeks = (
            self.db.table("curriculum_weeks")
            .select("id,week_number,plan_json,status,is_bonus")
            .eq("curriculum_id", curriculum_id)
            .order("week_number")
            .execute()
        ).data or []
        if not weeks:
            return None

        completed = [w for w in weeks if w.get("status") == "complete"]
        upcoming = [w for w in weeks if w.get("status") != "complete"]
        if not upcoming:
            return None  # nothing left to rewrite

        # current_week = highest completed week_number, or 0 if none.
        current_week = max(
            (int(w.get("week_number") or 0) for w in completed),
            default=0,
        )

        # Per-week aggregates so the Adapter can see how the user did.
        prog = tracker.curriculum_progress(self.db, curriculum_id)
        per_week_by_id = {w["id"]: w for w in prog.get("weeks", [])}

        def _week_summary(w: dict[str, Any]) -> dict[str, Any]:
            extra = per_week_by_id.get(w["id"], {})
            plan = w.get("plan_json") or {}
            return {
                "week_number": int(w.get("week_number") or 0),
                "title": plan.get("title"),
                "objective": plan.get("objective"),
                "modules": plan.get("modules") or [],
                "exercise_focus": plan.get("exercise_focus") or [],
                "status": w.get("status"),
                "is_bonus": bool(w.get("is_bonus")),
                "exercises_total": int(extra.get("exercises_total", 0)),
                "exercises_completed": int(extra.get("exercises_completed", 0)),
                "avg_score": extra.get("avg_score"),
            }

        plan_overview = curriculum.get("plan_json") or {}
        summary = (curriculum.get("assessment_json") or {}).get("summary") or {}

        payload = {
            "goal": curriculum.get("goal") or curriculum.get("topic") or "",
            "native_language": curriculum.get("native_language") or "en",
            "domain": curriculum.get("domain") or summary.get("domain") or "",
            "level": curriculum.get("level") or summary.get("level") or "beginner",
            "learning_style": curriculum.get("learning_style")
                or summary.get("learning_style") or "mixed",
            "target_language": curriculum.get("target_language")
                or summary.get("target_language"),
            "time_budget_mins_per_day": int(
                curriculum.get("time_budget_mins_per_day")
                or summary.get("time_budget_mins_per_day")
                or 20
            ),
            "notes": summary.get("notes") or "",

            "plan_title": plan_overview.get("title") or "",
            "plan_summary_for_user": plan_overview.get("summary_for_user") or "",
            "phases": plan_overview.get("phases") or [],

            "current_week": current_week,
            "total_weeks": int(plan_overview.get("total_weeks") or len(weeks)),
            "completed_weeks": [_week_summary(w) for w in completed],
            "upcoming_weeks": [_week_summary(w) for w in upcoming],

            "recent_weak_areas": list(curriculum.get("recent_weak_areas") or []),
            "recent_strengths": list(curriculum.get("recent_strengths") or []),
            "top_weak_areas": prog.get("top_weak_areas") or [],
            "top_strengths": prog.get("top_strengths") or [],
        }

        try:
            result = adapter_agent.adapt(payload)
        except Exception as e:
            raise OrchestratorError(
                code="adapter_failed",
                status=500,
                detail=str(e),
            )

        new_weeks = result.get("upcoming_weeks") or []
        if not new_weeks:
            return None

        # Drop existing upcoming rows; keep completed weeks intact.
        upcoming_ids = [w["id"] for w in upcoming]
        if upcoming_ids:
            self.db.table("curriculum_weeks").delete().in_(
                "id", upcoming_ids
            ).execute()

        rows_to_insert = []
        for w in new_weeks:
            wn = int(w.get("week_number") or 0)
            if wn <= current_week:
                # Skip any week numbers that overlap completed weeks —
                # respect the hard rule even if the model slipped.
                continue
            plan_json = {
                "week_number": wn,
                "title": w.get("title") or "",
                "objective": w.get("objective") or "",
                "modules": w.get("modules") or [],
                "milestone": w.get("milestone") or "",
                "daily_minutes": int(w.get("daily_minutes") or 20),
                "exercise_focus": w.get("exercise_focus") or [],
            }
            rows_to_insert.append({
                "curriculum_id": curriculum_id,
                "week_number": wn,
                "plan_json": plan_json,
                "status": "pending",
                "is_bonus": bool(w.get("is_bonus")),
            })

        if rows_to_insert:
            self.db.table("curriculum_weeks").insert(rows_to_insert).execute()

        # Bump replan_count + refresh plan_json's total_weeks.
        new_total = current_week + len(rows_to_insert)
        plan_overview = dict(plan_overview)
        plan_overview["total_weeks"] = new_total
        self.db.table("curricula").update({
            "replan_count": int(curriculum.get("replan_count") or 0) + 1,
            "plan_json": plan_overview,
        }).eq("id", curriculum_id).execute()

        return {
            "changed": True,
            "summary_note": result.get("summary_note") or "",
            "added_bonus_weeks": sum(
                1 for r in rows_to_insert if r.get("is_bonus")
            ),
            "rewritten_weeks": len(rows_to_insert),
            "total_weeks": new_total,
        }
