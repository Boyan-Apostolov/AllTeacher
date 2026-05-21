"""Exercise Bank — global, user-agnostic store of exercise content.

The bank exists so we don't burn LLM tokens regenerating the same content
for every user. Two retrieval modes:

  - find_first_session: the canonical first-session bucket, keyed by
    (domain, level, target_language). Same for everyone — generate-once-
    then-freeze.

  - find_for_week: adaptive bucket for follow-up sessions, keyed by
    (domain, level, target_language, week_number) and ranked by overlap
    with the user's recent weak_areas.

Anything the LLM generates is written back via save_batch so the next
caller in the same bucket gets a cache hit instead of an OpenAI bill.

This module is thin — no agent calls. The Orchestrator owns the
bank-vs-LLM decision and persists per-user `exercises` rows pointing back
at the bank row via `exercises.bank_id`.
"""
from __future__ import annotations

from typing import Any, Iterable


# How many `recent_weak_areas` entries to keep per curriculum. Older
# struggles drop off so adaptation tracks recent performance.
RECENT_WEAK_AREAS_CAP = 12


# --- read paths ---

def find_first_session(
    db,
    *,
    domain: str,
    level: str,
    target_language: str | None,
    count: int,
) -> list[dict[str, Any]]:
    """Return up to `count` canonical first-session bank rows for the given
    (domain, level, target_language). Ordered by `created_at` so the same
    set of users always gets the same first session (stable ordering)."""
    if not domain or not level or count <= 0:
        return []

    q = (
        db.table("exercise_bank")
        .select("*")
        .eq("is_first_session", True)
        .eq("domain", domain)
        .eq("level", level)
        .order("created_at")
        .limit(count)
    )
    if target_language:
        q = q.eq("target_language", target_language)
    else:
        q = q.is_("target_language", "null")
    rows = q.execute().data or []
    return rows


def find_for_week(
    db,
    *,
    domain: str,
    level: str,
    target_language: str | None,
    week_number: int,
    weak_areas: Iterable[str],
    count: int,
) -> list[dict[str, Any]]:
    """Return up to `count` bank rows for a follow-up session, ranked by
    overlap with `weak_areas`. We over-fetch then sort in Python so we can
    rank by overlap size — Supabase's REST surface doesn't expose the
    array `&&` cardinality directly.

    Ranking:
      1. Highest weak_area overlap with the user's recent struggles.
      2. Among ties, more recent rows first (fresh content beats stale).
    """
    if not domain or not level or count <= 0:
        return []

    q = (
        db.table("exercise_bank")
        .select("*")
        .eq("is_first_session", False)
        .eq("domain", domain)
        .eq("level", level)
        .eq("week_number", int(week_number))
        # Over-fetch — we have to score in Python.
        .order("created_at", desc=True)
        .limit(max(count * 4, 20))
    )
    if target_language:
        q = q.eq("target_language", target_language)
    else:
        q = q.is_("target_language", "null")
    rows = q.execute().data or []
    if not rows:
        return []

    wa_set = {w.strip().lower() for w in (weak_areas or []) if w}

    def _overlap(row: dict[str, Any]) -> int:
        row_wa = {
            (w or "").strip().lower()
            for w in (row.get("weak_areas") or [])
        }
        return len(wa_set & row_wa) if wa_set else 0

    # Stable sort: highest overlap first; ties broken by created_at desc
    # (already the input order, so a stable sort preserves it).
    rows.sort(key=_overlap, reverse=True)
    return rows[:count]


# --- write path ---

def save_batch(
    db,
    *,
    exercises: list[dict[str, Any]],
    domain: str,
    level: str,
    target_language: str | None,
    week_number: int | None,
    is_first_session: bool,
    weak_areas: list[str],
    exercise_focus: list[str],
) -> list[dict[str, Any]]:
    """Persist freshly-generated exercises into the bank under the given
    key, deduping by title within the bucket.

    Returns the bank rows (existing + newly-inserted) keyed by the titles
    we attempted, so the caller can map content → bank_id.

    We avoid Postgres `ON CONFLICT` because the dedupe index wraps two
    nullable columns in `coalesce(...)` — PostgREST can't match an
    expression-based unique index as a conflict target. Instead we do a
    SELECT-then-INSERT pass: read existing titles in the bucket, insert
    only the new ones. The unique index still defends against races; if
    a concurrent insert races us we retry the read.

    For first-session inserts, week_number is forced to None.
    """
    if not exercises:
        return []

    bucket_week_number = None if is_first_session else week_number

    candidates: list[dict[str, Any]] = []
    for ex in exercises:
        title = (ex.get("title") or "").strip()
        if not title or not ex.get("type"):
            # Drop unusable rows — title doubles as the dedupe key, and
            # type is required.
            continue
        candidates.append(
            {
                "domain": domain,
                "level": level,
                "target_language": target_language,
                "week_number": bucket_week_number,
                "is_first_session": bool(is_first_session),
                "weak_areas": list(weak_areas or []),
                "exercise_focus": list(exercise_focus or []),
                "type": ex.get("type"),
                "title": title,
                "content_json": ex,
                "source": "generated",
            }
        )

    if not candidates:
        return []

    titles = [c["title"] for c in candidates]
    existing = _fetch_bucket_rows(
        db,
        domain=domain,
        level=level,
        target_language=target_language,
        week_number=bucket_week_number,
        is_first_session=is_first_session,
        titles=titles,
    )
    existing_titles = {r.get("title") for r in existing}

    fresh = [c for c in candidates if c["title"] not in existing_titles]
    inserted: list[dict[str, Any]] = []
    if fresh:
        try:
            inserted = (
                db.table("exercise_bank")
                .insert(fresh)
                .execute()
            ).data or []
        except Exception:
            # Lost a race against a concurrent insert. Re-fetch — the
            # other writer's rows now cover the missing titles.
            inserted = []
            existing = _fetch_bucket_rows(
                db,
                domain=domain,
                level=level,
                target_language=target_language,
                week_number=bucket_week_number,
                is_first_session=is_first_session,
                titles=titles,
            )

    return existing + inserted


def _fetch_bucket_rows(
    db,
    *,
    domain: str,
    level: str,
    target_language: str | None,
    week_number: int | None,
    is_first_session: bool,
    titles: list[str],
) -> list[dict[str, Any]]:
    """Return existing exercise_bank rows for the given bucket whose
    titles are in `titles`. Used by save_batch to skip duplicates."""
    if not titles:
        return []
    q = (
        db.table("exercise_bank")
        .select("*")
        .eq("domain", domain)
        .eq("level", level)
        .eq("is_first_session", bool(is_first_session))
        .in_("title", titles)
    )
    if target_language:
        q = q.eq("target_language", target_language)
    else:
        q = q.is_("target_language", "null")
    if not is_first_session and week_number is not None:
        q = q.eq("week_number", int(week_number))
    return q.execute().data or []


# --- weak-areas bookkeeping ---

def merge_recent_weak_areas(
    existing: Iterable[str] | None,
    incoming: Iterable[str] | None,
    cap: int = RECENT_WEAK_AREAS_CAP,
) -> list[str]:
    """Return the merged weak-areas list capped to the most recent `cap`
    entries. Newest items first. Case-insensitive dedupe but original
    casing preserved on first-seen."""
    out: list[str] = []
    seen: set[str] = set()

    def _push(items: Iterable[str] | None):
        for raw in items or []:
            if not raw:
                continue
            key = raw.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(raw.strip())

    # Newest (incoming) first so they win on dedupe.
    _push(incoming)
    _push(existing)
    return out[:cap]


def bump_usage(db, bank_ids: Iterable[str]) -> None:
    """Best-effort usage_count++ for a set of bank rows. Silently ignores
    failures — usage stats are nice-to-have, not load-bearing."""
    ids = [bid for bid in bank_ids if bid]
    if not ids:
        return
    try:
        # Supabase python client doesn't have a native increment; do it
        # row-by-row for now. Cheap, runs once per session generation.
        for bid in ids:
            row = (
                db.table("exercise_bank")
                .select("usage_count")
                .eq("id", bid)
                .single()
                .execute()
            ).data
            if row is None:
                continue
            db.table("exercise_bank").update(
                {"usage_count": int(row.get("usage_count") or 0) + 1}
            ).eq("id", bid).execute()
    except Exception:
        # Bookkeeping failure must never block exercise delivery.
        return
