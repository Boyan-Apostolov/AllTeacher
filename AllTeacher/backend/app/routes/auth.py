"""Auth routes - mostly just a 'who am I' endpoint.

Supabase Auth handles signup/login on the client. The iOS app gets a JWT,
sends it as Authorization: Bearer <jwt>, and this backend verifies it.
"""
from flask import Blueprint, jsonify, g

from app.middleware.auth import require_auth
from app.db.supabase import service_client

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.get("/me")
@require_auth
def me():
    return jsonify({
        "user_id": g.user_id,
        "email": g.user_email,
        # Effective tier is already resolved by the auth middleware (see
        # `_load_user_tier` in app/middleware/auth.py). Surface it here
        # so the iOS app can avoid an extra round-trip just to know
        # which UI gates apply.
        "tier": getattr(g, "user_tier", "free"),
    })


@bp.get("/me/subscription")
@require_auth
def my_subscription():
    """Return the caller's subscription state.

    Shape: {tier, status, current_period_end, monthly_price_cents,
    currency}. Defaults to a synthetic free row when no subscriptions
    record exists yet — keeps the iOS settings screen from having to
    branch on the 404 vs free case.

    Distinct from `/auth/me` so the settings tab can poll it
    independently after a manual admin grant lands without re-fetching
    the whole identity.
    """
    db = service_client()
    if db is None:
        # Same behaviour as require_auth's tier resolution: never let a
        # downstream Supabase outage mask the user's identity. We just
        # synthesise a free row.
        return jsonify(_default_free_sub()), 200
    try:
        rows = (
            db.table("subscriptions")
            .select(
                "tier,status,current_period_end,started_at,"
                "monthly_price_cents,currency"
            )
            .eq("user_id", g.user_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception:
        return jsonify(_default_free_sub()), 200

    if not rows:
        return jsonify(_default_free_sub()), 200

    sub = rows[0]
    return jsonify({
        "tier": (sub.get("tier") or "free").lower(),
        "status": sub.get("status") or "active",
        "current_period_end": sub.get("current_period_end"),
        "started_at": sub.get("started_at"),
        "monthly_price_cents": int(sub.get("monthly_price_cents") or 0),
        "currency": sub.get("currency") or "EUR",
        # Echo the runtime-resolved effective tier so the client can
        # compare it against `tier` and notice e.g. an expired Pro row
        # that the auth middleware already downgraded to 'free'.
        "effective_tier": getattr(g, "user_tier", "free"),
    }), 200


def _default_free_sub() -> dict:
    return {
        "tier": "free",
        "status": "active",
        "current_period_end": None,
        "started_at": None,
        "monthly_price_cents": 0,
        "currency": "EUR",
        "effective_tier": getattr(g, "user_tier", "free"),
    }
