"""Curriculum routes — thin HTTP layer over the master Orchestrator.

Routes never call subagents directly. They translate HTTP into orchestrator
intents, and translate orchestrator results / errors back into HTTP. Domain
logic lives in `app.agents.orchestrator`.

POST   /curriculum                        create curriculum + kick off Assessor
GET    /curriculum                        list user's curricula
GET    /curriculum/progress               dashboard summary (across all rows)
GET    /curriculum/<id>                   fetch curriculum state
GET    /curriculum/<id>/progress          per-curriculum drilldown
POST   /curriculum/<id>/replan            explicit Adapter re-plan
DELETE /curriculum/<id>                   delete curriculum
POST   /curriculum/<id>/assessor          submit an answer, get next Q or summary
POST   /curriculum/<id>/plan              run Planner, persist plan + week rows
GET    /curriculum/<id>/weeks             list curriculum_weeks rows
POST   /curriculum/<id>/lessons           run Explainer for one module (cached)
GET    /curriculum/<id>/lessons           list lessons (filtered by week_id)
POST   /curriculum/lessons/<lid>/seen     mark a lesson as seen
POST   /curriculum/<id>/exercises         run Exercise Writer for a given week
GET    /curriculum/<id>/exercises         list exercises (filtered by week_id)
POST   /curriculum/exercises/<eid>/submit run Evaluator on a submission
POST   /curriculum/exercises/<eid>/submit/stream
                                          run Evaluator and stream feedback
                                          tokens back as Server-Sent Events
"""
import json
import logging

from flask import Blueprint, Response, jsonify, g, request, stream_with_context

from app.middleware.auth import require_auth
from app.db.supabase import service_client
from app.agents.orchestrator import Orchestrator, OrchestratorError

log = logging.getLogger(__name__)

bp = Blueprint("curriculum", __name__, url_prefix="/curriculum")


def _db():
    c = service_client()
    if c is None:
        raise RuntimeError("Supabase service client not configured")
    return c


def _orch() -> Orchestrator:
    return Orchestrator(_db())


def _orch_error(e: OrchestratorError):
    return jsonify({"error": e.code, "detail": str(e)}), e.status


# ---------- agent-driven endpoints (delegate to Orchestrator) ----------

@bp.post("")
@require_auth
def create():
    """Body: {goal: str, native_language?: str}
    Returns: {id, next: {question, options} | null, complete: {summary} | null}
    """
    body = request.get_json(silent=True) or {}
    goal = (body.get("goal") or "").strip()
    native_language = (body.get("native_language") or "en").strip()
    if not goal:
        return jsonify({"error": "goal_required"}), 400

    try:
        payload = _orch().start_curriculum(
            user_id=g.user_id,
            goal=goal,
            native_language=native_language,
            tier=getattr(g, "user_tier", "free"),
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/<curriculum_id>/assessor")
@require_auth
def assessor_answer(curriculum_id):
    """Body: {answer: str}
    Returns: {id, next: {question, options} | null, complete: {summary} | null}
    """
    body = request.get_json(silent=True) or {}
    answer = (body.get("answer") or "").strip()
    if not answer:
        return jsonify({"error": "answer_required"}), 400

    try:
        payload = _orch().submit_assessor_answer(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            answer=answer,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/<curriculum_id>/plan")
@require_auth
def generate_plan(curriculum_id):
    """Run the Planner against the persisted Assessor summary.
    Returns: {id, plan: {...top-level...}, weeks: [{...per-week...}]}
    """
    try:
        payload = _orch().generate_plan(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/<curriculum_id>/lessons")
@require_auth
def generate_lesson(curriculum_id):
    """Body: {week_id?: str, module_index?: int}
    Returns the lesson row for one (week, module). Cached — repeat calls
    for the same module return the same row without an LLM hit. If
    `module_index` is omitted, returns the next module the user hasn't
    yet marked seen.
    """
    body = request.get_json(silent=True) or {}
    week_id = body.get("week_id") or None
    raw_idx = body.get("module_index")
    if raw_idx is None or raw_idx == "":
        module_index = None
    else:
        try:
            module_index = int(raw_idx)
        except (TypeError, ValueError):
            return jsonify({"error": "module_index_invalid"}), 400

    try:
        payload = _orch().generate_lesson(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            week_id=week_id,
            module_index=module_index,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.get("/<curriculum_id>/lessons")
@require_auth
def list_lessons(curriculum_id):
    """Query: ?week_id=<uuid> filters to one week.
    Returns: {lessons: [...]}
    """
    week_id = request.args.get("week_id") or None
    try:
        rows = _orch().list_lessons(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            week_id=week_id,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify({"lessons": rows}), 200


@bp.post("/lessons/<lesson_id>/seen")
@require_auth
def mark_lesson_seen(lesson_id):
    """Idempotent — flips the lesson's status to 'seen' and stamps seen_at
    on the first call. Returns the updated lesson row."""
    try:
        payload = _orch().mark_lesson_seen(
            user_id=g.user_id,
            lesson_id=lesson_id,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/<curriculum_id>/exercises")
@require_auth
def generate_exercises(curriculum_id):
    """Body: {week_id?: str, count?: int, module_index?: int,
              focus_weak_areas?: bool}

    Runs the Exercise Writer for one week and persists the new exercises.

    - `module_index` focuses the batch on a single planner module
      (the lesson→exercises flow does this so each batch drills the
      concept the user just read about).
    - `focus_weak_areas` runs a bonus drill: every item targets one of
      the user's recent_weak_areas tags. Rows are inserted with
      module_index=null so the iOS session screen can group them under
      a separate "bonus" panel.

    Returns: {curriculum_id, week_id, exercises: [...]}
    """
    body = request.get_json(silent=True) or {}
    week_id = body.get("week_id") or None
    try:
        count = int(body.get("count") or 5)
    except (TypeError, ValueError):
        count = 5
    count = max(1, min(8, count))

    raw_idx = body.get("module_index")
    if raw_idx is None or raw_idx == "":
        module_index = None
    else:
        try:
            module_index = int(raw_idx)
        except (TypeError, ValueError):
            return jsonify({"error": "module_index_invalid"}), 400

    focus_weak_areas = bool(body.get("focus_weak_areas") or False)

    try:
        payload = _orch().generate_exercises(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            week_id=week_id,
            count=count,
            module_index=module_index,
            focus_weak_areas=focus_weak_areas,
            # Tier gates `listen_choice` rows — Pro+ get TTS-hydrated
            # audio, free users have those rows dropped (see
            # `_materialise_audio` in the orchestrator).
            tier=getattr(g, "user_tier", "free"),
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/exercises/<exercise_id>/submit")
@require_auth
def submit_exercise(exercise_id):
    """Body: {submission: {...}} — shape depends on exercise type.
    Runs the Evaluator and persists feedback.
    Returns: {id, score, verdict, feedback, weak_areas, next_focus, status}
    """
    body = request.get_json(silent=True) or {}
    submission = body.get("submission")
    if not isinstance(submission, dict):
        return jsonify({"error": "submission_required"}), 400

    try:
        payload = _orch().submit_exercise(
            user_id=g.user_id,
            exercise_id=exercise_id,
            submission=submission,
            tier=getattr(g, "user_tier", "free"),
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/exercises/<exercise_id>/submit/stream")
@require_auth
def submit_exercise_stream(exercise_id):
    """Server-Sent Events variant of `/submit`.

    Runs the same Evaluator logic + persistence as the non-streaming
    submit, but streams the model's structured-output JSON snapshots back
    as `event: delta` frames so the iOS client can render the
    Evaluator's `feedback` and `gap` text token-by-token instead of
    waiting ~3-6s for the full response. Score / verdict / tags arrive
    inside the snapshots too — the client just chooses which fields to
    render live and which to wait on.

    Frame contract:
      event: delta   data: {"snapshot": <partial parsed evaluator dict>}
      event: done    data: <full ExerciseEvalPayload — same shape as
                            POST /submit returns>
      event: error   data: {"error": <code>, "detail": <str>}

    Errors that happen BEFORE the stream opens (auth, ownership, conflict
    on already-evaluated rows) come back as a normal JSON HTTP error so
    the client can branch the same way it does on the non-streaming
    path. Errors mid-stream are converted into a single `event: error`
    frame and the stream is then closed — by that point the response has
    already started so we can't change the HTTP status.
    """
    body = request.get_json(silent=True) or {}
    submission = body.get("submission")
    if not isinstance(submission, dict):
        return jsonify({"error": "submission_required"}), 400

    # Capture the auth identity now — `g` is request-bound and the
    # generator runs inside `stream_with_context` so it stays valid, but
    # we copy out the values we need rather than rely on attribute
    # access during streaming.
    user_id = g.user_id
    user_tier = getattr(g, "user_tier", "free")
    orch = _orch()

    def _sse(event_name: str, payload: dict | str) -> str:
        data = payload if isinstance(payload, str) else json.dumps(
            payload, ensure_ascii=False
        )
        return f"event: {event_name}\ndata: {data}\n\n"

    @stream_with_context
    def generate():
        try:
            for event in orch.submit_exercise_stream(
                user_id=user_id,
                exercise_id=exercise_id,
                submission=submission,
                tier=user_tier,
            ):
                kind = event.get("kind")
                if kind == "delta":
                    yield _sse("delta", {"snapshot": event.get("snapshot") or {}})
                elif kind == "done":
                    yield _sse("done", event.get("result") or {})
        except OrchestratorError as e:
            log.warning("submit_exercise_stream orch error: %s", e.code)
            yield _sse("error", {"error": e.code, "detail": str(e)})
        except Exception as e:  # noqa: BLE001 — must not leave the conn open
            log.exception("submit_exercise_stream crashed: %s", e)
            yield _sse(
                "error",
                {"error": "internal_error", "detail": str(e)},
            )

    headers = {
        # Tell intermediaries (proxies, dev servers) not to buffer.
        # Without this, nginx/Traefik would hold the response until the
        # generator closes and the user would see no incremental delta.
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers=headers,
    )


# ---------- tracker / adapter endpoints ----------

@bp.get("/progress")
@require_auth
def progress_summary():
    """Global progress dashboard — streak, totals, top tags, per-curriculum
    rollup. See `tracker.dashboard_summary` for the response shape."""
    try:
        payload = _orch().dashboard_summary(user_id=g.user_id)
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.get("/<curriculum_id>/progress")
@require_auth
def curriculum_progress_route(curriculum_id):
    """Per-curriculum progress drilldown — totals, weeks breakdown, top
    tags, streak. See `tracker.curriculum_progress` for the response shape."""
    try:
        payload = _orch().curriculum_progress(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


@bp.post("/<curriculum_id>/replan")
@require_auth
def replan(curriculum_id):
    """Explicit "re-plan now" trigger. Returns
    {changed, summary_note?, rewritten_weeks?, total_weeks?, added_bonus_weeks?}.
    The submit_exercise auto path runs the same logic at session-complete,
    fail-soft."""
    try:
        payload = _orch().run_adapter(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            tier=getattr(g, "user_tier", "free"),
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


# ---------- read-only / housekeeping endpoints (direct DB) ----------

@bp.get("")
@require_auth
def list_curricula():
    """List the user's curricula and roll up per-row progress stats so the
    home screen can render a progress bar without N round-trips.

    Adds: total_weeks, exercises_total, exercises_completed, avg_score (0..1
    or null when no exercises have been evaluated yet).
    """
    db = _db()
    rows = (
        db.table("curricula")
        .select(
            "id,topic,goal,domain,status,assessor_status,planner_status,"
            "level,plan_json,created_at"
        )
        .eq("user_id", g.user_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    ids = [r["id"] for r in rows]
    by_curr: dict[str, dict[str, float]] = {}
    weeks_by_curr: dict[str, dict[str, int]] = {}
    if ids:
        ex_rows = (
            db.table("exercises")
            .select("curriculum_id,status,score")
            .in_("curriculum_id", ids)
            .execute()
        ).data or []
        for ex in ex_rows:
            cid = ex["curriculum_id"]
            s = by_curr.setdefault(
                cid,
                {
                    "exercises_total": 0,
                    "exercises_completed": 0,
                    "score_sum": 0.0,
                    "score_count": 0,
                },
            )
            s["exercises_total"] += 1
            if ex.get("status") == "evaluated":
                s["exercises_completed"] += 1
                if ex.get("score") is not None:
                    s["score_sum"] += float(ex["score"])
                    s["score_count"] += 1

        wk_rows = (
            db.table("curriculum_weeks")
            .select("curriculum_id,status")
            .in_("curriculum_id", ids)
            .execute()
        ).data or []
        for wk in wk_rows:
            cid = wk["curriculum_id"]
            w = weeks_by_curr.setdefault(
                cid, {"sessions_total": 0, "sessions_completed": 0}
            )
            w["sessions_total"] += 1
            if wk.get("status") == "complete":
                w["sessions_completed"] += 1

    out = []
    for r in rows:
        plan = r.pop("plan_json", None)
        total_weeks = 0
        if isinstance(plan, dict):
            tw = plan.get("total_weeks")
            if isinstance(tw, int):
                total_weeks = tw
        s = by_curr.get(r["id"], {})
        w = weeks_by_curr.get(r["id"], {})
        score_count = int(s.get("score_count", 0))
        avg = (
            float(s.get("score_sum", 0.0)) / score_count
            if score_count > 0
            else None
        )
        r["total_weeks"] = total_weeks
        r["exercises_total"] = int(s.get("exercises_total", 0))
        r["exercises_completed"] = int(s.get("exercises_completed", 0))
        r["avg_score"] = avg
        # Sessions = curriculum_weeks rows. The home progress bar uses these.
        r["sessions_total"] = int(w.get("sessions_total", 0))
        r["sessions_completed"] = int(w.get("sessions_completed", 0))
        out.append(r)

    return jsonify({"curricula": out})


@bp.get("/<curriculum_id>")
@require_auth
def get(curriculum_id):
    db = _db()
    row = (
        db.table("curricula")
        .select("*")
        .eq("id", curriculum_id)
        .eq("user_id", g.user_id)
        .single()
        .execute()
    ).data
    if not row:
        return jsonify({"error": "not_found"}), 404
    return jsonify(row)


@bp.delete("/<curriculum_id>")
@require_auth
def delete(curriculum_id):
    """Hard-delete a curriculum. Cascades to weeks / exercises / sessions
    via the FK constraints set up in the schema."""
    db = _db()
    res = (
        db.table("curricula")
        .delete()
        .eq("id", curriculum_id)
        .eq("user_id", g.user_id)
        .execute()
    )
    if not res.data:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"ok": True, "id": curriculum_id})


@bp.get("/<curriculum_id>/weeks")
@require_auth
def list_weeks(curriculum_id):
    db = _db()
    own = (
        db.table("curricula")
        .select("id")
        .eq("id", curriculum_id)
        .eq("user_id", g.user_id)
        .single()
        .execute()
    ).data
    if not own:
        return jsonify({"error": "not_found"}), 404

    rows = (
        db.table("curriculum_weeks")
        .select("id,week_number,plan_json,status")
        .eq("curriculum_id", curriculum_id)
        .order("week_number")
        .execute()
    ).data
    return jsonify({"weeks": rows or []})


@bp.get("/<curriculum_id>/exercises")
@require_auth
def list_exercises(curriculum_id):
    """Query: ?week_id=<uuid> filters to one week.
    Returns: {exercises: [...]}
    """
    db = _db()
    own = (
        db.table("curricula")
        .select("id")
        .eq("id", curriculum_id)
        .eq("user_id", g.user_id)
        .single()
        .execute()
    ).data
    if not own:
        return jsonify({"error": "not_found"}), 404

    week_id = request.args.get("week_id")
    q = (
        db.table("exercises")
        .select(
            "id,week_id,type,content_json,submission_json,feedback_json,"
            "module_index,status,score,seen,created_at,evaluated_at"
        )
        .eq("curriculum_id", curriculum_id)
        .order("created_at")
    )
    if week_id:
        q = q.eq("week_id", week_id)
    rows = q.execute().data
    return jsonify({"exercises": rows or []})
