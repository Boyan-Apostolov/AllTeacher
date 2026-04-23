"""Auth routes - mostly just a 'who am I' endpoint.

Supabase Auth handles signup/login on the client. The iOS app gets a JWT,
sends it as Authorization: Bearer <jwt>, and this backend verifies it.
"""
from flask import Blueprint, jsonify, g
from app.middleware.auth import require_auth

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.get("/me")
@require_auth
def me():
    return jsonify({
        "user_id": g.user_id,
        "email": g.user_email,
    })
