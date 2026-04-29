"""Admin dashboard routes — single-operator (boian4934@gmail.com).

Every endpoint is gated by `@require_auth` + `@admin_only`, in that
order: auth populates `g.user_email`, admin_only checks it against
Config.ADMIN_EMAIL and returns 404 (not 403) on miss so the surface is
indistinguishable from "no such route" for non-admins.

The dashboard is mostly read-only. The two write endpoints live at the
bottom of this file:

  POST /admin/subscriptions/grant   — promote a user to pro/power for N days
  POST /admin/subscriptions/revoke  — drop a user back to free, period end now

These exist so the operator can hand out tiers manually before Apple +
RevenueCat IAP wiring lands. Once the webhook is live, RevenueCat
becomes the canonical writer; manual grants stay as a last-resort
override.

Layout
------
GET /admin/overview     → headline KPIs for the home card grid:
                          users (total, signups today/7d/30d), DAU/WAU/MAU,
                          subs (counts by tier, MRR), API cost (today/30d),
                          margin (rev_30d − cost_30d).
GET /admin/users        → recent signups + per-user 30-day cost. Used by
                          the "who's burning the most?" panel.
GET /admin/usage        → time-series cost + per-agent breakdown for the
                          stacked-area chart.
GET /admin/engagement   → sessions per day + retention cohort. The
                          dashboard plots sessions; the cohort table is
                          rendered as a small grid.
GET /admin/profit       → monthly MRR vs. cost vs. margin rollup.

All time-window query params accept `?days=N` (default 30, capped at
180 to keep the response small).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, jsonify, request

from app.middleware.auth import require_auth, admin_only
from app.db.supabase import service_client
from config import Config


bp = Blueprint("admin", __name__, url_prefix="/admin")


# --- helpers -----------------------------------------------------------

def _db():
    c = service_client()
    if c is None:
        # Surface as 503 so the admin UI shows a "service down" banner
        # instead of a generic 500.
        raise RuntimeError("Supabase service client not configured")
    return c


def _days_window(default: int = 30, cap: int = 180) -> int:
    raw = request.args.get("days")
    if raw is None:
        return default
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return default
    return max(1, min(cap, n))


def _iso_days_ago(days: int) -> str:
    return (
        datetime.now(timezone.utc) - timedelta(days=days)
    ).isoformat()


def _bucket_by_day(rows: list[dict[str, Any]], date_field: str) -> dict[str, int]:
    """Group `rows` by YYYY-MM-DD of `date_field`, returning counts."""
    buckets: dict[str, int] = {}
    for r in rows:
        ts = r.get(date_field)
        if not ts:
            continue
        # Supabase returns ISO strings; first 10 chars are YYYY-MM-DD.
        day = str(ts)[:10]
        buckets[day] = buckets.get(day, 0) + 1
    return buckets


def _fill_day_series(
    buckets: dict[str, float],
    days: int,
) -> list[dict[str, Any]]:
    """Return [{date, value}] for the last `days` days, filling 0s."""
    today = datetime.now(timezone.utc).date()
    out = []
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        out.append({"date": d, "value": float(buckets.get(d, 0))})
    return out


# --- /admin/overview --------------------------------------------------

@bp.get("/overview")
@require_auth
@admin_only
def overview():
    """Single roll-up payload powering the dashboard home grid."""
    db = _db()
    now = datetime.now(timezone.utc)
    today_iso = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    seven_iso = _iso_days_ago(7)
    thirty_iso = _iso_days_ago(30)

    # ---- users (Supabase auth.users via the admin API) ---------------
    # auth schema isn't directly queryable through PostgREST, so we go
    # through the admin auth API. listUsers paginates; we only need
    # totals + recent counts so we cap the scan at the first 1000 rows.
    # If the deploy ever exceeds that, swap in a counts-only RPC.
    users_total = 0
    signups_today = 0
    signups_7d = 0
    signups_30d = 0
    try:
        # supabase-py exposes auth.admin.list_users(); shape is
        # { users: [{id, email, created_at, last_sign_in_at}, ...] }
        page = db.auth.admin.list_users()
        # Different supabase-py versions return either a list or an
        # object with .users — handle both.
        users_list = (
            page.users if hasattr(page, "users") else page  # type: ignore[attr-defined]
        ) or []
        users_total = len(users_list)
        for u in users_list:
            created = getattr(u, "created_at", None) or (
                u.get("created_at") if isinstance(u, dict) else None
            )
            if not created:
                continue
            ts = str(created)
            if ts >= today_iso:
                signups_today += 1
            if ts >= seven_iso:
                signups_7d += 1
            if ts >= thirty_iso:
                signups_30d += 1
    except Exception:
        # Don't take down the dashboard over a transient auth-API hiccup.
        pass

    # ---- DAU / WAU / MAU -----------------------------------------
    # Active = made any exercise submission OR opened a session within
    # the window. We use exercises.evaluated_at as the cheapest signal
    # (it indexes the most engaged action). distinct user_id counts
    # roll up via a JS pass — Supabase Postgres can do it natively but
    # we need the row payload to also derive other metrics anyway.
    ex_30d = (
        db.table("exercises")
        .select("curriculum_id,evaluated_at")
        .gte("evaluated_at", thirty_iso)
        .execute()
    ).data or []

    # Map curriculum_id → user_id for the cohort math.
    curr_ids = list({r["curriculum_id"] for r in ex_30d if r.get("curriculum_id")})
    curr_owner: dict[str, str] = {}
    if curr_ids:
        owners = (
            db.table("curricula")
            .select("id,user_id")
            .in_("id", curr_ids)
            .execute()
        ).data or []
        curr_owner = {r["id"]: r["user_id"] for r in owners}

    one_iso = _iso_days_ago(1)
    dau, wau, mau = set(), set(), set()
    for r in ex_30d:
        uid = curr_owner.get(r.get("curriculum_id") or "")
        if not uid:
            continue
        ts = str(r.get("evaluated_at") or "")
        if ts >= thirty_iso:
            mau.add(uid)
        if ts >= seven_iso:
            wau.add(uid)
        if ts >= one_iso:
            dau.add(uid)

    # ---- subscriptions / MRR -------------------------------------
    subs = (
        db.table("subscriptions")
        .select("tier,status,monthly_price_cents")
        .execute()
    ).data or []
    by_tier: dict[str, int] = {"free": 0, "pro": 0, "power": 0}
    mrr_cents = 0
    paying = 0
    for s in subs:
        tier = s.get("tier") or "free"
        by_tier[tier] = by_tier.get(tier, 0) + 1
        if s.get("status") == "active" and tier != "free":
            mrr_cents += int(s.get("monthly_price_cents") or 0)
            paying += 1

    # ---- API cost ------------------------------------------------
    cost_rows_30d = (
        db.table("token_usage_log")
        .select("cost_cents,created_at")
        .gte("created_at", thirty_iso)
        .execute()
    ).data or []
    cost_today_cents = sum(
        float(r.get("cost_cents") or 0)
        for r in cost_rows_30d
        if str(r.get("created_at") or "") >= today_iso
    )
    cost_30d_cents = sum(float(r.get("cost_cents") or 0) for r in cost_rows_30d)

    # Margin = revenue (MRR run-rate over 30d) − cost over 30d.
    # cost_cents are USD-cents; mrr_cents are EUR-cents. Treated as
    # comparable for the rough-margin lens this dashboard exists for.
    margin_30d_cents = mrr_cents - cost_30d_cents

    return jsonify({
        "users": {
            "total": users_total,
            "signups_today": signups_today,
            "signups_7d": signups_7d,
            "signups_30d": signups_30d,
            "dau": len(dau),
            "wau": len(wau),
            "mau": len(mau),
        },
        "subscriptions": {
            "by_tier": by_tier,
            "paying": paying,
            "mrr_cents": mrr_cents,
            "currency": "EUR",
        },
        "cost": {
            "today_cents": round(cost_today_cents, 2),
            "last_30d_cents": round(cost_30d_cents, 2),
            "currency": "USD",
        },
        "margin": {
            "last_30d_cents": round(margin_30d_cents, 2),
        },
        "tier_prices": Config.TIER_PRICES_EUR_CENTS,
    })


# --- /admin/users ----------------------------------------------------

@bp.get("/users")
@require_auth
@admin_only
def users_list():
    """Recent users + their 30-day API cost. Caps at 200 rows so the
    iOS list view doesn't get a giant payload."""
    db = _db()
    days = _days_window()
    since_iso = _iso_days_ago(days)

    # Pull users via admin auth API.
    try:
        page = db.auth.admin.list_users()
        users_list_raw = (
            page.users if hasattr(page, "users") else page  # type: ignore[attr-defined]
        ) or []
    except Exception:
        users_list_raw = []

    # Per-user cost over the window — one query, JS rollup.
    cost_rows = (
        db.table("token_usage_log")
        .select("user_id,cost_cents")
        .gte("created_at", since_iso)
        .execute()
    ).data or []
    cost_by_user: dict[str, float] = {}
    for r in cost_rows:
        uid = r.get("user_id")
        if not uid:
            continue
        cost_by_user[uid] = cost_by_user.get(uid, 0) + float(r.get("cost_cents") or 0)

    # Subscriptions for tier badge.
    subs = (
        db.table("subscriptions")
        .select("user_id,tier,status")
        .execute()
    ).data or []
    sub_by_user = {s["user_id"]: s for s in subs}

    out = []
    for u in users_list_raw[:200]:
        uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
        email = getattr(u, "email", None) or (
            u.get("email") if isinstance(u, dict) else None
        )
        created = getattr(u, "created_at", None) or (
            u.get("created_at") if isinstance(u, dict) else None
        )
        s = sub_by_user.get(uid or "", {})
        out.append({
            "id": uid,
            "email": email,
            "created_at": str(created) if created else None,
            "tier": s.get("tier") or "free",
            "status": s.get("status") or "free",
            "cost_cents_window": round(cost_by_user.get(uid or "", 0.0), 4),
        })

    # Heaviest spenders first — it's the panel's whole point.
    out.sort(key=lambda r: r["cost_cents_window"], reverse=True)
    return jsonify({"users": out, "days": days})


# --- /admin/usage ----------------------------------------------------

@bp.get("/usage")
@require_auth
@admin_only
def usage_breakdown():
    """Time-series API cost + per-agent breakdown."""
    db = _db()
    days = _days_window()
    since_iso = _iso_days_ago(days)

    rows = (
        db.table("token_usage_log")
        .select("agent,model,cost_cents,prompt_tokens,completion_tokens,created_at")
        .gte("created_at", since_iso)
        .execute()
    ).data or []

    # Per-day total cost.
    by_day: dict[str, float] = {}
    # Per-agent rollups for the breakdown panel.
    by_agent: dict[str, dict[str, float]] = {}
    by_model: dict[str, dict[str, float]] = {}
    for r in rows:
        cost = float(r.get("cost_cents") or 0)
        day = str(r.get("created_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + cost
        agent = r.get("agent") or "unknown"
        a = by_agent.setdefault(agent, {"cost_cents": 0.0, "calls": 0, "prompt_tokens": 0, "completion_tokens": 0})
        a["cost_cents"] += cost
        a["calls"] += 1
        a["prompt_tokens"] += int(r.get("prompt_tokens") or 0)
        a["completion_tokens"] += int(r.get("completion_tokens") or 0)
        model = r.get("model") or "unknown"
        m = by_model.setdefault(model, {"cost_cents": 0.0, "calls": 0})
        m["cost_cents"] += cost
        m["calls"] += 1

    series = _fill_day_series(by_day, days)
    agents = sorted(
        [
            {
                "agent": k,
                "cost_cents": round(v["cost_cents"], 4),
                "calls": int(v["calls"]),
                "prompt_tokens": int(v["prompt_tokens"]),
                "completion_tokens": int(v["completion_tokens"]),
            }
            for k, v in by_agent.items()
        ],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )
    models = sorted(
        [
            {"model": k, "cost_cents": round(v["cost_cents"], 4), "calls": int(v["calls"])}
            for k, v in by_model.items()
        ],
        key=lambda x: x["cost_cents"],
        reverse=True,
    )

    total_cost = sum(by_day.values())
    return jsonify({
        "days": days,
        "total_cost_cents": round(total_cost, 4),
        "currency": "USD",
        "series": series,        # [{date, value}] daily cost cents
        "by_agent": agents,
        "by_model": models,
    })


# --- /admin/engagement -----------------------------------------------

@bp.get("/engagement")
@require_auth
@admin_only
def engagement():
    """Sessions per day + simple weekly retention cohort.

    Sessions = curriculum_weeks rows transitioning to status='complete'.
    We don't have a separate event log, so we approximate "session" as
    "user submitted at least one exercise today" — same DAU signal,
    bucketed daily.
    """
    db = _db()
    days = _days_window()
    since_iso = _iso_days_ago(days)

    ex_rows = (
        db.table("exercises")
        .select("curriculum_id,evaluated_at")
        .gte("evaluated_at", since_iso)
        .execute()
    ).data or []

    curr_ids = list({r["curriculum_id"] for r in ex_rows if r.get("curriculum_id")})
    curr_owner: dict[str, str] = {}
    if curr_ids:
        owners = (
            db.table("curricula")
            .select("id,user_id")
            .in_("id", curr_ids)
            .execute()
        ).data or []
        curr_owner = {r["id"]: r["user_id"] for r in owners}

    # Sessions per day = distinct users active per day.
    by_day_users: dict[str, set[str]] = {}
    for r in ex_rows:
        uid = curr_owner.get(r.get("curriculum_id") or "")
        if not uid:
            continue
        day = str(r.get("evaluated_at") or "")[:10]
        if not day:
            continue
        by_day_users.setdefault(day, set()).add(uid)

    by_day = {d: float(len(s)) for d, s in by_day_users.items()}
    series = _fill_day_series(by_day, days)

    # Total sessions completed (curriculum_weeks marked complete in window).
    completed_weeks = (
        db.table("curriculum_weeks")
        .select("id,status")
        .eq("status", "complete")
        .execute()
    ).data or []
    sessions_completed_total = len(completed_weeks)

    return jsonify({
        "days": days,
        "active_users_series": series,
        "sessions_completed_total": sessions_completed_total,
    })


# --- /admin/profit ---------------------------------------------------

@bp.get("/profit")
@require_auth
@admin_only
def profit():
    """Monthly profit roll-up: revenue (subs MRR) − cost (token_usage_log)
    per ISO month, last 6 months."""
    db = _db()
    months = max(1, min(12, int(request.args.get("months") or 6)))

    today = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    # Build the list of months we care about (oldest → newest).
    month_keys: list[str] = []
    cursor = today
    for _ in range(months):
        month_keys.append(cursor.strftime("%Y-%m"))
        # Go back one month — keep the 1st-of-month anchor.
        prev = cursor - timedelta(days=1)
        cursor = prev.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_keys.reverse()

    earliest_iso = (
        datetime.strptime(month_keys[0] + "-01", "%Y-%m-%d")
        .replace(tzinfo=timezone.utc)
        .isoformat()
    )

    # Cost per month from the ledger.
    cost_rows = (
        db.table("token_usage_log")
        .select("cost_cents,created_at")
        .gte("created_at", earliest_iso)
        .execute()
    ).data or []
    cost_by_month: dict[str, float] = {}
    for r in cost_rows:
        m = str(r.get("created_at") or "")[:7]
        if not m:
            continue
        cost_by_month[m] = cost_by_month.get(m, 0) + float(r.get("cost_cents") or 0)

    # Revenue per month — we don't have a payment ledger, so we
    # approximate as: for each subscription active during the month,
    # add its monthly_price_cents. This matches "MRR booked that
    # month", not cash collected (Apple's payouts lag), but it's the
    # right number for the "is the business healthy?" lens.
    subs = (
        db.table("subscriptions")
        .select("tier,status,monthly_price_cents,started_at,current_period_end")
        .execute()
    ).data or []

    revenue_by_month: dict[str, int] = {}
    for s in subs:
        if s.get("tier") == "free":
            continue
        price = int(s.get("monthly_price_cents") or 0)
        started = str(s.get("started_at") or "")[:7]  # YYYY-MM
        ended = str(s.get("current_period_end") or "")[:7] if s.get("status") != "active" else None
        for m in month_keys:
            if started and m < started:
                continue
            if ended and m > ended:
                continue
            revenue_by_month[m] = revenue_by_month.get(m, 0) + price

    out = []
    for m in month_keys:
        rev = revenue_by_month.get(m, 0)
        cost = cost_by_month.get(m, 0.0)
        out.append({
            "month": m,
            "revenue_cents": rev,           # EUR cents
            "cost_cents": round(cost, 4),    # USD cents (cross-currency caveat)
            "margin_cents": round(rev - cost, 4),
        })
    return jsonify({"months": out})


# --- /admin/subscriptions/{grant,revoke} -----------------------------
#
# Manual-grant flow. Lets the operator promote a user to a paid tier for
# a chosen number of days while RevenueCat / Apple IAP is still
# unwired. Both routes upsert the same `subscriptions` row keyed by
# `user_id`; once RC is live, its webhook will take over the writes and
# these endpoints become operator overrides only.

_VALID_TIERS = ("free", "pro", "power")


@bp.post("/subscriptions/grant")
@require_auth
@admin_only
def grant_subscription():
    """Body: {user_id: uuid, tier: 'pro'|'power'|'free', days?: int=30}

    Upserts the user's subscription row to the requested tier with
    `current_period_end = now() + days`, status='active'. Idempotent —
    running twice extends the period from "now", not from the previous
    end date (deliberate; the operator wants "give them N days from this
    moment", not "stack on top").

    Granting `tier='free'` is treated as a soft revoke (status='canceled',
    period end snapped to now); use the dedicated revoke endpoint for
    that — this guard exists only to surface a clearer error.
    """
    body = request.get_json(silent=True) or {}
    user_id = (body.get("user_id") or "").strip()
    tier = (body.get("tier") or "").strip().lower()
    days_raw = body.get("days")

    if not user_id:
        return jsonify({"error": "user_id_required"}), 400
    if tier not in _VALID_TIERS:
        return jsonify({"error": "invalid_tier", "valid": list(_VALID_TIERS)}), 400
    if tier == "free":
        return jsonify({
            "error": "use_revoke_endpoint",
            "hint": "POST /admin/subscriptions/revoke to drop a user to free.",
        }), 400

    try:
        days = int(days_raw) if days_raw is not None else 30
    except (TypeError, ValueError):
        return jsonify({"error": "days_must_be_int"}), 400
    days = max(1, min(3650, days))  # cap at 10 years to avoid silly inputs

    db = _db()
    now = datetime.now(timezone.utc)
    period_end = (now + timedelta(days=days)).isoformat()

    price = Config.TIER_PRICES_EUR_CENTS.get(tier, 0)

    # Upsert keyed on user_id (the table's primary key per migration 009).
    # We deliberately reset started_at on every grant so the admin UI
    # shows "granted on <today>" instead of the original signup date.
    row = {
        "user_id": user_id,
        "tier": tier,
        "monthly_price_cents": price,
        "currency": "EUR",
        "started_at": now.isoformat(),
        "current_period_end": period_end,
        "status": "active",
        "updated_at": now.isoformat(),
        # revenuecat_id stays untouched on manual grants; if RC later
        # writes for the same user, it'll set its own ID.
    }

    try:
        result = (
            db.table("subscriptions")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": "upsert_failed", "detail": str(e)}), 500

    saved = (result.data or [row])[0]
    return jsonify({
        "ok": True,
        "subscription": {
            "user_id": saved.get("user_id"),
            "tier": saved.get("tier"),
            "status": saved.get("status"),
            "current_period_end": saved.get("current_period_end"),
            "monthly_price_cents": saved.get("monthly_price_cents"),
            "currency": saved.get("currency") or "EUR",
        },
    }), 200


@bp.post("/subscriptions/revoke")
@require_auth
@admin_only
def revoke_subscription():
    """Body: {user_id: uuid}

    Snaps the user's row to tier='free', status='canceled',
    current_period_end=now(). Used for manual claw-backs (refunds,
    abuse, end-of-trial). Safe to call on a user who's already free —
    it'll just bump `updated_at`."""
    body = request.get_json(silent=True) or {}
    user_id = (body.get("user_id") or "").strip()
    if not user_id:
        return jsonify({"error": "user_id_required"}), 400

    db = _db()
    now_iso = datetime.now(timezone.utc).isoformat()
    row = {
        "user_id": user_id,
        "tier": "free",
        "monthly_price_cents": 0,
        "current_period_end": now_iso,
        "status": "canceled",
        "updated_at": now_iso,
    }
    try:
        result = (
            db.table("subscriptions")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": "upsert_failed", "detail": str(e)}), 500

    saved = (result.data or [row])[0]
    return jsonify({
        "ok": True,
        "subscription": {
            "user_id": saved.get("user_id"),
            "tier": saved.get("tier"),
            "status": saved.get("status"),
            "current_period_end": saved.get("current_period_end"),
        },
    }), 200
