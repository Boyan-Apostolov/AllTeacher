"""Exercise Writer + Evaluator phase.

Owns the lifecycle of per-week exercise rows:

  - generate_exercises       → bank lookup + LLM top-up + per-user rows
  - submit_exercise          → store submission, score it, record weak areas
  - submit_exercise_stream   → same, but yields Evaluator partial snapshots
                               for the SSE endpoint (long-form short_answer
                               feedback rendered token-by-token on iOS)
  - _maybe_complete_week     → flip `curriculum_weeks.status` once everything
                               in the week has been evaluated

The Exercise Writer + Evaluator agents themselves stay pure; this mixin
owns the bank reads/writes, ownership checks, and the per-user bookkeeping.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Iterator

log = logging.getLogger(__name__)

from config import Config
from app.agents import evaluator, exercise_bank, exercise_writer, tracker
from app.services import media, usage_meter

from ._base import now_iso
from .errors import Conflict, NotFound, OrchestratorError
from .types import ExerciseEvalPayload, ExercisesPayload


# Tiers allowed to receive `listen_choice` exercises. TTS is real
# spend per character — gating to Pro+ keeps free users free-and-cheap.
_LISTEN_TIERS = {"pro", "power"}

# video_choice is gated on YOUTUBE_API_KEY being configured, not tier.
# (YouTube Data API v3 has a generous free quota — no tier split needed.)
def _youtube_configured() -> bool:
    from config import Config
    return bool(Config.YOUTUBE_API_KEY)

def _unsplash_configured() -> bool:
    from config import Config
    return bool(Config.UNSPLASH_ACCESS_KEY)


class _ExercisesMixin:
    """Provided by `_OrchestratorBase`: `db`, `_load_curriculum`,
    `_load_exercise`, `_resolve_week`. Provided by `_TrackerMixin`:
    `_run_adapter_if_eligible`.

    NOTE: do **not** add `def _load_curriculum(...): ...` style stubs here
    for type-checking — at runtime those bodies return None and shadow the
    real implementation on `_OrchestratorBase` because this mixin sits
    earlier in the MRO. If mypy needs hints, lean on `Protocol` + `cast`
    rather than declarative method bodies.
    """

    db: Any

    # ----- public methods -----

    def generate_exercises(
        self,
        *,
        user_id: str,
        curriculum_id: str,
        week_id: str | None = None,
        count: int = 5,
        module_index: int | None = None,
        focus_weak_areas: bool = False,
        tier: str = "free",
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

        If `module_index` is provided we skip the bank entirely and ask
        the writer to focus on that single planner module. This is the
        path used by the new lesson→exercises flow, where each batch is
        scoped to one concept and tagged with that module_index so the
        iOS session screen can reassemble the per-concept loop.

        If `focus_weak_areas` is True we ALSO skip the bank, drop the
        per-module focus, and tell the writer this is a bonus drill —
        every item targets one of the user's recent_weak_areas. The rows
        get module_index=null so the iOS session screen can flag them as
        bonus content rather than mixing them into the per-concept loop.
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

        # Resolve the focused module (if any). When the iOS session screen
        # is in per-concept mode, each call asks for exercises targeting
        # one specific planner module — we skip the cross-week bank then
        # so we don't return content tagged for a different module.
        modules = (week_plan.get("modules") or [])
        focused_module: dict[str, Any] | None = None
        if module_index is not None:
            if module_index < 0 or module_index >= len(modules):
                raise NotFound(code="module_index_out_of_range")
            focused_module = modules[module_index]

        # Bonus weak-area drill — generate-only path, never bank-cached
        # (the bank isn't keyed by per-user weak_areas tag sets so caching
        # would mismatch other users). Falls back to a normal week-focused
        # batch if the user has no recent_weak_areas yet.
        if focus_weak_areas and not recent_weak_areas:
            focus_weak_areas = False

        # 1. Bank lookup. Skipped when a module is explicitly requested —
        # the bank isn't keyed by module_index today. Also skipped for
        # bonus drills (per-user weak-area focus → bank wouldn't match).
        if focused_module is not None or focus_weak_areas:
            cached: list[dict[str, Any]] = []
        elif is_first_session:
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
        # When video is enabled and we're doing week-level generation
        # (no focused_module), reserve 1 slot for the LLM so the Writer
        # always has a chance to emit a video_choice exercise. Bank rows
        # are cached snapshots that predate the video_choice type and
        # will never contain one, so we cap bank usage at count-1.
        if (
            _youtube_configured()
            and focused_module is None
            and not focus_weak_areas
            and cached
            and len(cached) >= count
        ):
            cached = cached[:count - 1]

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

            # If we're focusing on one concept, bias the writer toward it
            # by handing it just that module + a derived focus list, so
            # every generated item drills the same idea instead of
            # spreading across the week.
            if focus_weak_areas:
                # Bonus drill — the writer should treat recent_weak_areas
                # as the focus list directly. We still pass the week's
                # modules for shape/level context but it's not the focus.
                writer_modules = week_plan.get("modules") or []
                writer_focus = list(recent_weak_areas)
            elif focused_module is not None:
                writer_modules = [focused_module]
                derived_focus = [
                    focused_module.get("title") or "",
                ] + list(week_plan.get("exercise_focus") or [])
                writer_focus = [t for t in derived_focus if t]
            else:
                writer_modules = week_plan.get("modules") or []
                writer_focus = week_plan.get("exercise_focus") or []

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
                "week_modules": writer_modules,
                "exercise_focus": writer_focus,
                "seen_titles": seen_titles,
                "recent_weak_areas": (
                    [] if is_first_session else recent_weak_areas
                ),
                "recent_avg_score": self._recent_avg_score(curriculum_id),
                "bonus_focus": bool(focus_weak_areas),
                # Audio listen_choice items are Pro+ only; tell the
                # writer up-front so it doesn't waste output tokens
                # emitting items that would just get dropped post-gen.
                "listening_enabled": tier in _LISTEN_TIERS,
                # video_choice items need the YouTube API key.
                "video_enabled": _youtube_configured(),
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
            bank_by_title: dict[str, str] = {}
            if (
                new_exercises
                and focused_module is None
                and not focus_weak_areas
            ):
                # Write back to the bank — but only for week-level
                # generations. Per-module and bonus-weak-area batches
                # stay per-user so the bank's (week_number, weak_areas)
                # keying isn't muddied with content tagged for one
                # specific module or one user's tag set.
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

        # 2.5 Multimodal post-processing — handles `listen_choice` rows
        # that arrived from either the bank or the writer. Two
        # responsibilities:
        #   (a) For Pro+ users with no cached audio_url on the row, run
        #       OpenAI TTS, upload to Storage, write the URL into
        #       `content_json.audio_url`. (Cache hits in `media.tts_to_url`
        #       mean re-running the same content text is free.)
        #   (b) For free users — drop listen_choice rows entirely. We'd
        #       rather give them fewer exercises than a broken silent
        #       listening card. This also drops bank hits whose audio_url
        #       happened to be cached from a previous Pro user.
        # If TTS fails for any individual row (network blip, missing
        # OPENAI_API_KEY in dev), drop that row too — silent listening
        # is worse than missing.
        delivered = self._materialise_audio(delivered, tier=tier)
        delivered = self._materialise_video(delivered)
        delivered = self._materialise_images(delivered, domain=domain)

        if not delivered:
            return {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "exercises": [],
            }

        # 3. Persist per-user rows pointing at the bank.
        # - Module-focused calls tag every row with the requested module_index.
        # - Bonus-weak-area calls store NULL so the iOS session screen can
        #   group them under a separate "bonus" panel rather than the
        #   per-concept loop.
        # - Otherwise we fall back to the in-batch ordinal (week-level mode).
        def _row_module_index(idx: int) -> int | None:
            if focus_weak_areas:
                return None
            if module_index is not None:
                return module_index
            return idx

        rows_to_insert = [
            {
                "curriculum_id": curriculum_id,
                "week_id": week_row["id"],
                "type": (content.get("type") or "short_answer"),
                "content_json": content,
                "module_index": _row_module_index(idx),
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
        tier: str = "free",
    ) -> ExerciseEvalPayload:
        """Persist the user's submission, dispatch the Evaluator, write the
        feedback back to the exercise row, return the verdict.

        `tier` controls whether the post-evaluator Adapter run fires —
        free users skip it silently (their submit still scores + writes
        back the feedback row in full)."""
        ex, curriculum, payload = self._prepare_evaluator_call(
            user_id=user_id,
            exercise_id=exercise_id,
            submission=submission,
        )

        try:
            result = evaluator.evaluate(payload)
        except Exception as e:
            raise OrchestratorError(
                code="evaluator_failed",
                status=500,
                detail=str(e),
            )

        return self._persist_evaluator_result(
            user_id=user_id,
            exercise=ex,
            curriculum=curriculum,
            result=result,
            tier=tier,
        )

    def submit_exercise_stream(
        self,
        *,
        user_id: str,
        exercise_id: str,
        submission: dict[str, Any],
        tier: str = "free",
    ) -> Iterator[dict[str, Any]]:
        """Streaming variant of :meth:`submit_exercise`.

        Used by the SSE endpoint so the iOS client can render the
        Evaluator's `feedback` and `gap` text token-by-token instead of
        waiting ~3-6s for the full structured response.

        Yield shapes:

        - ``{"kind": "delta", "snapshot": <partial parsed dict>}`` —
          repeated as the Evaluator's structured-output JSON is still
          materialising. The iOS client renders ``feedback`` and ``gap``
          live and waits to render ``score`` / ``verdict`` / tags until
          they land.
        - ``{"kind": "done", "result": <ExerciseEvalPayload>}`` — emitted
          exactly once after the stream closes. By the time this lands,
          the same persistence + tracker + adapter side-effects that
          ``submit_exercise`` performs have all run.

        Errors during streaming raise ``OrchestratorError`` so the route
        can convert them into ``event: error`` SSE frames the same way
        the non-streaming path returns them as JSON 5xxs.
        """
        ex, curriculum, payload = self._prepare_evaluator_call(
            user_id=user_id,
            exercise_id=exercise_id,
            submission=submission,
        )

        # The streaming SDK call is wrapped in our own try/except so a
        # mid-stream failure surfaces as the same `evaluator_failed`
        # OrchestratorError the non-streaming path raises. Without this
        # the route layer would see a raw OpenAIError and 500 with no
        # code the client can branch on.
        result: dict[str, Any] | None = None
        usage_obj: Any = None
        try:
            for event in evaluator.evaluate_stream(payload):
                if "snapshot" in event:
                    yield {"kind": "delta", "snapshot": event["snapshot"]}
                    continue
                if "final" in event:
                    result = event["final"]
                    usage_obj = event.get("usage")
        except OrchestratorError:
            raise
        except Exception as e:  # noqa: BLE001 — surface as orchestrator error
            raise OrchestratorError(
                code="evaluator_failed",
                status=500,
                detail=str(e),
            )

        if result is None:
            raise OrchestratorError(
                code="evaluator_failed",
                status=500,
                detail="streaming evaluator returned no final result",
            )

        # Record the call against the per-request usage scope opened in
        # `require_auth`. We can't have the agent itself call `record(...)`
        # like the non-streaming path does because `evaluate_stream` is a
        # generator and the caller decides when the stream actually
        # completes — the meter row should only land once the final
        # snapshot arrives. Best-effort, swallowed inside usage_meter.
        if usage_obj is not None:
            usage_meter.record(
                model=Config.OPENAI_MODEL,
                usage=usage_obj,
                agent="evaluator",
            )

        final_payload = self._persist_evaluator_result(
            user_id=user_id,
            exercise=ex,
            curriculum=curriculum,
            result=result,
            tier=tier,
        )
        yield {"kind": "done", "result": final_payload}

    # ----- shared evaluator helpers (used by both submit paths) -----

    def _prepare_evaluator_call(
        self,
        *,
        user_id: str,
        exercise_id: str,
        submission: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
        """Common prelude for `submit_exercise` and `submit_exercise_stream`.

        Loads + ownership-checks the exercise, ensures it isn't already
        scored, stashes the submission immediately (so a crash in the LLM
        call doesn't lose what the user typed), and builds the Evaluator
        payload — including the canonical-tag lists from the curriculum so
        the model can reuse existing weak_areas / strengths verbatim
        instead of coining near-duplicates.
        """
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
            # Canonical tag list — the evaluator is told to reuse these
            # verbatim when the same theme applies, so the FinishedView
            # "To revisit" recap doesn't accumulate near-duplicates like
            # "time management" / "time management strategies" / one tag
            # accidentally translated into the target_language.
            #
            # Sanitize before sending: replace underscores with spaces so
            # old snake_case tags (e.g. "goal_setting") don't get reused
            # verbatim and propagate the broken format.
            "existing_weak_areas": [
                t.replace("_", " ").strip()
                for t in (curriculum.get("recent_weak_areas") or [])
                if isinstance(t, str) and t.strip()
            ],
            "existing_strengths": [
                t.replace("_", " ").strip()
                for t in (curriculum.get("recent_strengths") or [])
                if isinstance(t, str) and t.strip()
            ],
        }
        return ex, curriculum, payload

    def _persist_evaluator_result(
        self,
        *,
        user_id: str,
        exercise: dict[str, Any],
        curriculum: dict[str, Any],
        result: dict[str, Any],
        tier: str = "free",
    ) -> ExerciseEvalPayload:
        """Common tail for `submit_exercise` and `submit_exercise_stream`:
        write the feedback back to the exercise row, roll weak_areas /
        strengths into the curriculum, complete the week if everything in
        it is evaluated, kick the Adapter (fail-soft), and assemble the
        ExerciseEvalPayload the client receives.

        Splitting this out keeps the streaming path in lockstep with the
        non-streaming one — both must execute the same side effects in the
        same order so tracker state stays consistent regardless of which
        endpoint the iOS client called.
        """
        exercise_id = exercise["id"]
        evaluated_at = now_iso()
        update_row = {
            "feedback_json": result,
            "score": result.get("score"),
            "status": "evaluated",
            "evaluated_at": evaluated_at,
        }
        self.db.table("exercises").update(update_row).eq(
            "id", exercise_id
        ).execute()

        # Roll the Evaluator's weak_areas + strengths into the curriculum.
        # Both are capped to the most recent K entries so adaptation tracks
        # recent performance, not history. Also bump last_active_at so the
        # tracker doesn't have to scan exercises just to know "did this
        # user practice today".
        curr_update: dict[str, Any] = {"last_active_at": evaluated_at}
        new_weak = result.get("weak_areas") or []
        if new_weak:
            curr_update["recent_weak_areas"] = (
                exercise_bank.merge_recent_weak_areas(
                    curriculum.get("recent_weak_areas") or [],
                    new_weak,
                )
            )
        new_strengths = result.get("strengths") or []
        if new_strengths:
            curr_update["recent_strengths"] = tracker.merge_recent_strengths(
                curriculum.get("recent_strengths") or [],
                new_strengths,
            )
        self.db.table("curricula").update(curr_update).eq(
            "id", curriculum["id"]
        ).execute()

        # If this was the last unfinished exercise in the week, flip the
        # parent curriculum_weeks row to status='complete'. That's what the
        # home progress bar and the per-course detail screen key off of to
        # show "session done".
        week_just_completed = self._maybe_complete_week(exercise.get("week_id"))

        # When a session just flipped complete, run the Adapter so the
        # upcoming weeks reflect what the user has actually demonstrated.
        # Fail-soft: an Adapter failure should never break the user's
        # submit response — they already got their feedback.
        if week_just_completed:
            try:
                # Re-load the curriculum so the Adapter sees the just-merged
                # weak_areas / strengths / last_active_at. Free users
                # silently no-op inside `_run_adapter_if_eligible` based
                # on tier — they still get scoring + tracker rollups.
                fresh = self._load_curriculum(curriculum["id"], user_id)
                self._run_adapter_if_eligible(fresh, tier=tier)
            except Exception:
                # Swallow — the Adapter is best-effort here. The user can
                # still re-trigger via the explicit re-plan endpoint.
                pass

        return {
            "id": exercise_id,
            "score": float(result.get("score") or 0.0),
            "verdict": result.get("verdict") or "reviewed",
            "feedback": result.get("feedback") or "",
            "gap": result.get("gap") or "",
            "weak_areas": result.get("weak_areas") or [],
            "strengths": result.get("strengths") or [],
            "next_focus": result.get("next_focus") or "",
            "status": "evaluated",
        }

    # ----- internals -----

    def _materialise_audio(
        self,
        delivered: list[tuple[dict[str, Any], str | None]],
        *,
        tier: str,
    ) -> list[tuple[dict[str, Any], str | None]]:
        """Tier-gate + TTS-hydrate `listen_choice` rows.

        Free users: every `listen_choice` row is dropped. Pro+ users:
        every row missing a usable `audio_url` gets one synthesised via
        OpenAI TTS (cached in Supabase Storage by content hash so repeat
        runs of the same audio_text don't re-spend). Rows that fail TTS
        are dropped on the floor — silent listening cards are worse than
        absent ones.

        Returns the filtered/hydrated `delivered` list in the same
        `(content, bank_id)` shape the caller expects.
        """
        listening_ok = tier in _LISTEN_TIERS
        out: list[tuple[dict[str, Any], str | None]] = []
        for content, bank_id in delivered:
            if (content.get("type") or "") != "listen_choice":
                out.append((content, bank_id))
                continue

            if not listening_ok:
                # Free user: drop. Don't backfill with a substitute —
                # generate_exercises will just deliver a shorter batch
                # this round.
                continue

            existing_url = content.get("audio_url")
            if existing_url:
                # Bank hit with a previously-cached URL. Trust it (the
                # bucket is content-addressed, so the file is still
                # there or a future TTS regen will overwrite to the
                # same key).
                out.append((content, bank_id))
                continue

            audio_text = (content.get("audio_text") or "").strip()
            if not audio_text:
                # Writer emitted a listen_choice with no text — nothing
                # to synthesise. Drop.
                continue

            language = content.get("language") or None
            url = media.tts_to_url(audio_text, language=language)
            if not url:
                # TTS failed (no API key, network blip, storage
                # permission). Drop the row; the user will get one
                # fewer exercise in this batch.
                continue

            # Mutate the content dict so the URL persists into the DB
            # row's content_json. The bank_id (when set) points at a
            # row whose own content_json now lacks audio_url — the next
            # delivery for that bank row will re-fill via the cache hit
            # path above (URL is content-deterministic, no extra cost).
            content["audio_url"] = url
            out.append((content, bank_id))
        return out

    def _materialise_video(
        self,
        delivered: list[tuple[dict[str, Any], str | None]],
    ) -> list[tuple[dict[str, Any], str | None]]:
        """Resolve YouTube embed URLs for `video_choice` rows.

        If YOUTUBE_API_KEY is not configured, drops all video_choice rows
        (they'd render as empty / broken without a URL).  On success the
        orchestrator stores `video_url` in content_json so the iOS
        VideoChoice component has a stable embed URL.

        Rows that fail the YouTube search are dropped — an exercise with
        no video is worse than one fewer exercise.
        """
        if not _youtube_configured():
            return [(c, b) for c, b in delivered if c.get("type") != "video_choice"]

        out: list[tuple[dict[str, Any], str | None]] = []
        for content, bank_id in delivered:
            if (content.get("type") or "") != "video_choice":
                out.append((content, bank_id))
                continue

            # Already resolved (bank hit with a previously-stored URL).
            if content.get("video_url"):
                out.append((content, bank_id))
                continue

            query = (content.get("video_query") or "").strip()
            if not query:
                continue  # Writer emitted video_choice with no query — drop.

            url = media.youtube_search_url(query)
            if not url:
                continue  # Search failed or returned no results — drop.

            content["video_url"] = url
            out.append((content, bank_id))
        return out

    def _materialise_images(
        self,
        delivered: list[tuple[dict[str, Any], str | None]],
        *,
        domain: str = "",
    ) -> list[tuple[dict[str, Any], str | None]]:
        """Resolve Unsplash photo URLs for every exercise that could
        benefit from one.

        Priority order for the query:
          1. `image_query` — explicit query from the Writer (most precise)
          2. exercise title + domain — derived fallback so bank-cached
             exercises (generated before the image_query field existed)
             still get photos without needing regeneration.

        Skip types where images rarely add value:
          - `video_choice`: the video is already the visual centrepiece.
          - `flashcard`: minimal card, image would clutter.

        A missing image is never fatal — the exercise is kept regardless;
        we simply omit `image_url` when Unsplash is unconfigured or fails.
        """
        if not _unsplash_configured():
            log.info("_materialise_images: Unsplash not configured, skipping")
            return delivered

        log.info(
            "_materialise_images: processing %d exercises, domain=%r",
            len(delivered), domain,
        )

        _SKIP_IMAGE_TYPES = {"video_choice", "flashcard"}

        out: list[tuple[dict[str, Any], str | None]] = []
        for content, bank_id in delivered:
            ex_type = content.get("type") or ""
            if ex_type not in _SKIP_IMAGE_TYPES and not content.get("image_url"):
                # Priority 1: Writer-provided image_query (most precise)
                query = (content.get("image_query") or "").strip()

                # Priority 2: title (+ domain when title is short)
                if not query:
                    title = (content.get("title") or "").strip()
                    if title:
                        query = (
                            f"{title} {domain}".strip()
                            if domain and len(title.split()) <= 3
                            else title
                        )

                # Priority 3: for vocabulary MCQ the word being tested is
                # often quoted in the prompt — extract it as the image subject.
                if not query and ex_type == "multiple_choice":
                    prompt_text = (content.get("prompt") or "").strip()
                    # Match a word/phrase in straight quotes: 'apple' or "beach"
                    m = re.search(
                        r"[\x27\x22]([^\x27\x22]{2,30})[\x27\x22]",
                        prompt_text,
                    )
                    if m:
                        extracted = m.group(1).strip()
                        if extracted and len(extracted.split()) <= 4:
                            query = extracted

                log.info(
                    "  [%s] title=%r  query=%r  has_image_query=%r",
                    ex_type,
                    content.get("title"),
                    query,
                    bool(content.get("image_query")),
                )

                if query:
                    url = media.unsplash_photo_url(query)
                    log.info("    unsplash result: %s", url[:60] if url else "None")
                    if url:
                        content["image_url"] = url
            out.append((content, bank_id))
        return out

    def _recent_avg_score(
        self,
        curriculum_id: str,
        window: int = 12,
    ) -> float | None:
        """Average score across the user's most recent evaluated exercises
        in this curriculum. Returns None if they haven't submitted any yet.

        Used as the `recent_avg_score` input to the Exercise Writer +
        Explainer so future content adapts to recent performance — implicit
        re-leveling without making the user retake the full Assessor."""
        rows = (
            self.db.table("exercises")
            .select("score,evaluated_at")
            .eq("curriculum_id", curriculum_id)
            .eq("status", "evaluated")
            .order("evaluated_at", desc=True)
            .limit(window)
            .execute()
        ).data or []
        scored = [
            float(r["score"]) for r in rows
            if r.get("score") is not None
        ]
        if not scored:
            return None
        return sum(scored) / len(scored)

    def _maybe_complete_week(self, week_id: str | None) -> bool:
        """Mark a curriculum_weeks row complete once every exercise in it
        has been evaluated. Idempotent — returns True only when this call
        flipped the status from non-complete to 'complete' (so the caller
        can fire one-shot side effects like running the Adapter)."""
        if not week_id:
            return False
        rows = (
            self.db.table("exercises")
            .select("status")
            .eq("week_id", week_id)
            .execute()
        ).data or []
        if not rows:
            return False
        if any(r.get("status") not in ("evaluated", "skipped") for r in rows):
            return False

        # Read the current status so we can detect a flip vs a no-op.
        current = (
            self.db.table("curriculum_weeks")
            .select("status")
            .eq("id", week_id)
            .single()
            .execute()
        ).data or {}
        if current.get("status") == "complete":
            return False

        self.db.table("curriculum_weeks").update(
            {"status": "complete"}
        ).eq("id", week_id).execute()
        return True
