"""AllTeacher load tests — realistic full user journey.

Prerequisites
-------------
1. Start Flask in stub mode (see load_tests/README.md).
2. Install locust: pip install locust

Run (headless, 10 users, 60 s):
    locust -f load_tests/locustfile.py --headless \
        -u 10 -r 2 --run-time 60s \
        --host http://localhost:5001

Run (web UI at http://localhost:8089):
    locust -f load_tests/locustfile.py --host http://localhost:5001

Environment variables (override defaults):
    LOAD_TEST_SECRET   Bearer token accepted by the auth bypass (default: loadtest)
    LOAD_TEST_TIER     Tier header sent with every request (default: pro)
"""
from __future__ import annotations

import itertools
import json
import os
import random
import time

from locust import HttpUser, between, task

# ── config ────────────────────────────────────────────────────────────────────

_SECRET = os.getenv("LOAD_TEST_SECRET", "loadtest")
_TIER   = os.getenv("LOAD_TEST_TIER", "pro")

# Fixed UUIDs matching load_tests/seed_load_test_users.sql.
# When running against a real Supabase these users must be pre-seeded;
# in STUB_DB mode any UUID works fine.
LOAD_TEST_UIDS = [
    ("0",  "d8fb3abf-7224-83dd-2b22-9be346476db2"),
    ("1",  "1440bef5-4d9c-5fdf-accc-9306d3c5c4f9"),
    ("2",  "2c09a2e4-fd4c-704e-fdf3-9eb584ca5cdc"),
    ("3",  "fcc2e87e-5740-f53f-9494-1c0d27a55291"),
    ("4",  "00ebbeb7-232b-dac1-2675-81a76b3306c0"),
    ("5",  "9d4daa4c-81ee-bb7c-ab68-3793447f9f76"),
    ("6",  "4c5209d5-f81f-fadc-4a55-c9c60dac21e0"),
    ("7",  "b54184b1-8dcf-e221-e9f9-cd758451c52f"),
    ("8",  "63c42f40-ec33-89c7-ae1f-98f2bd83d220"),
    ("9",  "d30d6887-6d79-995e-6a4b-d2baaed6dfa4"),
    ("10", "21c23813-d5dd-6e5e-323c-3f26bc01b1d7"),
    ("11", "4f420ac2-6a81-6f23-100d-def4c73265fe"),
    ("12", "4cc409c1-7571-4536-d32b-aa2fd66bec86"),
    ("13", "661977f0-7152-c230-a7fb-1bddf202da15"),
    ("14", "5aa914c4-ba15-0e24-9a00-8c1976a41cd8"),
    ("15", "1aa1b94c-c06b-9a2a-a28c-723090017a13"),
    ("16", "7af95937-1e0a-b9b4-3969-cc23153237ea"),
    ("17", "197df305-7343-93fa-a23d-b634aecbc363"),
    ("18", "32e10a3c-bd84-acbd-fbb7-288d51b33f98"),
    ("19", "0c88965d-9de4-532a-35f1-74213e9c5d82"),
]

# Round-robin counter shared across all spawned users.
_uid_cycle = itertools.cycle(range(len(LOAD_TEST_UIDS)))

_GOALS = [
    "Learn conversational French",
    "Improve my Python skills",
    "Get better at guitar",
    "Study for my maths exam",
    "Learn to cook Italian food",
    "Improve my public speaking",
    "Learn Japanese from scratch",
]

_NATIVE_LANGUAGES = ["en", "bg", "de", "es", "fr", "it", "pt"]


# ── helpers ────────────────────────────────────────────────────────────────────

class _API:
    """Thin request wrapper that adds auth headers and logs failures."""

    def __init__(self, client, worker_id: str):
        self._c = client
        self._headers = {
            "Authorization": f"Bearer {_SECRET}",
            "X-Load-Test-User": worker_id,
            "X-Load-Test-Tier": _TIER,
            "Content-Type": "application/json",
        }

    def post(self, path: str, body: dict, name: str | None = None) -> dict | None:
        r = self._c.post(
            path,
            data=json.dumps(body),
            headers=self._headers,
            name=name or path,
            catch_response=True,
        )
        with r:
            if r.status_code >= 400:
                r.failure(f"HTTP {r.status_code}: {r.text[:200]}")
                return None
            r.success()
            try:
                return r.json()
            except Exception:
                return {}

    def get(self, path: str, name: str | None = None) -> dict | list | None:
        r = self._c.get(
            path,
            headers=self._headers,
            name=name or path,
            catch_response=True,
        )
        with r:
            if r.status_code >= 400:
                r.failure(f"HTTP {r.status_code}: {r.text[:200]}")
                return None
            r.success()
            try:
                return r.json()
            except Exception:
                return {}

    def post_sse(self, path: str, body: dict, name: str | None = None) -> None:
        """POST to a streaming SSE endpoint; consumes the whole response."""
        r = self._c.post(
            path,
            data=json.dumps(body),
            headers={**self._headers, "Accept": "text/event-stream"},
            name=name or path,
            stream=True,
            catch_response=True,
        )
        with r:
            if r.status_code >= 400:
                r.failure(f"HTTP {r.status_code}: {r.text[:200]}")
                return
            # Drain the stream to measure full latency
            for _ in r.iter_lines():
                pass
            r.success()


# ── user journey ──────────────────────────────────────────────────────────────

class AllTeacherUser(HttpUser):
    """Simulates a single learner going through the full AllTeacher flow.

    Task weights (higher = more frequent):
      - full_journey  : 1  (rare — expensive multi-step flow, run once per user)
      - list_curricula: 3  (common — home screen poll)
      - health_check  : 2  (background ping)

    Think time: 1–5 s between tasks (simulates human reading time).
    """

    wait_time = between(1, 5)

    def on_start(self):
        """Called once per simulated user. Assign a slot from the fixed pool."""
        slot = next(_uid_cycle)
        self._worker_index, self._worker_uuid = LOAD_TEST_UIDS[slot]
        self._api = _API(self.client, self._worker_index)
        self._curriculum_id: str | None = None
        self._week_id: str | None = None
        self._exercise_id: str | None = None
        self._lesson_id: str | None = None

    # ── individual tasks ──────────────────────────────────────────────────────

    @task(2)
    def health_check(self):
        """GET /health — zero-auth sanity ping."""
        self.client.get("/health", name="/health")

    @task(3)
    def list_curricula(self):
        """GET /curriculum — home screen poll (most common real-world request)."""
        self._api.get("/curriculum", name="GET /curriculum")

    @task(1)
    def full_journey(self):
        """Create curriculum → assess → plan → lesson → exercises → submit."""
        cid, create_data = self._step_create_curriculum()
        if not cid:
            return

        # Only submit an assessor answer if the server returned a pending
        # question (next != null). The stub resolves immediately with
        # complete=true so next=null — this branch is skipped in stub mode
        # but exercised correctly against a real backend.
        if (create_data or {}).get("next"):
            self._step_assessor(cid)
        time.sleep(random.uniform(0.5, 1.5))  # think time

        # Planner
        wid = self._step_plan(cid)
        if not wid:
            return
        time.sleep(random.uniform(0.5, 1.5))

        # Lesson (explainer)
        lid = self._step_lesson(cid, wid)
        time.sleep(random.uniform(0.5, 2.0))

        # Mark lesson seen if we got one
        if lid:
            self._api.post(f"/curriculum/lessons/{lid}/seen", {}, name="POST /curriculum/lessons/<id>/seen")

        # Exercises
        eid = self._step_exercises(cid, wid)
        if not eid:
            return
        time.sleep(random.uniform(1.0, 3.0))

        # Submit — streaming variant (realistic mobile path)
        self._step_submit_stream(eid)

        # Progress dashboard
        self._api.get(f"/curriculum/{cid}/progress", name="GET /curriculum/<id>/progress")

    # ── step helpers ──────────────────────────────────────────────────────────

    def _step_create_curriculum(self) -> tuple[str | None, dict | None]:
        data = self._api.post(
            "/curriculum",
            {
                "goal": random.choice(_GOALS),
                "native_language": random.choice(_NATIVE_LANGUAGES),
            },
            name="POST /curriculum",
        )
        return (data or {}).get("id"), data

    def _step_assessor(self, cid: str) -> None:
        """Submit one assessor answer. Stub resolves immediately."""
        self._api.post(
            f"/curriculum/{cid}/assessor",
            {"answer": "B"},
            name="POST /curriculum/<id>/assessor",
        )

    def _step_plan(self, cid: str) -> str | None:
        data = self._api.post(
            f"/curriculum/{cid}/plan",
            {},
            name="POST /curriculum/<id>/plan",
        )
        weeks = (data or {}).get("weeks") or []
        if weeks:
            return weeks[0].get("id")
        return None

    def _step_lesson(self, cid: str, wid: str) -> str | None:
        data = self._api.post(
            f"/curriculum/{cid}/lessons",
            {"week_id": wid, "module_index": 0},
            name="POST /curriculum/<id>/lessons",
        )
        return (data or {}).get("id")

    def _step_exercises(self, cid: str, wid: str) -> str | None:
        data = self._api.post(
            f"/curriculum/{cid}/exercises",
            {"week_id": wid, "count": 3, "module_index": 0},
            name="POST /curriculum/<id>/exercises",
        )
        exercises = (data or {}).get("exercises") or []
        if exercises:
            return exercises[0].get("id")
        return None

    def _step_submit_stream(self, eid: str) -> None:
        self._api.post_sse(
            f"/curriculum/exercises/{eid}/submit/stream",
            {"submission": {"answer": "Hello"}},
            name="POST /curriculum/exercises/<id>/submit/stream",
        )


# ── read-only user (lighter weight, higher concurrency) ──────────────────────

class ReadOnlyUser(HttpUser):
    """Simulates a user who only reads dashboards and lists — no AI calls.

    Useful for isolating Flask + Supabase throughput without agent overhead.
    Spawn alongside AllTeacherUser with --user-classes to split traffic:

        locust ... --user-classes AllTeacherUser ReadOnlyUser
    """

    wait_time = between(0.5, 2)
    weight = 3  # 3× more read-only users than full-journey users

    def on_start(self):
        slot = next(_uid_cycle)
        worker_index, _ = LOAD_TEST_UIDS[slot]
        self._api = _API(self.client, worker_index)

    @task(5)
    def list_curricula(self):
        self._api.get("/curriculum", name="GET /curriculum")

    @task(3)
    def progress_dashboard(self):
        self._api.get("/curriculum/progress", name="GET /curriculum/progress")

    @task(2)
    def health(self):
        self.client.get("/health", name="/health")
