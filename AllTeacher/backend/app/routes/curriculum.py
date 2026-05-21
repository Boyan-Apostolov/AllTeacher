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
POST   /curriculum/<id>/exercises         run Exercise Writer for a given week
GET    /curriculum/<id>/exercises         list exercises (filtered by week_id)
POST   /curriculum/exercises/<eid>/submit run Evaluator on a submission
"""
from flask import Blueprint, jsonify, g, request

from app.middleware.auth import require_auth
from app.db.supabase import service_client
from app.agents.orchestrator import Orchestrator, OrchestratorError

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


@bp.post("/<curriculum_id>/exercises")
@require_auth
def generate_exercises(curriculum_id):
    """Body: {week_id?: str, count?: int}
    Runs the Exercise Writer for one week and persists the new exercises.
    Returns: {curriculum_id, week_id, exercises: [...]}
    """
    body = request.get_json(silent=True) or {}
    week_id = body.get("week_id") or None
    try:
        count = int(body.get("count") or 5)
    except (TypeError, ValueError):
        count = 5
    count = max(1, min(8, count))

    try:
        payload = _orch().generate_exercises(
            user_id=g.user_id,
            curriculum_id=curriculum_id,
            week_id=week_id,
            count=count,
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
        )
    except OrchestratorError as e:
        return _orch_error(e)
    return jsonify(payload), 200


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
