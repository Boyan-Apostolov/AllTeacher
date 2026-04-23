"""Supabase JWT verification decorator.

Usage:
    @bp.route("/me")
    @require_auth
    def me():
        user_id = g.user_id
        ...
"""
from functools import wraps
import jwt
from flask import request, jsonify, g

from config import Config


def require_auth(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "missing_bearer_token"}), 401
        token = auth.removeprefix("Bearer ").strip()

        if not Config.SUPABASE_JWT_SECRET:
            return jsonify({"error": "server_misconfigured_jwt_secret"}), 500

        try:
            payload = jwt.decode(
                token,
                Config.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token_expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": "invalid_token", "detail": str(e)}), 401

        g.user_id = payload.get("sub")
        g.user_email = payload.get("email")
        g.jwt_payload = payload
        return fn(*args, **kwargs)

    return wrapped
