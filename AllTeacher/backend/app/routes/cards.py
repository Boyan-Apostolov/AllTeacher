"""Knowledge card routes — Library page CRUD + spaced-repetition practice.

GET    /cards                 list user's cards (filters: q, curriculum_id, filter)
POST   /cards                 manually create a card
PATCH  /cards/<id>/practice   record a practice rating, update mastery + next_due
PATCH  /cards/<id>/mastered   toggle mastered (mastery=100) or back to review (mastery=40)
DELETE /cards/<id>            delete a card
"""
import logging
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request

from app.db.supabase import service_client
from app.middleware.auth import require_auth

log = logging.getLogger(__name__)

bp = Blueprint("cards", __name__, url_prefix="/cards")


def _db():
    c = service_client()
    if c is None:
        raise RuntimeError("Supabase service client not configured")
    return c


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


# ─── Spaced repetition helpers ───────────────────────────────────────────────

# Mastery delta per practice rating
_MASTERY_DELTA = {"easy": 15, "medium": 8, "hard": 3}

# Days until next review, keyed by the NEW mastery bucket after practice
def _next_due_days(mastery: int) -> int:
    if mastery >= 90: return 14
    if mastery >= 75: return 7
    if mastery >= 55: return 4
    if mastery >= 35: return 2
    return 1


def _compute_next_due(mastery: int) -> str:
    return _iso(_now() + timedelta(days=_next_due_days(mastery)))


# ─── Routes ──────────────────────────────────────────────────────────────────

@bp.get("")
@require_auth
def list_cards():
    """List all knowledge cards for the authenticated user.

    Query params:
      q           — free-text search (front, back, example)
      curriculum_id — filter to one curriculum
      filter      — "all" | "due" | "review" | "mastered" (default "all")
    """
    db = _db()
    user_id = g.user_id
    q = (request.args.get("q") or "").strip().lower()
    curriculum_id = request.args.get("curriculum_id") or None
    filt = request.args.get("filter", "all")

    today_iso = _iso(_now())

    query = (
        db.table("knowledge_cards")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )

    if curriculum_id:
        query = query.eq("curriculum_id", curriculum_id)

    if filt == "due":
        # Cards where next_due is in the past (or null = overdue)
        query = query.lte("next_due", today_iso)
    elif filt == "mastered":
        query = query.gte("mastery", 80)
    elif filt == "review":
        query = query.lt("mastery", 80)

    rows = query.execute().data or []

    # Free-text filter (Supabase PostgREST doesn't do case-insensitive
    # multi-column search in one query, so we filter client-side here —
    # card counts are per-user and stay small.)
    if q:
        rows = [
            r for r in rows
            if q in (r.get("front") or "").lower()
            or q in (r.get("back") or "").lower()
            or q in (r.get("example") or "").lower()
        ]

    return jsonify({"cards": rows})


@bp.post("")
@require_auth
def create_card():
    """Manually add a knowledge card."""
    db = _db()
    body = request.get_json(force=True) or {}

    front = (body.get("front") or "").strip()
    back = (body.get("back") or "").strip()
    if not front or not back:
        return jsonify({"error": "front_and_back_required"}), 400

    domain = (body.get("domain") or "general").strip()
    curriculum_name = (body.get("curriculum") or "").strip()
    curriculum_id = body.get("curriculum_id") or None
    emoji = (body.get("emoji") or _domain_emoji(domain)).strip()
    difficulty = body.get("difficulty") or "medium"
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    now = _now()
    row = {
        "user_id": g.user_id,
        "front": front,
        "back": back,
        "example": body.get("example") or None,
        "domain": domain,
        "curriculum": curriculum_name,
        "curriculum_id": curriculum_id,
        "emoji": emoji,
        "difficulty": difficulty,
        "mastery": 0,
        "last_reviewed": None,
        "next_due": _iso(now + timedelta(days=1)),
        "source": "manual",
        "source_id": None,
    }

    inserted = (db.table("knowledge_cards").insert(row).execute()).data or []
    if not inserted:
        return jsonify({"error": "insert_failed"}), 500

    return jsonify({"card": inserted[0]}), 201


@bp.patch("/<card_id>/practice")
@require_auth
def practice_card(card_id: str):
    """Record a practice session.  Body: { "rating": "easy"|"medium"|"hard" }
    Updates mastery and schedules next_due via the SM-2-inspired intervals.
    """
    db = _db()
    body = request.get_json(force=True) or {}

    rating = body.get("rating") or "medium"
    if rating not in _MASTERY_DELTA:
        return jsonify({"error": "invalid_rating", "valid": ["easy", "medium", "hard"]}), 400

    card = _load_card(db, card_id, g.user_id)

    new_mastery = min(100, (card.get("mastery") or 0) + _MASTERY_DELTA[rating])
    now_iso = _iso(_now())

    updated = (
        db.table("knowledge_cards")
        .update({
            "mastery": new_mastery,
            "last_reviewed": now_iso,
            "next_due": _compute_next_due(new_mastery),
        })
        .eq("id", card_id)
        .execute()
    ).data or []

    return jsonify({"card": updated[0] if updated else card})


@bp.patch("/<card_id>/mastered")
@require_auth
def toggle_mastered(card_id: str):
    """Toggle mastered state.

    If mastery >= 80 → bring back to review: mastery = 40, next_due = tomorrow.
    If mastery < 80  → mark mastered: mastery = 100, next_due = 14 days.
    """
    db = _db()
    card = _load_card(db, card_id, g.user_id)
    now_iso = _iso(_now())

    if (card.get("mastery") or 0) >= 80:
        new_mastery = 40
        next_due = _iso(_now() + timedelta(days=1))
    else:
        new_mastery = 100
        next_due = _iso(_now() + timedelta(days=14))

    updated = (
        db.table("knowledge_cards")
        .update({
            "mastery": new_mastery,
            "last_reviewed": now_iso,
            "next_due": next_due,
        })
        .eq("id", card_id)
        .execute()
    ).data or []

    return jsonify({"card": updated[0] if updated else card})


@bp.delete("/<card_id>")
@require_auth
def delete_card(card_id: str):
    _load_card(_db(), card_id, g.user_id)  # ownership check
    _db().table("knowledge_cards").delete().eq("id", card_id).execute()
    return jsonify({"ok": True, "id": card_id})


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _load_card(db, card_id: str, user_id: str) -> dict:
    rows = (
        db.table("knowledge_cards")
        .select("*")
        .eq("id", card_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        from flask import abort
        abort(404, description="card_not_found")
    return rows[0]


_DOMAIN_EMOJI = {
    "language": "🗣️",
    "math": "📐",
    "code": "💻",
    "music": "🎵",
    "cooking": "🍳",
    "science": "🔬",
    "history": "📜",
    "art": "🎨",
    "fitness": "🏋️",
    "business": "📊",
}


def _domain_emoji(domain: str) -> str:
    return _DOMAIN_EMOJI.get((domain or "general").lower(), "📝")
