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
from app.services import usage_meter


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

        # Open a per-request usage scope so any agent call on this
        # request stream lands in the right user's ledger. The matching
        # flush() runs in app.teardown_request — that fires whether or
        # not the route returns successfully, so we don't leak rows.
        # Best-effort; never raises into the request path.
        try:
            curriculum_id = (
                request.view_args.get("curriculum_id")
                if request.view_args
                else None
            )
            usage_meter.begin(
                user_id=g.user_id,
                curriculum_id=curriculum_id,
            )
        except Exception:
            pass

        return fn(*args, **kwargs)

    return wrapped


def admin_only(fn):
    """Gate that requires the caller to be the configured ADMIN_EMAIL.

    Stacks ON TOP of `require_auth` — order matters:

        @bp.route("/admin/overview")
        @require_auth
        @admin_only
        def overview(): ...

    `require_auth` runs first, populates g.user_email; then admin_only
    checks the email against Config.ADMIN_EMAIL. We deliberately return
    404 (not 403) so a curious non-admin can't even tell the route
    exists — keeps the surface boring for anyone scanning.
    """
    @wraps(fn)
    def wrapped(*args, **kwargs):
        email = (getattr(g, "user_email", None) or "").lower().strip()
        admin = (Config.ADMIN_EMAIL or "").lower().strip()
        if not admin or email != admin:
            return jsonify({"error": "not_found"}), 404
        return fn(*args, **kwargs)

    return wrapped
