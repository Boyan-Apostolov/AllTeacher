# AllTeacher Load Tests

Locust-based load tests for the Flask backend. Two env flags keep costs at zero:

- `STUB_AGENTS=true` — agents return canned JSON instead of calling OpenAI
- `LOAD_TEST_SECRET=<secret>` — auth middleware accepts that Bearer token without hitting Supabase

---

## Setup

```bash
cd backend
pip install locust --break-system-packages   # or: pip install locust inside .venv
```

---

## Start Flask in stub mode (fully offline — no Supabase needed)

```bash
cd backend
STUB_AGENTS=true \
STUB_DB=true \
LOAD_TEST_SECRET=loadtest \
flask --app main run --port 5001
```

All three flags together: no OpenAI calls, no Supabase calls, auth bypass active.

---

## Run — headless (CI / quick benchmarks)

```bash
# 10 concurrent users, spawn 2/s, run 60 s
locust -f load_tests/locustfile.py --headless \
    -u 10 -r 2 --run-time 60s \
    --host http://localhost:5000

# Higher load — 50 full-journey + read-only mix
locust -f load_tests/locustfile.py --headless \
    --user-classes AllTeacherUser ReadOnlyUser \
    -u 50 -r 5 --run-time 120s \
    --host http://localhost:5000
```

Key flags:
| Flag | Meaning |
|---|---|
| `-u N` | Peak concurrent users |
| `-r N` | Users spawned per second (ramp rate) |
| `--run-time Xs` | Stop after X seconds |
| `--csv=results/run1` | Write results CSV to `results/` |

---

## Run — web UI (interactive)

```bash
locust -f load_tests/locustfile.py --host http://localhost:5000
# Open http://localhost:8089
```

Set user count, ramp rate, then hit Start. Charts update live.

---

## Override defaults

```bash
LOAD_TEST_SECRET=mysecret \
LOAD_TEST_TIER=power \
locust -f load_tests/locustfile.py --headless -u 20 -r 4 --run-time 60s \
    --host http://localhost:5000
```

`LOAD_TEST_TIER` sets the `X-Load-Test-Tier` header, controlling which agent features are unlocked (free / starter / pro / power).

---

## User classes

| Class | Behaviour | Default weight |
|---|---|---|
| `AllTeacherUser` | Full journey: create → assess → plan → lesson → exercises → submit | 1 |
| `ReadOnlyUser` | List curricula + progress dashboard only — no AI calls | 3 |

Mix them explicitly:

```bash
locust ... --user-classes AllTeacherUser ReadOnlyUser
```

---

## Metrics to watch

- **p95 response time** for `POST /curriculum` and `POST /curriculum/<id>/exercises` — these hit the stub agent; in stub mode should be <100 ms, real mode will be 2–10 s.
- **Failures %** — should stay at 0 %.
- **RPS** — target ≥50 RPS on `GET /curriculum` with `ReadOnlyUser` under 20 concurrent users.

---

## How the stubs work

| Flag | Effect |
|---|---|
| `STUB_AGENTS=true` | `get_openai_client()` returns a fake client with canned JSON responses per agent |
| `STUB_DB=true` | `service_client()` / `anon_client()` return an in-memory stub with a fluent query builder |
| `LOAD_TEST_SECRET=x` | Auth middleware accepts `Bearer x` without hitting Supabase JWKS |
