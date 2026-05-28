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

# Higher load — full-journey + read-only mix (all classes in file used automatically)
locust -f load_tests/locustfile.py --headless \
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
locust ...   # all classes in locustfile.py are used automatically
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

---

## Running against a real local Supabase

Use this mode to load-test the full DB path (FK constraints, RLS, real queries) without
spending money on OpenAI — agents are still stubbed, only the database is real.

### 1 — Install the Supabase CLI

```bash
brew install supabase/tap/supabase   # macOS
# or: npm install -g supabase
```

### 2 — Start a local Supabase instance

Run from the repo root (where `supabase/` lives, or a fresh directory):

```bash
supabase init          # only needed the first time
supabase start         # starts Postgres, Auth, Storage on Docker
```

`supabase status` prints the credentials you need:

```
API URL:          http://localhost:54321
DB URL:           postgresql://postgres:postgres@localhost:54322/postgres
anon key:         <anon-jwt>
service_role key: <service-role-jwt>
```

### 3 — Apply migrations

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f backend/db/migrations/001_initial_schema.sql \
  -f backend/db/migrations/002_curriculum_assessment.sql \
  -f backend/db/migrations/003_time_budget_per_day.sql \
  -f backend/db/migrations/004_planner.sql \
  -f backend/db/migrations/005_exercises.sql \
  -f backend/db/migrations/006_exercise_bank.sql \
  -f backend/db/migrations/007_tracker.sql \
  -f backend/db/migrations/008_lessons.sql \
  -f backend/db/migrations/009_admin_billing_usage.sql \
  -f backend/db/migrations/010_multimodal_exercise_types.sql \
  -f backend/db/migrations/011_add_starter_tier.sql \
  -f backend/db/migrations/012_exercise_bank_native_language.sql \
  -f backend/db/migrations/013_knowledge_cards.sql \
  -f backend/db/migrations/014_video_choice_type.sql \
  -f backend/db/migrations/015_request_logs.sql
```

All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — safe to re-run.

### 4 — Seed load test users

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" \
  -f load_tests/seed_load_test_users.sql
```

This inserts 20 pre-determined users into `auth.users`, `public.users`, and `public.subscriptions`. The UUIDs match the `LOAD_TEST_UIDS` pool in `locustfile.py`.

### 5 — Start Flask (agents stubbed, DB real)

```bash
cd backend
STUB_AGENTS=true \
STUB_DB=false \
LOAD_TEST_SECRET=loadtest \
SUPABASE_URL=http://localhost:54321 \
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status> \
SUPABASE_ANON_KEY=<anon key from supabase status> \
flask --app main run --port 5001
```

### 6 — Run Locust

```bash
# From repo root:
locust -f load_tests/locustfile.py --headless \
    -u 10 -r 2 --run-time 60s \
    --host http://localhost:5001
```

### Expected performance in this mode

- `GET /curriculum` — <20 ms p95 (simple Supabase read)
- `POST /curriculum` — <50 ms p95 (DB write + stub agent)
- `POST /curriculum/<id>/exercises` — <50 ms p95 (stub agent, no OpenAI call)
- Failure rate — 0 %

Real-agent mode (no `STUB_AGENTS=true`) will add 2–10 s per AI call depending on OpenAI latency.
