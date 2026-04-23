"""Enforce Free/Pro/Power subscription limits.

Stub for now - real implementation reads tier from `subscriptions` table
and denies access to gated features. Wire up once the RevenueCat webhook
is writing rows.
"""
from functools import wraps
from flask import g, jsonify


TIER_RANK = {"free": 0, "pro": 1, "power": 2}


def require_tier(minimum: str):
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            user_tier = getattr(g, "user_tier", "free")
            if TIER_RANK.get(user_tier, 0) < TIER_RANK[minimum]:
                return jsonify({
                    "error": "tier_required",
                    "required": minimum,
                    "current": user_tier,
                }), 402
            return fn(*args, **kwargs)
        return wrapped
    return decorator
