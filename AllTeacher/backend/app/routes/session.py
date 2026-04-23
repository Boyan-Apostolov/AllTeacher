"""Session routes - streaming chat with the orchestrator.

POST /session/<curriculum_id>/message  - streams tokens via SSE
"""
from flask import Blueprint, jsonify, g
from app.middleware.auth import require_auth

bp = Blueprint("session", __name__, url_prefix="/session")


@bp.post("/<curriculum_id>/message")
@require_auth
def message(curriculum_id):
    return jsonify({
        "todo": "stream orchestrator output via SSE",
        "curriculum_id": curriculum_id,
        "user_id": g.user_id,
    }), 501
