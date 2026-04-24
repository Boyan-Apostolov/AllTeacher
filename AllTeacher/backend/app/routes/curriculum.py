"""Curriculum routes.

POST /curriculum                        create curriculum + kick off Assessor
GET  /curriculum                        list user's curricula
GET  /curriculum/<id>                   fetch curriculum state
POST /curriculum/<id>/assessor          submit an answer, get next Q or final summary
"""
from flask import Blueprint, jsonify, g, request
from app.middleware.auth import require_auth
from app.db.supabase import service_client
from app.agents import assessor

bp = Blueprint("curriculum", __name__, url_prefix="/curriculum")


def _db():
    c = service_client()
    if c is None:
        raise RuntimeError("Supabase service client not configured")
    return c


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

    db = _db()

    # Create row.
    insert = (
        db.table("curricula")
        .insert({
            "user_id": g.user_id,
            "topic": goal[:200],       # placeholder — Planner will set final topic/domain
            "goal": goal,
            "native_language": native_language,
            "assessor_status": "in_progress",
            "assessment_json": {"transcript": []},
        })
        .execute()
    )
    row = insert.data[0]

    # First Assessor step.
    result = assessor.step(
        goal=goal,
        native_language=native_language,
        transcript=[],
    )

    return _apply_assessor_step(db, row["id"], goal, native_language, [], result), 200


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
    if row.get("assessor_status") == "complete":
        return jsonify({"error": "assessor_already_complete"}), 409

    transcript = (row.get("assessment_json") or {}).get("transcript", [])
    if not transcript or transcript[-1].get("answer") is not None:
        return jsonify({"error": "no_pending_question"}), 409

    # Fill the pending question with the user's answer.
    transcript[-1]["answer"] = answer

    result = assessor.step(
        goal=row.get("goal") or row.get("topic") or "",
        native_language=row.get("native_language") or "en",
        transcript=transcript,
    )

    return _apply_assessor_step(
        db,
        curriculum_id,
        row.get("goal") or row.get("topic") or "",
        row.get("native_language") or "en",
        transcript,
        result,
    ), 200


@bp.get("")
@require_auth
def list_curricula():
    db = _db()
    rows = (
        db.table("curricula")
        .select("id,topic,goal,domain,status,assessor_status,level,created_at")
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


# --- helpers ---

def _apply_assessor_step(db, curriculum_id, goal, native_language, transcript, result):
    """Persist the Assessor's response + return the API payload."""
    kind = result.get("kind")

    if kind == "question":
        q = result.get("question") or {}
        text = q.get("text") or ""
        options = q.get("options") or []
        transcript = transcript + [{"question": text, "options": options, "answer": None}]
        db.table("curricula").update({
            "assessment_json": {"transcript": transcript},
            "assessor_status": "in_progress",
        }).eq("id", curriculum_id).execute()
        return jsonify({
            "id": curriculum_id,
            "next": {"question": text, "options": options},
            "complete": None,
        })

    if kind == "complete":
        summary = result.get("summary") or {}
        db.table("curricula").update({
            "assessment_json": {"transcript": transcript, "summary": summary},
            "assessor_status": "complete",
            "domain": summary.get("domain"),
            "level": summary.get("level"),
            "learning_style": summary.get("learning_style"),
            "time_budget_mins_per_day": summary.get("time_budget_mins_per_day"),
            "target_language": summary.get("target_language"),
        }).eq("id", curriculum_id).execute()
        return jsonify({"id": curriculum_id, "next": None, "complete": summary})

    # Model returned something unexpected — surface it.
    return jsonify({"error": "bad_assessor_response", "raw": result}), 500
