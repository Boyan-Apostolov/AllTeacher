"""AllTeacher load tests — realistic full user journey.

Prerequisites
-------------
1. Start Flask in stub mode (see load_tests/README.md).
2. Install locust: pip install locust

Run (headless, 10 users, 60 s):
    locust -f load_tests/locustfile.py --headless \
        -u 10 -r 2 --run-time 60s \
        --host http://localhost:5000

Run (web UI at http://localhost:8089):
    locust -f load_tests/locustfile.py --host http://localhost:5000

Environment variables (override defaults):
    LOAD_TEST_SECRET   Bearer token accepted by the auth bypass (default: loadtest)
    LOAD_TEST_TIER     Tier header sent with every request (default: pro)
"""
from __future__ import annotations

import json
import os
import random
import string
import time

from locust import HttpUser, between, task

# ── config ────────────────────────────────────────────────────────────────────

_SECRET = os.getenv("LOAD_TEST_SECRET", "loadtest")
_TIER   = os.getenv("LOAD_TEST_TIER", "pro")

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

def _rand_str(n: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase, k=n))


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
        """Called once per simulated user. Set up a unique worker identity."""
        self._worker_id = _rand_str()
        self._api = _API(self.client, self._worker_id)
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
        self._worker_id = _rand_str()
        self._api = _API(self.client, self._worker_id)

    @task(5)
    def list_curricula(self):
        self._api.get("/curriculum", name="GET /curriculum")

    @task(3)
    def progress_dashboard(self):
        self._api.get("/curriculum/progress", name="GET /curriculum/progress")

    @task(2)
    def health(self):
        self.client.get("/health", name="/health")
