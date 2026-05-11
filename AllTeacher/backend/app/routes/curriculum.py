"""Curriculum routes — thin HTTP layer over the master Orchestrator.

Routes never call subagents directly. They translate HTTP into orchestrator
intents, and translate orchestrator results / errors back into HTTP. Domain
logic lives in `app.agents.orchestrator`.

POST   /curriculum                        create curriculum + kick off Assessor
GET    /curriculum                        list user's curricula
GET    /curriculum/<id>                   fetch curriculum state
DELETE /curriculum/<id>                   delete curriculum
POST   /curriculum/<id>/assessor          submit an answer, get next Q or summary
POST   /curriculum/<id>/plan              run Planner, persist plan + week rows
GET    /curriculum/<id>/weeks             list curriculum_weeks rows
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


# ---------- read-only / housekeeping endpoints (direct DB) ----------

@bp.get("")
@require_auth
def list_curricula():
    db = _db()
    rows = (
        db.table("curricula")
        .select(
            "id,topic,goal,domain,status,assessor_status,planner_status,"
            "level,created_at"
        )
        .eq("user_id", g.user_id)
        .order("created_at", desc=True)
        .execute()
    ).data
    return jsonify({"curricula": rows or []})


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
