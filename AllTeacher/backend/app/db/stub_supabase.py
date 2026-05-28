"""Stub Supabase client for fully-offline load / smoke testing.

Activated when STUB_DB=true is set alongside STUB_AGENTS=true.

Implements the fluent query builder interface used throughout the codebase:
    db.table("curricula").select("*").eq("user_id", x).limit(1).execute()

Every .execute() returns a SimpleNamespace with a .data list. Writes
(insert/upsert/update/delete) return the row(s) passed in, with a stub
`id` injected if missing, so callers that read .data[0]["id"] don't crash.

Tables and their stub row shapes mirror the real schema just enough for
routes and orchestrator code to parse without errors.
"""
from __future__ import annotations

import time
import types
import uuid
from typing import Any


# ── canned row templates ──────────────────────────────────────────────────────

def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _stub_curriculum(user_id: str = "stub-user") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "topic": "Load test topic",
        "domain": "language",
        "status": "active",
        "native_language": "en",
        "target_language": "fr",
        "goal": "Learn French",
        "assessment_json": {
            "transcript": [],
            "summary": {
                "level": "beginner",
                "learning_style": "practice",
                "time_budget_mins_per_week": 60,
                "domain": "language",
                "target_language": "fr",
                "notes": "stub",
            },
        },
        "plan_json": None,
        "created_at": _now(),
        "updated_at": _now(),
    }


def _stub_week(curriculum_id: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "curriculum_id": curriculum_id,
        "week_number": 1,
        "plan_json": {
            "theme": "Introduction",
            "objectives": ["Learn basics"],
            "modules": [{"title": "Greetings", "description": "...", "skills": []}],
        },
        "status": "active",
        "created_at": _now(),
    }


def _stub_lesson(curriculum_id: str, week_id: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "curriculum_id": curriculum_id,
        "week_id": week_id,
        "module_index": 0,
        "title": "Greetings",
        "body": "Bonjour means hello.",
        "key_points": ["Bonjour = Hello"],
        "seen": False,
        "created_at": _now(),
    }


def _stub_exercise(curriculum_id: str, week_id: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "curriculum_id": curriculum_id,
        "week_id": week_id,
        "module_index": 0,
        "type": "multiple_choice",
        "content_json": {
            "prompt": "What does 'Bonjour' mean?",
            "options": ["Hello", "Goodbye"],
            "answer": "Hello",
        },
        "seen": False,
        "score": None,
        "feedback_json": None,
        "created_at": _now(),
    }


def _stub_subscription(user_id: str) -> dict:
    return {
        "user_id": user_id,
        "tier": "pro",
        "status": "active",
        "revenuecat_id": "stub",
        "token_usage_month": 0,
        "current_period_end": None,
        "updated_at": _now(),
    }


def _stub_mastery(user_id: str, curriculum_id: str) -> dict:
    return {
        "user_id": user_id,
        "curriculum_id": curriculum_id,
        "topic": "stub",
        "score": 0.5,
        "updated_at": _now(),
    }


_STUB_ROWS: dict[str, list[dict]] = {
    "users": [],
    "subscriptions": [],
    "curricula": [],
    "curriculum_weeks": [],
    "lessons": [],
    "exercises": [],
    "knowledge_cards": [],
    "sessions": [],
    "mastery_scores": [],
    "request_logs": [],
    "token_usage_log": [],
}


# ── fluent query builder ──────────────────────────────────────────────────────

class _Result:
    def __init__(self, data: list[dict]):
        self.data = data
        self.count = len(data)


class _QueryBuilder:
    """Chainable stub that absorbs every filter/modifier and returns stub data."""

    def __init__(self, table: str):
        self._table = table
        self._filters: dict[str, Any] = {}
        self._limit: int | None = None
        self._pending_insert: list[dict] | None = None
        self._pending_upsert: list[dict] | None = None
        self._pending_update: dict | None = None
        self._is_delete = False
        self._returning_cols: list[str] = []
        self._single = False  # True when .single() or .maybe_single() called

    # selects / modifiers (all return self for chaining)
    def select(self, *_a, **_kw):        return self
    def eq(self, col, val):
        self._filters[col] = val
        return self
    def neq(self, *_a, **_kw):          return self
    def in_(self, *_a, **_kw):          return self
    def is_(self, *_a, **_kw):          return self
    def filter(self, *_a, **_kw):       return self
    def order(self, *_a, **_kw):        return self
    def limit(self, n, *_a, **_kw):
        self._limit = n
        return self
    def single(self):
        self._single = True
        return self
    def maybe_single(self):
        self._single = True
        return self
    def returning(self, *cols):
        self._returning_cols = list(cols)
        return self

    # .not_ is a property returning self so `.not_.is_(...)` chains correctly
    @property
    def not_(self):
        return self

    # writes
    def insert(self, row_or_rows, **_kw):
        rows = row_or_rows if isinstance(row_or_rows, list) else [row_or_rows]
        self._pending_insert = rows
        return self

    def upsert(self, row_or_rows, **_kw):
        rows = row_or_rows if isinstance(row_or_rows, list) else [row_or_rows]
        self._pending_upsert = rows
        return self

    def update(self, data, **_kw):
        self._pending_update = data
        return self

    def delete(self):
        self._is_delete = True
        return self

    def execute(self) -> _Result:
        # ── writes ──
        if self._pending_insert is not None:
            rows = [{"id": str(uuid.uuid4()), **r} for r in self._pending_insert]
            _STUB_ROWS.setdefault(self._table, []).extend(rows)
            return _Result(rows)

        if self._pending_upsert is not None:
            rows = [{"id": str(uuid.uuid4()), **r} for r in self._pending_upsert]
            _STUB_ROWS.setdefault(self._table, []).extend(rows)
            return _Result(rows)

        if self._pending_update is not None:
            # Mutate matching rows in-place so subsequent reads see the change.
            updated = []
            for row in _STUB_ROWS.get(self._table, []):
                if all(row.get(col) == val for col, val in self._filters.items()):
                    row.update(self._pending_update)
                    updated.append(row)
            return _Result(updated if updated else [{**self._pending_update}])

        if self._is_delete:
            # Remove matching rows from in-memory store.
            store = _STUB_ROWS.get(self._table, [])
            kept = [r for r in store if not all(r.get(c) == v for c, v in self._filters.items())]
            _STUB_ROWS[self._table] = kept
            return _Result([])

        # ── reads: filter in-memory stub rows ──
        rows = list(_STUB_ROWS.get(self._table, []))
        for col, val in self._filters.items():
            rows = [r for r in rows if r.get(col) == val]

        # If no rows exist yet for this table, synthesise one so callers
        # that expect at least one row (e.g. _load_curriculum) don't 404.
        if not rows:
            rows = self._synthesise()

        if self._limit is not None:
            rows = rows[: self._limit]

        # .single() / .maybe_single() — callers do `.data` and call .get()
        # directly on the result, so we unwrap to a dict (or None).
        if self._single:
            result = _Result([])
            result.data = rows[0] if rows else None
            result.count = 1 if rows else 0
            return result

        return _Result(rows)

    def _synthesise(self) -> list[dict]:
        """Return a minimal synthetic row for tables that are always expected to have data."""
        uid = self._filters.get("user_id", "stub-user")
        cid = self._filters.get("curriculum_id", str(uuid.uuid4()))

        mapping = {
            "curricula":        lambda: [_stub_curriculum(uid)],
            "curriculum_weeks": lambda: [_stub_week(cid)],
            "lessons":          lambda: [_stub_lesson(cid, str(uuid.uuid4()))],
            "exercises":        lambda: [_stub_exercise(cid, str(uuid.uuid4()))],
            "subscriptions":    lambda: [_stub_subscription(uid)],
            "mastery_scores":   lambda: [_stub_mastery(uid, cid)],
        }
        factory = mapping.get(self._table)
        return factory() if factory else []


# ── public stub client ────────────────────────────────────────────────────────

class StubSupabaseClient:
    """Drop-in for the real Supabase client.

    Only implements .table() — everything else the codebase uses is routed
    through that. Storage calls (used by media.py) are no-ops.
    """

    def table(self, name: str) -> _QueryBuilder:
        return _QueryBuilder(name)

    # Storage — media.py uploads audio; stub swallows silently.
    @property
    def storage(self):
        class _StorageStub:
            def from_(self, *_a, **_kw):
                class _BucketStub:
                    def upload(self, *_a, **_kw): return types.SimpleNamespace(path="stub")
                    def get_public_url(self, *_a, **_kw): return "https://stub.example.com/audio.mp3"
                    def remove(self, *_a, **_kw): return None
                return _BucketStub()
        return _StorageStub()

    # Auth admin — used by admin routes only.
    @property
    def auth(self):
        class _AuthStub:
            class admin:
                @staticmethod
                def list_users(*_a, **_kw):
                    return types.SimpleNamespace(users=[])
        return _AuthStub()
