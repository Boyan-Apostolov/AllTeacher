"""Exercise Writer + Evaluator phase.

Owns the lifecycle of per-week exercise rows:

  - generate_exercises   → bank lookup + LLM top-up + per-user rows
  - submit_exercise      → store submission, score it, record weak areas
  - _maybe_complete_week → flip `curriculum_weeks.status` once everything
                           in the week has been evaluated

The Exercise Writer + Evaluator agents themselves stay pure; this mixin
owns the bank reads/writes, ownership checks, and the per-user bookkeeping.
"""
from __future__ import annotations

from typing import Any

from app.agents import evaluator, exercise_bank, exercise_writer

from ._base import now_iso
from .errors import Conflict, NotFound, OrchestratorError
from .types import ExerciseEvalPayload, ExercisesPayload


class _ExercisesMixin:
    """Provided by `_OrchestratorBase`: `db`, `_load_curriculum`,
    `_load_exercise`, `_resolve_week`."""

    db: Any

    def _load_curriculum(  # type: ignore[empty-body]
        self, curriculum_id: str, user_id: str
    ) -> dict[str, Any]: ...
    def _load_exercise(  # type: ignore[empty-body]
        self, exercise_id: str, user_id: str
    ) -> dict[str, Any]: ...
    def _resolve_week(  # type: ignore[empty-body]
        self, curriculum_id: str, week_id: str | None
    ) -> dict[str, Any] | None: ...

    # ----- public methods -----

    def generate_exercises(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        week_id: str | None = None,
        count: int = 5,
    ) -> ExercisesPayload:
        """Materialise one session worth of exercises for a week.

        Source-of-truth flow:
          1. Look up the global Exercise Bank by the right key. The first
             session of any curriculum is keyed by (domain, level,
             target_language) with is_first_session=True — same content
             for every user. Follow-up sessions are keyed by
             (domain, level, target_language, week_number) with weak_areas
             ranking, so adaptation comes from picking which cached
             exercises best target the user's recent struggles.
          2. If the bank has fewer rows than `count`, ask the Exercise
             Writer to fill the gap. Anything new is written back to the
             bank so the next user in the same bucket gets a cache hit
             instead of an LLM call.
          3. Each delivered exercise gets a per-user `exercises` row
             pointing back at its `bank_id` so submission stats stay
             scoped to the user but the content stays shared.
        """
        row = self._load_curriculum(curriculum_id, user_id)
        if row.get("planner_status") != "complete":
            raise Conflict(code="planner_not_complete")

        # Pick the target week.
        week_row = self._resolve_week(curriculum_id, week_id)
        if week_row is None:
            raise NotFound(code="week_not_found")

        week_plan = week_row.get("plan_json") or {}
        summary = (row.get("assessment_json") or {}).get("summary") or {}

        domain = row.get("domain") or summary.get("domain") or ""
        level = row.get("level") or summary.get("level") or "beginner"
        target_language = (
            row.get("target_language") or summary.get("target_language")
        )
        week_number = int(
            week_plan.get("week_number")
            or week_row.get("week_number")
            or 1
        )
        is_first_session = week_number == 1
        recent_weak_areas: list[str] = list(
            row.get("recent_weak_areas") or []
        )

        # 1. Bank lookup.
        if is_first_session:
            cached = exercise_bank.find_first_session(
                self.db,
                domain=domain,
                level=level,
                target_language=target_language,
                count=count,
            )
        else:
            cached = exercise_bank.find_for_week(
                self.db,
                domain=domain,
                level=level,
                target_language=target_language,
                week_number=week_number,
                weak_areas=recent_weak_areas,
                count=count,
            )

        # 2. Top up with the LLM if the bank is short.
        delivered: list[tuple[dict[str, Any], str | None]] = [
            (b.get("content_json") or {}, b.get("id")) for b in cached
        ]
        missing = max(0, count - len(delivered))

        if missing > 0:
            # Dedupe inside this curriculum AND against bank titles we
            # already pulled — the writer should pick fresh content.
            prior = (
                self.db.table("exercises")
                .select("content_json")
                .eq("curriculum_id", curriculum_id)
                .execute()
            ).data or []
            seen_titles: list[str] = [
                (e.get("content_json") or {}).get("title")
                for e in prior
                if (e.get("content_json") or {}).get("title")
            ]
            for c, _ in delivered:
                t = c.get("title")
                if t:
                    seen_titles.append(t)

            payload = {
                "goal": row.get("goal") or row.get("topic") or "",
                "native_language": row.get("native_language") or "en",
                "target_language": target_language,
                "domain": domain,
                "level": level,
                "learning_style": row.get("learning_style")
                    or summary.get("learning_style") or "mixed",
                "week_number": week_number,
                "week_title": week_plan.get("title") or "",
                "week_objective": week_plan.get("objective") or "",
                "week_modules": week_plan.get("modules") or [],
                "exercise_focus": week_plan.get("exercise_focus") or [],
                "seen_titles": seen_titles,
                "recent_weak_areas": (
                    [] if is_first_session else recent_weak_areas
                ),
                "count": int(missing),
            }

            try:
                result = exercise_writer.write_batch(payload)
            except Exception as e:
                # If the bank already covered some of the count we still
                # want to deliver them rather than 500 the user.
                if not delivered:
                    raise OrchestratorError(
                        code="exercise_writer_failed",
                        status=500,
                        detail=str(e),
                    )
                result = {"exercises": []}

            new_exercises = result.get("exercises") or []
            if new_exercises:
                # Write back to the bank.
                bank_rows = exercise_bank.save_batch(
                    self.db,
                    exercises=new_exercises,
                    domain=domain,
                    level=level,
                    target_language=target_language,
                    week_number=None if is_first_session else week_number,
                    is_first_session=is_first_session,
                    weak_areas=(
                        [] if is_first_session else recent_weak_areas
                    ),
                    exercise_focus=week_plan.get("exercise_focus") or [],
                )
                # Map content → bank id for the rows we successfully
                # inserted (some may have been swallowed as duplicates).
                bank_by_title: dict[str, str] = {}
                for br in bank_rows:
                    title = (br.get("content_json") or {}).get(
                        "title"
                    ) or br.get("title")
                    if title and br.get("id"):
                        bank_by_title[title] = br["id"]

                for ex in new_exercises:
                    delivered.append(
                        (ex, bank_by_title.get(ex.get("title") or ""))
                    )

        if not delivered:
            return {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "exercises": [],
            }

        # 3. Persist per-user rows pointing at the bank.
        rows_to_insert = [
            {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "type": (content.get("type") or "short_answer"),
                "content_json": content,
                "module_index": idx,
                "status": "pending",
                "seen": False,
                "bank_id": bank_id,
            }
            for idx, (content, bank_id) in enumerate(delivered[:count])
        ]
        inserted = (
            self.db.table("exercises")
            .insert(rows_to_insert)
            .execute()
        ).data or []

        # Bookkeeping — bump usage on the bank rows we delivered.
        exercise_bank.bump_usage(
            self.db,
            (bid for _, bid in delivered[:count] if bid),
        )

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
            "evaluated_at": now_iso(),
        }
        self.db.table("exercises").update(update_row).eq(
            "id", exercise_id
        ).execute()

        # Roll the Evaluator's weak_areas into the curriculum so the next
        # session's bank lookup can target them. Capped to the most recent
        # K entries so adaptation tracks recent performance, not history.
        new_weak = result.get("weak_areas") or []
        if new_weak:
            merged = exercise_bank.merge_recent_weak_areas(
                curriculum.get("recent_weak_areas") or [],
                new_weak,
            )
            self.db.table("curricula").update(
                {"recent_weak_areas": merged}
            ).eq("id", curriculum["id"]).execute()

        # If this was the last unfinished exercise in the week, flip the
        # parent curriculum_weeks row to status='complete'. That's what the
        # home progress bar and the per-course detail screen key off of to
        # show "session done".
        self._maybe_complete_week(ex.get("week_id"))

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

    def _maybe_complete_week(self, week_id: str | None) -> None:
        """Mark a curriculum_weeks row complete once every exercise in it has
        been evaluated. Idempotent; no-op if week_id is missing or the week
        still has pending/submitted exercises."""
        if not week_id:
            return
        rows = (
            self.db.table("exercises")
            .select("status")
            .eq("week_id", week_id)
            .execute()
        ).data or []
        if not rows:
            return
        if any(r.get("status") not in ("evaluated", "skipped") for r in rows):
            return
        self.db.table("curriculum_weeks").update(
            {"status": "complete"}
        ).eq("id", week_id).execute()
