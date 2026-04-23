"""Curriculum routes - stubs to be filled in.

POST /curriculum              create new curriculum (kicks off Assessor)
GET  /curriculum              list user's curricula
GET  /curriculum/<id>         fetch curriculum state
"""
from flask import Blueprint, jsonify, g
from app.middleware.auth import require_auth

bp = Blueprint("curriculum", __name__, url_prefix="/curriculum")


@bp.post("")
@require_auth
def create():
    return jsonify({"todo": "wire Assessor + Planner agents", "user_id": g.user_id}), 501


@bp.get("")
@require_auth
def list_curricula():
    return jsonify({"curricula": [], "todo": "query supabase"}), 501


@bp.get("/<curriculum_id>")
@require_auth
def get(curriculum_id):
    return jsonify({"id": curriculum_id, "todo": "query supabase"}), 501
