"""Webhook receivers — RevenueCat subscription events.

RevenueCat POSTs signed events here whenever a subscription changes.
We verify the Authorization header, map the product_id to a tier, then
upsert the `subscriptions` row for that user.

Endpoint: POST /webhooks/revenuecat
Auth:      Bearer <REVENUECAT_WEBHOOK_SECRET>

Events handled:
  INITIAL_PURCHASE  → active at new tier
  RENEWAL           → active, period_end extended
  UNCANCELLATION    → user re-enabled auto-renew → back to active
  TRANSFER          → subscription transferred to this user → active
  CANCELLATION      → status=canceled (access continues until period_end)
  EXPIRATION        → status=expired  (auth middleware downgrades to free)
  BILLING_ISSUE     → status=grace    (short grace window before expiry)
  (all others)      → logged, 200 returned, no DB write

RevenueCat dashboard setup:
  1. Project settings → Webhooks → Add endpoint
     URL:  https://<your-domain>/webhooks/revenuecat
     Auth: Bearer <same value as REVENUECAT_WEBHOOK_SECRET env var>
  2. Enable all event types (the handler filters internally)
"""
import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, abort

from config import Config
from app.db.supabase import service_client

log = logging.getLogger(__name__)

bp = Blueprint("webhooks", __name__, url_prefix="/webhooks")

# Maps App Store product IDs → internal tier names.
# Keep in sync with App Store Connect product IDs and ios/lib/revenuecat.ts.
PRODUCT_TO_TIER: dict[str, str] = {
    "com.allteacher.app.starter.monthly": "starter",
    "com.allteacher.app.pro.monthly":     "pro",
    "com.allteacher.app.power.monthly":   "power",
}

# Monthly price in cents (EUR) — used when writing the subscriptions row.
TIER_PRICE_CENTS: dict[str, int] = {
    "starter": 300,
    "pro":     800,
    "power":   1500,
}

# Events that activate or extend a subscription.
ACTIVE_EVENTS   = {"INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "TRANSFER"}
# User cancelled auto-renew — still active until period_end.
CANCELED_EVENTS = {"CANCELLATION"}
# Subscription fully over — downgrade to free.
EXPIRED_EVENTS  = {"EXPIRATION"}
# Payment failed — grace period, keep tier temporarily.
GRACE_EVENTS    = {"BILLING_ISSUE"}


def _ms_to_iso(ms: int | None) -> str | None:
    """Convert a RevenueCat millisecond epoch timestamp to ISO 8601 UTC."""
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _current_tier_from_db(user_id: str) -> str:
    """Read the user's existing tier from DB — used when the event doesn't
    carry a product_id (e.g. CANCELLATION with no product info)."""
    db = service_client()
    if not db:
        return "free"
    try:
        rows = (
            db.table("subscriptions")
            .select("tier")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("tier", "free") if rows else "free"
    except Exception:
        return "free"


def _upsert_subscription(
    user_id: str,
    tier: str,
    status: str,
    current_period_end: str | None,
    monthly_price_cents: int,
    currency: str = "EUR",
) -> None:
    """Write or update the subscriptions row for user_id."""
    db = service_client()
    if db is None:
        log.error("webhooks: Supabase service client unavailable — skipping upsert")
        return

    row = {
        "user_id":             user_id,
        "tier":                tier,
        "status":              status,
        "current_period_end":  current_period_end,
        "monthly_price_cents": monthly_price_cents,
        "currency":            currency,
        "started_at":          datetime.now(timezone.utc).isoformat(),
    }

    try:
        db.table("subscriptions").upsert(row, on_conflict="user_id").execute()
        log.info(
            "webhooks: upserted subscription user=%s tier=%s status=%s",
            user_id, tier, status,
        )
    except Exception as exc:
        log.exception("webhooks: failed to upsert subscription: %s", exc)


@bp.post("/revenuecat")
def revenuecat():
    # ── Verify webhook secret ─────────────────────────────────────────────────
    secret = Config.REVENUECAT_WEBHOOK_SECRET
    if secret and request.headers.get("Authorization") != f"Bearer {secret}":
        log.warning("webhooks/revenuecat: invalid Authorization header")
        abort(401)

    payload    = request.get_json(silent=True) or {}
    event      = payload.get("event", {})
    event_type = event.get("type", "UNKNOWN")

    log.info("webhooks/revenuecat: received event_type=%s", event_type)

    # ── Extract fields from the event ─────────────────────────────────────────
    user_id    = event.get("app_user_id")   # Supabase UUID (set via RC logIn)
    product_id = event.get("product_id", "")
    exp_ms     = event.get("expiration_at_ms")
    currency   = (event.get("currency") or "EUR").upper()

    if not user_id:
        log.warning("webhooks/revenuecat: missing app_user_id — ignoring event")
        return jsonify({"received": True, "skipped": "no_user_id"}), 200

    tier       = PRODUCT_TO_TIER.get(product_id)
    period_end = _ms_to_iso(exp_ms)

    # ── Route by event type ───────────────────────────────────────────────────

    if event_type in ACTIVE_EVENTS:
        if not tier:
            log.warning(
                "webhooks/revenuecat: unknown product_id=%s for %s — skipping",
                product_id, event_type,
            )
            return jsonify({"received": True, "skipped": "unknown_product"}), 200

        _upsert_subscription(
            user_id=user_id,
            tier=tier,
            status="active",
            current_period_end=period_end,
            monthly_price_cents=TIER_PRICE_CENTS.get(tier, 0),
            currency=currency,
        )

    elif event_type in CANCELED_EVENTS:
        # Keep the existing tier — user still has access until period_end.
        effective_tier = tier or _current_tier_from_db(user_id)
        _upsert_subscription(
            user_id=user_id,
            tier=effective_tier,
            status="canceled",
            current_period_end=period_end,
            monthly_price_cents=TIER_PRICE_CENTS.get(effective_tier, 0),
            currency=currency,
        )

    elif event_type in EXPIRED_EVENTS:
        # Period fully over — downgrade to free.
        _upsert_subscription(
            user_id=user_id,
            tier="free",
            status="expired",
            current_period_end=period_end,
            monthly_price_cents=0,
            currency=currency,
        )

    elif event_type in GRACE_EVENTS:
        # Payment failed — preserve tier during grace window.
        effective_tier = tier or _current_tier_from_db(user_id)
        _upsert_subscription(
            user_id=user_id,
            tier=effective_tier,
            status="grace",
            current_period_end=period_end,
            monthly_price_cents=TIER_PRICE_CENTS.get(effective_tier, 0),
            currency=currency,
        )

    else:
        # SUBSCRIBER_ALIAS, TEST, PRODUCT_CHANGE, etc. — acknowledge, skip DB.
        log.info(
            "webhooks/revenuecat: unhandled event_type=%s — no DB write", event_type
        )

    return jsonify({"received": True, "event_type": event_type}), 200
