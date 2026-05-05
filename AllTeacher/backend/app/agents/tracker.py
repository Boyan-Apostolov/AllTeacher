"""Tracker — pure DB aggregator over curricula / weeks / exercises.

This module is the read side of the progress dashboard. Like
`exercise_bank`, it's deliberately not an LLM agent — every function is a
plain DB read that the orchestrator stitches into a response.

Two public surfaces:

  - `dashboard_summary(db, user_id)` — global rollup across every
    curriculum the user owns: streak, last-active timestamp, per-row
    sessions / exercises / avg_score / replan_count, and the top
    accumulated weak areas + strengths spanning all rows.

  - `curriculum_progress(db, curriculum_id)` — per-curriculum drilldown:
    every week's status + per-week avg_score, top weak areas + strengths
    accumulated from exercise feedback_json, replan count, last activity.

We keep aggregation in Python rather than SQL because Supabase's REST API
doesn't expose grouping primitives we'd want here, and the volumes are
small (≤ a few hundred exercises per curriculum).
"""
from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable


# How many top tags (weak / strength) to surface by default.
TOP_TAGS_DEFAULT = 5

# How many days of activity to roll up into the streak heatmap.
ACTIVITY_WINDOW_DAYS = 30


# --- helpers ---

def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        # Supabase serialises with Z; fromisoformat handles +00:00 since 3.11.
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _streak_from_days(active_days: set[date]) -> dict[str, int | str | None]:
    """Compute current streak (counting back from today) and best streak
    over the supplied set of dates.

    `current_days` allows a one-day grace — if the user hasn't practiced
    today yet but practiced yesterday, the streak is still alive.
    """
    if not active_days:
        return {"current_days": 0, "best_days": 0, "last_active": None}

    sorted_days = sorted(active_days)
    last = sorted_days[-1]

    # Best streak: walk forward and count consecutive runs.
    best = run = 1
    for prev, curr in zip(sorted_days, sorted_days[1:]):
        if (curr - prev).days == 1:
            run += 1
            best = max(best, run)
        else:
            run = 1

    # Current streak: anchor at today, walk back. Tolerate yesterday too
    # (so the streak survives until end-of-day local-ish time).
    today = _today_utc()
    if last < today - timedelta(days=1):
        current = 0
    else:
        anchor = last
        current = 1
        cursor = last - timedelta(days=1)
        while cursor in active_days:
            current += 1
            cursor -= timedelta(days=1)
        # If the user practiced today but also yesterday, anchor=today and
        # the loop above already counted yesterday correctly. If anchor is
        # yesterday, current also counts that day. Either way `current` is
        # the run length ending at `last`.
        _ = anchor  # keep mypy quiet; only needed for clarity.

    return {
        "current_days": current,
        "best_days": best,
        "last_active": last.isoformat(),
    }


def _activity_days_for_curricula(
    db,
    curriculum_ids: list[str],
) -> list[date]:
    """Distinct UTC dates on which the user submitted (and we evaluated)
    any exercise across the supplied curricula. Used both for the streak
    math and for the heatmap."""
    if not curriculum_ids:
        return []
    rows = (
        db.table("exercises")
        .select("evaluated_at")
        .in_("curriculum_id", curriculum_ids)
        .not_.is_("evaluated_at", "null")
        .execute()
    ).data or []
    days: set[date] = set()
    for r in rows:
        ts = _parse_iso(r.get("evaluated_at"))
        if ts:
            days.add(ts.astimezone(timezone.utc).date())
    return sorted(days)


def _heatmap(active_days: Iterable[date], window: int) -> list[dict[str, Any]]:
    """Last `window` days as [{date, active}] entries — oldest first."""
    today = _today_utc()
    active = set(active_days)
    return [
        {
            "date": (today - timedelta(days=i)).isoformat(),
            "active": (today - timedelta(days=i)) in active,
        }
        for i in range(window - 1, -1, -1)
    ]


def _tags_from_feedback(
    rows: Iterable[dict[str, Any]],
    field: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Count `field` (e.g. 'weak_areas' / 'strengths') across exercise
    feedback_json blobs. Returns [{tag, count}] in descending count order."""
    counter: Counter[str] = Counter()
    for r in rows:
        fb = r.get("feedback_json") or {}
        for tag in (fb.get(field) or []):
            if isinstance(tag, str) and tag.strip():
                counter[tag.strip()] += 1
    return [
        {"tag": tag, "count": count}
        for tag, count in counter.most_common(limit)
    ]


def mastered_concepts(
    rows: Iterable[dict[str, Any]],
    min_count: int = 2,
    limit: int = 20,
) -> list[str]:
    """Derive mastered concepts from exercise feedback_json strength tags.

    A concept is considered "mastered" when its strength tag has appeared
    in at least `min_count` evaluated exercises. Returns a plain list of
    tag strings, most-frequently-confirmed first, capped to `limit`.

    These are passed to the Explainer so each new lesson opens with a
    brief acknowledgement of what the user has already locked in.
    """
    counter: Counter[str] = Counter()
    for r in rows:
        fb = r.get("feedback_json") or {}
        for tag in (fb.get("strengths") or []):
            if isinstance(tag, str) and tag.strip():
                counter[tag.strip()] += 1
    return [
        tag for tag, count in counter.most_common(limit)
        if count >= min_count
    ]


# --- public surfaces ---

def dashboard_summary(db, user_id: str) -> dict[str, Any]:
    """Global rollup across every curriculum the user owns.

    Shape:
      {
        "streak": {"current_days", "best_days", "last_active"},
        "activity": [{"date", "active"}, ...],   # last 30 days
        "totals": {
          "curricula": int,
          "sessions_total": int,
          "sessions_completed": int,
          "exercises_total": int,
          "exercises_completed": int,
          "avg_score": float | null,
        },
        "top_weak_areas": [{"tag", "count"}, ...],
        "top_strengths":  [{"tag", "count"}, ...],
        "curricula": [
          {
            "id", "topic", "domain",
            "sessions_total", "sessions_completed",
            "exercises_total", "exercises_completed",
            "avg_score", "last_active_at", "replan_count",
            "current_week", "next_milestone",
          }
        ]
      }
    """
    curricula = (
        db.table("curricula")
        .select(
            "id,topic,goal,domain,plan_json,assessor_status,planner_status,"
            "level,replan_count,last_active_at,recent_weak_areas,"
            "recent_strengths,created_at"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    curriculum_ids = [c["id"] for c in curricula]

    weeks_rows = []
    exercises_rows = []
    if curriculum_ids:
        weeks_rows = (
            db.table("curriculum_weeks")
            .select("id,curriculum_id,week_number,plan_json,status,is_bonus")
            .in_("curriculum_id", curriculum_ids)
            .order("week_number")
            .execute()
        ).data or []
        exercises_rows = (
            db.table("exercises")
            .select(
                "id,curriculum_id,week_id,status,score,evaluated_at,feedback_json"
            )
            .in_("curriculum_id", curriculum_ids)
            .execute()
        ).data or []

    # Per-curriculum buckets.
    weeks_by_curr: dict[str, list[dict[str, Any]]] = {}
    for w in weeks_rows:
        weeks_by_curr.setdefault(w["curriculum_id"], []).append(w)

    ex_by_curr: dict[str, list[dict[str, Any]]] = {}
    for ex in exercises_rows:
        ex_by_curr.setdefault(ex["curriculum_id"], []).append(ex)

    # Activity / streak across all curricula.
    active_days_list = _activity_days_for_curricula(db, curriculum_ids)
    streak = _streak_from_days(set(active_days_list))
    activity = _heatmap(active_days_list, ACTIVITY_WINDOW_DAYS)

    # Aggregate top tags across every evaluated exercise the user has.
    top_weak = _tags_from_feedback(exercises_rows, "weak_areas", TOP_TAGS_DEFAULT)
    top_strengths = _tags_from_feedback(
        exercises_rows, "strengths", TOP_TAGS_DEFAULT
    )

    # Build per-curriculum row + accumulate totals.
    out_curricula = []
    totals = {
        "curricula": len(curricula),
        "sessions_total": 0,
        "sessions_completed": 0,
        "exercises_total": 0,
        "exercises_completed": 0,
        "score_sum": 0.0,
        "score_count": 0,
    }
    for c in curricula:
        weeks = weeks_by_curr.get(c["id"], [])
        exes = ex_by_curr.get(c["id"], [])

        sessions_total = len(weeks)
        sessions_completed = sum(1 for w in weeks if w.get("status") == "complete")
        ex_total = len(exes)
        ex_done = sum(1 for e in exes if e.get("status") == "evaluated")

        score_sum = sum(
            float(e["score"])
            for e in exes
            if e.get("status") == "evaluated" and e.get("score") is not None
        )
        score_count = sum(
            1
            for e in exes
            if e.get("status") == "evaluated" and e.get("score") is not None
        )
        avg_score = (score_sum / score_count) if score_count > 0 else None

        # Current week = first non-complete week, falling back to last week.
        current_week_number = None
        next_milestone = None
        for w in weeks:
            if w.get("status") != "complete":
                current_week_number = w.get("week_number")
                next_milestone = (w.get("plan_json") or {}).get("milestone")
                break
        if current_week_number is None and weeks:
            current_week_number = weeks[-1].get("week_number")

        out_curricula.append({
            "id": c["id"],
            "topic": c.get("topic"),
            "goal": c.get("goal"),
            "domain": c.get("domain"),
            "level": c.get("level"),
            "assessor_status": c.get("assessor_status"),
            "planner_status": c.get("planner_status"),
            "sessions_total": sessions_total,
            "sessions_completed": sessions_completed,
            "exercises_total": ex_total,
            "exercises_completed": ex_done,
            "avg_score": avg_score,
            "last_active_at": c.get("last_active_at"),
            "replan_count": int(c.get("replan_count") or 0),
            "current_week": current_week_number,
            "next_milestone": next_milestone,
        })

        totals["sessions_total"] += sessions_total
        totals["sessions_completed"] += sessions_completed
        totals["exercises_total"] += ex_total
        totals["exercises_completed"] += ex_done
        totals["score_sum"] += score_sum
        totals["score_count"] += score_count

    avg_total = (
        totals["score_sum"] / totals["score_count"]
        if totals["score_count"] > 0
        else None
    )

    return {
        "streak": streak,
        "activity": activity,
        "totals": {
            "curricula": totals["curricula"],
            "sessions_total": totals["sessions_total"],
            "sessions_completed": totals["sessions_completed"],
            "exercises_total": totals["exercises_total"],
            "exercises_completed": totals["exercises_completed"],
            "avg_score": avg_total,
        },
        "top_weak_areas": top_weak,
        "top_strengths": top_strengths,
        "curricula": out_curricula,
    }


def curriculum_progress(db, curriculum_id: str) -> dict[str, Any]:
    """Per-curriculum drilldown — assumes ownership has already been
    verified by the caller (the orchestrator does this before calling).

    Shape:
      {
        "id": str,
        "topic": str,
        "domain": str,
        "level": str,
        "replan_count": int,
        "last_active_at": str | null,
        "totals": {sessions_total, sessions_completed,
                   exercises_total, exercises_completed, avg_score},
        "weeks": [{id, week_number, title, status, is_bonus,
                   exercises_total, exercises_completed, avg_score}],
        "top_weak_areas": [{tag, count}, ...],
        "top_strengths":  [{tag, count}, ...],
        "streak": {current_days, best_days, last_active},
        "activity": [{date, active}, ...],   # last 30 days
      }
    """
    row = (
        db.table("curricula")
        .select(
            "id,topic,goal,domain,level,replan_count,last_active_at,"
            "recent_weak_areas,recent_strengths"
        )
        .eq("id", curriculum_id)
        .single()
        .execute()
    ).data
    if not row:
        return {}

    weeks = (
        db.table("curriculum_weeks")
        .select("id,week_number,plan_json,status,is_bonus")
        .eq("curriculum_id", curriculum_id)
        .order("week_number")
        .execute()
    ).data or []

    exes = (
        db.table("exercises")
        .select(
            "id,week_id,status,score,evaluated_at,feedback_json"
        )
        .eq("curriculum_id", curriculum_id)
        .execute()
    ).data or []

    # Per-week aggregates.
    by_week: dict[str, dict[str, Any]] = {}
    for ex in exes:
        wk = ex.get("week_id")
        if not wk:
            continue
        s = by_week.setdefault(
            wk,
            {"total": 0, "done": 0, "score_sum": 0.0, "score_count": 0},
        )
        s["total"] += 1
        if ex.get("status") == "evaluated":
            s["done"] += 1
            if ex.get("score") is not None:
                s["score_sum"] += float(ex["score"])
                s["score_count"] += 1

    weeks_out = []
    sessions_total = len(weeks)
    sessions_completed = 0
    for w in weeks:
        plan = w.get("plan_json") or {}
        agg = by_week.get(w["id"], {})
        score_count = int(agg.get("score_count", 0))
        avg = (
            float(agg["score_sum"]) / score_count
            if score_count > 0
            else None
        )
        if w.get("status") == "complete":
            sessions_completed += 1
        weeks_out.append({
            "id": w["id"],
            "week_number": w.get("week_number"),
            "title": plan.get("title"),
            "status": w.get("status"),
            "is_bonus": bool(w.get("is_bonus")),
            "exercises_total": int(agg.get("total", 0)),
            "exercises_completed": int(agg.get("done", 0)),
            "avg_score": avg,
        })

    ex_total = len(exes)
    ex_done = sum(1 for e in exes if e.get("status") == "evaluated")
    score_sum = sum(
        float(e["score"]) for e in exes
        if e.get("status") == "evaluated" and e.get("score") is not None
    )
    score_count = sum(
        1 for e in exes
        if e.get("status") == "evaluated" and e.get("score") is not None
    )
    avg_score = (score_sum / score_count) if score_count > 0 else None

    top_weak = _tags_from_feedback(exes, "weak_areas", TOP_TAGS_DEFAULT)
    top_strengths = _tags_from_feedback(exes, "strengths", TOP_TAGS_DEFAULT)
    mastered = mastered_concepts(exes)

    days = _activity_days_for_curricula(db, [curriculum_id])
    streak = _streak_from_days(set(days))
    activity = _heatmap(days, ACTIVITY_WINDOW_DAYS)

    return {
        "id": row["id"],
        "topic": row.get("topic"),
        "goal": row.get("goal"),
        "domain": row.get("domain"),
        "level": row.get("level"),
        "replan_count": int(row.get("replan_count") or 0),
        "last_active_at": row.get("last_active_at"),
        "totals": {
            "sessions_total": sessions_total,
            "sessions_completed": sessions_completed,
            "exercises_total": ex_total,
            "exercises_completed": ex_done,
            "avg_score": avg_score,
        },
        "weeks": weeks_out,
        "top_weak_areas": top_weak,
        "top_strengths": top_strengths,
        "mastered_concepts": mastered,
        "streak": streak,
        "activity": activity,
    }


# --- write paths (called from the orchestrator on submit) ---

def merge_recent_strengths(
    existing: list[str] | None,
    incoming: list[str] | None,
    cap: int = 12,
) -> list[str]:
    """Same shape as exercise_bank.merge_recent_weak_areas. Newest first,
    deduped, capped to `cap` entries."""
    if not incoming:
        return list(existing or [])
    seen: set[str] = set()
    out: list[str] = []
    for tag in (incoming or []) + (existing or []):
        if not isinstance(tag, str):
            continue
        norm = tag.strip()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        out.append(norm)
        if len(out) >= cap:
            break
    return out
