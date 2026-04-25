"""Master Orchestrator agent.

The Orchestrator is the only thing routes import from `app.agents`. It owns
the curriculum lifecycle and dispatches the appropriate subagent for each
high-level intent:

  - start_curriculum            → Assessor (first question)
  - submit_assessor_answer      → Assessor (next question / final summary)
  - generate_plan               → Planner
  - generate_exercises          → Exercise Writer
  - submit_exercise             → Evaluator (single submission scoring)
  - (future) tracker / adapter  → re-plan based on accumulated feedback

Subagents (`assessor`, `planner`, …) stay pure: they take structured input
and return structured output, no DB or HTTP. The Orchestrator owns the
Supabase reads/writes and the conditional logic between agents.

State machine on `curricula`:

       new ──[start_curriculum]──▶ assessor_status='in_progress'
                                          │
                              [submit_assessor_answer]*
                                          │
                                          ▼
                                 assessor_status='complete'
                                          │
                                  [generate_plan]
                                          │
                                          ▼
                                 planner_status='complete'
                                          │
                                  (Exercise Writer, Evaluator,
                                   Tracker, Adapter — TBD)

This module is intentionally not async — Flask routes are sync today. We
can swap to async later without touching route code.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, TypedDict

from app.agents import assessor, planner, exercise_writer, evaluator


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- error types ---

class OrchestratorError(Exception):
    """Base class for orchestrator failures. `status` is an HTTP code hint."""

    status: int = 500
    code: str = "orchestrator_error"

    def __init__(
        self,
        code: str | None = None,
        status: int | None = None,
        detail: str | None = None,
    ):
        if code is not None:
            self.code = code
        if status is not None:
            self.status = status
        super().__init__(detail or self.code)


class NotFound(OrchestratorError):
    status = 404
    code = "not_found"


class Conflict(OrchestratorError):
    status = 409


class BadAgentResponse(OrchestratorError):
    status = 500
    code = "bad_agent_response"


# --- response shapes (mirrors what routes serialize) ---

class AssessorStepPayload(TypedDict, total=False):
    id: str
    next: dict[str, Any] | None        # {"question": "...", "options": [...]}
    complete: dict[str, Any] | None    # full Assessor summary


class PlanPayload(TypedDict):
    id: str
    plan: dict[str, Any]
    weeks: list[dict[str, Any]]


class ExercisesPayload(TypedDict):
    curriculum_id: str
    week_id: str | None
    exercises: list[dict[str, Any]]


class ExerciseEvalPayload(TypedDict):
    id: str
    score: float
    verdict: str
    feedback: str
    weak_areas: list[str]
    next_focus: str
    status: str


# --- orchestrator ---

class Orchestrator:
    """Stateless object built per-request — pass the Supabase client in."""

    def __init__(self, db):
        self.db = db

    # ----- curriculum lifecycle -----

    def start_curriculum(
        self,
        *,
        user_id: str,
        goal: str,
        native_language: str,
    ) -> AssessorStepPayload:
        """Create the curriculum row and run the Assessor's first step."""
        insert = (
            self.db.table("curricula")
            .insert({
                "user_id": user_id,
                "topic": goal[:200],   # placeholder — Planner refines later
                "goal": goal,
                "native_language": native_language,
                "assessor_status": "in_progress",
                "assessment_json": {"transcript": []},
            })
            .execute()
        )
        row = insert.data[0]
        result = assessor.step(
            goal=goal,
            native_language=native_language,
            transcript=[],
        )
        return self._apply_assessor_step(
            curriculum_id=row["id"],
            transcript=[],
            result=result,
        )

    def submit_assessor_answer(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        answer: str,
    ) -> AssessorStepPayload:
        row = self._load_curriculum(curriculum_id, user_id)
        if row.get("assessor_status") == "complete":
            raise Conflict(code="assessor_already_complete")

        transcript = (row.get("assessment_json") or {}).get("transcript", [])
        if not transcript or transcript[-1].get("answer") is not None:
            raise Conflict(code="no_pending_question")

        # Fill the pending question with the user's answer.
        transcript[-1]["answer"] = answer

        result = assessor.step(
            goal=row.get("goal") or row.get("topic") or "",
            native_language=row.get("native_language") or "en",
            transcript=transcript,
        )
        return self._apply_assessor_step(
            curriculum_id=curriculum_id,
            transcript=transcript,
            result=result,
        )

    def generate_plan(
        self,
        *,
        user_id: str,
        curriculum_id: str,
    ) -> PlanPayload:
        row = self._load_curriculum(curriculum_id, user_id)
        if row.get("assessor_status") != "complete":
            raise Conflict(code="assessor_not_complete")

        summary = (row.get("assessment_json") or {}).get("summary") or {}
        payload = {
            "goal": row.get("goal") or row.get("topic") or "",
            "native_language": row.get("native_language") or "en",
            "domain": row.get("domain") or summary.get("domain"),
            "level": row.get("level") or summary.get("level"),
            "learning_style": row.get("learning_style")
                or summary.get("learning_style"),
            "time_budget_mins_per_day": row.get("time_budget_mins_per_day")
                or summary.get("time_budget_mins_per_day"),
            "target_language": row.get("target_language")
                or summary.get("target_language"),
            "notes": summary.get("notes") or "",
        }

        # Mark in_progress for visibility while the agent runs.
        self.db.table("curricula").update({
            "planner_status": "in_progress",
        }).eq("id", curriculum_id).execute()

        try:
            result = planner.plan(payload)
        except Exception as e:
            self.db.table("curricula").update({
                "planner_status": "pending",
            }).eq("id", curriculum_id).execute()
            raise OrchestratorError(
                code="planner_failed",
                status=500,
                detail=str(e),
            )

        return self._persist_plan(curriculum_id, result)

    # ----- exercises (Exercise Writer + Evaluator) -----

    def generate_exercises(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        week_id: str | None = None,
        count: int = 5,
    ) -> ExercisesPayload:
        """Run the Exercise Writer for one week (or the first pending week
        if `week_id` is None) and persist the new exercise rows.

        Returns the newly inserted exercises with their generated DB ids.
        Existing pending/submitted/evaluated exercises for that week are
        preserved — the new ones are appended."""
        row = self._load_curriculum(curriculum_id, user_id)
        if row.get("planner_status") != "complete":
            raise Conflict(code="planner_not_complete")

        # Pick the target week.
        week_row = self._resolve_week(curriculum_id, week_id)
        if week_row is None:
            raise NotFound(code="week_not_found")

        week_plan = week_row.get("plan_json") or {}
        summary = (row.get("assessment_json") or {}).get("summary") or {}

        # Pull every prior exercise title for this curriculum_id so the
        # Exercise Writer can dedupe. We over-include (whole curriculum,
        # not just this week) because cross-week duplicates are also bad.
        prior = (
            self.db.table("exercises")
            .select("content_json")
            .eq("curriculum_id", curriculum_id)
            .execute()
        ).data or []
        seen_titles = [
            (e.get("content_json") or {}).get("title")
            for e in prior
            if (e.get("content_json") or {}).get("title")
        ]

        payload = {
            "goal": row.get("goal") or row.get("topic") or "",
            "native_language": row.get("native_language") or "en",
            "target_language": row.get("target_language")
                or summary.get("target_language"),
            "domain": row.get("domain") or summary.get("domain") or "",
            "level": row.get("level") or summary.get("level") or "beginner",
            "learning_style": row.get("learning_style")
                or summary.get("learning_style") or "mixed",
            "week_number": int(week_plan.get("week_number")
                or week_row.get("week_number") or 1),
            "week_title": week_plan.get("title") or "",
            "week_objective": week_plan.get("objective") or "",
            "week_modules": week_plan.get("modules") or [],
            "exercise_focus": week_plan.get("exercise_focus") or [],
            "seen_titles": seen_titles,
            "count": int(count),
        }

        try:
            result = exercise_writer.write_batch(payload)
        except Exception as e:
            raise OrchestratorError(
                code="exercise_writer_failed",
                status=500,
                detail=str(e),
            )

        exercises = result.get("exercises") or []
        if not exercises:
            return {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "exercises": [],
            }

        rows_to_insert = [
            {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "type": ex.get("type") or "short_answer",
                "content_json": ex,
                "module_index": idx,
                "status": "pending",
                "seen": False,
            }
            for idx, ex in enumerate(exercises)
        ]
        inserted = (
            self.db.table("exercises")
            .insert(rows_to_insert)
            .execute()
        ).data or []

        return {
            "curriculum_id": curriculum_id,
            "week_id": week_row["id"],
            "exercises": inserted,
        }

    def submit_exercise(
        self,
        *,
        user_id: str,
        exercise_id: str,
        submission: dict[str, Any],
    ) -> ExerciseEvalPayload:
        """Persist the user's submission, dispatch the Evaluator, write the
        feedback back to the exercise row, return the verdict."""
        ex = self._load_exercise(exercise_id, user_id)
        if ex.get("status") == "evaluated":
            raise Conflict(code="exercise_already_evaluated")

        curriculum = self._load_curriculum(ex["curriculum_id"], user_id)
        summary = (curriculum.get("assessment_json") or {}).get("summary") or {}

        # Stash the submission immediately (status=submitted) so a crash in
        # the Evaluator call doesn't lose what the user typed.
        self.db.table("exercises").update({
            "submission_json": submission,
            "status": "submitted",
            "seen": True,
        }).eq("id", exercise_id).execute()

        payload = {
            "native_language": curriculum.get("native_language") or "en",
            "target_language": curriculum.get("target_language")
                or summary.get("target_language"),
            "domain": curriculum.get("domain") or summary.get("domain") or "",
            "level": curriculum.get("level") or summary.get("level") or "beginner",
            "feedback_preference": (summary.get("notes") or None),
            "exercise": ex.get("content_json") or {},
            "submission": submission,
        }

        try:
            result = evaluator.evaluate(payload)
        except Exception as e:
            raise OrchestratorError(
                code="evaluator_failed",
                status=500,
                detail=str(e),
            )

        update_row = {
            "feedback_json": result,
            "score": result.get("score"),
            "status": "evaluated",
            "evaluated_at": _now_iso(),
        }
        self.db.table("exercises").update(update_row).eq(
            "id", exercise_id
        ).execute()

        return {
            "id": exercise_id,
            "score": float(result.get("score") or 0.0),
            "verdict": result.get("verdict") or "reviewed",
            "feedback": result.get("feedback") or "",
            "weak_areas": result.get("weak_areas") or [],
            "next_focus": result.get("next_focus") or "",
            "status": "evaluated",
        }

    # ----- internals -----

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
        """Loads an exercise row and verifies it belongs to a curriculum the
        user owns. Raises NotFound otherwise."""
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
        """Returns the curriculum_weeks row for `week_id`, or — if None —
        the lowest-numbered week_row that isn't yet 'complete'."""
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

    def _apply_assessor_step(
        self,
        *,
        curriculum_id: str,
        transcript: list[dict[str, Any]],
        result: dict[str, Any],
    ) -> AssessorStepPayload:
        kind = result.get("kind")

        if kind == "question":
            q = result.get("question") or {}
            text = q.get("text") or ""
            options = q.get("options") or []
            new_transcript = transcript + [{
                "question": text,
                "options": options,
                "answer": None,
            }]
            self.db.table("curricula").update({
                "assessment_json": {"transcript": new_transcript},
                "assessor_status": "in_progress",
            }).eq("id", curriculum_id).execute()
            return {
                "id": curriculum_id,
                "next": {"question": text, "options": options},
                "complete": None,
            }

        if kind == "complete":
            summary = result.get("summary") or {}
            self.db.table("curricula").update({
                "assessment_json": {"transcript": transcript, "summary": summary},
                "assessor_status": "complete",
                "domain": summary.get("domain"),
                "level": summary.get("level"),
                "learning_style": summary.get("learning_style"),
                "time_budget_mins_per_day": summary.get("time_budget_mins_per_day"),
                "target_language": summary.get("target_language"),
            }).eq("id", curriculum_id).execute()
            return {
                "id": curriculum_id,
                "next": None,
                "complete": summary,
            }

        raise BadAgentResponse(detail=f"unexpected assessor kind={kind!r}")

    def _persist_plan(
        self,
        curriculum_id: str,
        result: dict[str, Any],
    ) -> PlanPayload:
        weeks = result.get("weeks") or []
        overview = {
            "title": result.get("title"),
            "summary_for_user": result.get("summary_for_user"),
            "total_weeks": result.get("total_weeks") or len(weeks),
            "phases": result.get("phases") or [],
        }

        # Wipe any prior weeks for this curriculum and re-insert.
        self.db.table("curriculum_weeks").delete().eq(
            "curriculum_id", curriculum_id
        ).execute()

        if weeks:
            rows_to_insert = [
                {
                    "curriculum_id": curriculum_id,
                    "week_number": int(w.get("week_number") or (i + 1)),
                    "plan_json": w,
                    "status": "pending",
                }
                for i, w in enumerate(weeks)
            ]
            self.db.table("curriculum_weeks").insert(rows_to_insert).execute()

        # Refine the topic title to the planner's nicer one.
        title = (overview.get("title") or "")[:200]
        update: dict[str, Any] = {
            "plan_json": overview,
            "planner_status": "complete",
        }
        if title:
            update["topic"] = title
        self.db.table("curricula").update(update).eq(
            "id", curriculum_id
        ).execute()

        return {
            "id": curriculum_id,
            "plan": overview,
            "weeks": weeks,
        }
