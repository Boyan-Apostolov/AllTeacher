"""Webhook receivers - RevenueCat in particular.

RevenueCat POSTs purchase/cancel/renew events here. We verify the
Authorization header matches our configured secret, then upsert the
user's tier in `subscriptions`.
"""
from flask import Blueprint, request, jsonify, abort
from config import Config

bp = Blueprint("webhooks", __name__, url_prefix="/webhooks")


@bp.post("/revenuecat")
def revenuecat():
    secret = Config.REVENUECAT_WEBHOOK_SECRET
    if secret and request.headers.get("Authorization") != f"Bearer {secret}":
        abort(401)

    event = request.get_json(silent=True) or {}
    # TODO: upsert tier into `subscriptions` keyed by app_user_id
    return jsonify({"received": True, "event_type": event.get("event", {}).get("type")})
