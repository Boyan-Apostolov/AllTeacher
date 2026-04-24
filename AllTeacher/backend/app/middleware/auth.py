"""Supabase JWT verification decorator.

Handles BOTH signing modes Supabase offers:
  * Legacy HS256 (shared JWT secret)
  * Asymmetric ES256 / RS256 (verified via the project's JWKS endpoint)

Auto-detects the algorithm from the token header. If you see "unsupported_alg"
in the error response, your project is using a scheme we don't know about.

Usage:
    @bp.route("/me")
    @require_auth
    def me():
        user_id = g.user_id
        ...
"""
from functools import wraps
import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g

from config import Config


_jwks_client: PyJWKClient | None = None


def _jwks() -> PyJWKClient | None:
    """Lazily construct a cached JWKS client pointing at the Supabase project."""
    global _jwks_client
    if _jwks_client is None and Config.SUPABASE_URL:
        _jwks_client = PyJWKClient(
            f"{Config.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwks_client


def require_auth(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "missing_bearer_token"}), 401
        token = auth.removeprefix("Bearer ").strip()

        # Peek at the header to decide verification strategy.
        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError as e:
            return jsonify({"error": "invalid_token", "detail": str(e)}), 401

        alg = header.get("alg", "")

        try:
            if alg.startswith("HS"):
                if not Config.SUPABASE_JWT_SECRET:
                    return jsonify({
                        "error": "server_misconfigured_jwt_secret",
                        "hint": "Token is HS-signed but SUPABASE_JWT_SECRET is empty",
                    }), 500
                payload = jwt.decode(
                    token,
                    Config.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
            elif alg in ("RS256", "ES256"):
                client = _jwks()
                if not client:
                    return jsonify({
                        "error": "server_misconfigured_jwks",
                        "hint": "Token is asymmetric-signed but SUPABASE_URL is empty",
                    }), 500
                signing_key = client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=[alg],
                    audience="authenticated",
                )
            else:
                return jsonify({"error": "unsupported_alg", "alg": alg}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token_expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({
                "error": "invalid_token",
                "detail": str(e),
                "alg": alg,
            }), 401

        g.user_id = payload.get("sub")
        g.user_email = payload.get("email")
        g.jwt_payload = payload
        return fn(*args, **kwargs)

    return wrapped
