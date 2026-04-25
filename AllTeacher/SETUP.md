# AllTeacher — First-Time Setup

Goal: get the Flask backend running on your Mac, the iOS app in the simulator talking to it, and both Supabase + OpenAI keys wired. One-time work.

Repo layout:

```
AllTeacher/
  backend/       Flask + OpenAI orchestrator
  ios/           Expo + React Native app
  SETUP.md       (you are here)
```

---

## 1. Install prerequisites on your Mac

You already have Node + npm. You still need:

### Python 3.12

Easiest with [Homebrew](https://brew.sh):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install python@3.12
```

Verify: `python3 --version` should print 3.12.x.

### Xcode + iOS Simulator

Install **Xcode** from the Mac App Store (≈12 GB, grab coffee). Then once:

```bash
sudo xcode-select --install          # command line tools
sudo xcodebuild -license accept      # accept the license
xcrun simctl list devices | head     # sanity check
```

Open Xcode once so it downloads the iOS platform. Then Xcode → Settings → Platforms → iOS (click the download arrow).

### (Optional) Watchman

Speeds up Metro bundler file watching:

```bash
brew install watchman
```

---

## 2. Create a Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign up with GitHub.
2. Click **New project**:
   - Name: `allteacher`
   - Database password: generate a strong one (save it in your password manager).
   - Region: pick closest to you (Europe if you're in the EU).
   - Free plan is fine for now.
3. Wait ~2 minutes for the project to provision.
4. Once it's up, open **Project Settings → API**. You'll see:
   - **Project URL** → `SUPABASE_URL`
   - **`anon` `public` key** → `SUPABASE_ANON_KEY` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - **`service_role` `secret` key** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ keep secret, backend only
5. Open **Project Settings → API → JWT Settings** → copy **JWT Secret** → `SUPABASE_JWT_SECRET`.

### Create the tables

In Supabase, open **SQL Editor → New query**, paste this, click **Run**:

```sql
-- users profile (auth.users is managed by Supabase Auth)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  native_language text default 'en',
  target_language text,
  created_at timestamptz default now()
);

create table public.subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro','power')),
  revenuecat_id text,
  token_usage_month int default 0,
  updated_at timestamptz default now()
);

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  domain text,
  status text not null default 'active' check (status in ('active','completed','paused')),
  created_at timestamptz default now()
);

create table public.curriculum_weeks (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  week_number int not null,
  plan_json jsonb not null,
  status text not null default 'pending'
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  week_id uuid references public.curriculum_weeks(id) on delete set null,
  type text not null,
  content_json jsonb not null,
  seen boolean default false,
  score numeric,
  created_at timestamptz default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete cascade,
  conversation_history_json jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table public.mastery_scores (
  user_id uuid not null references public.users(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  topic text not null,
  score numeric not null,
  updated_at timestamptz default now(),
  primary key (user_id, curriculum_id, topic)
);

-- RLS: users read/write their own rows. Service role bypasses these.
alter table public.users            enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.curricula        enable row level security;
alter table public.curriculum_weeks enable row level security;
alter table public.exercises        enable row level security;
alter table public.sessions         enable row level security;
alter table public.mastery_scores   enable row level security;

create policy "self" on public.users            for all using (auth.uid() = id);
create policy "self" on public.subscriptions    for all using (auth.uid() = user_id);
create policy "self" on public.curricula        for all using (auth.uid() = user_id);
create policy "self" on public.sessions         for all using (auth.uid() = user_id);
create policy "self" on public.mastery_scores   for all using (auth.uid() = user_id);
create policy "via_curriculum" on public.curriculum_weeks for all
  using (exists (select 1 from public.curricula c where c.id = curriculum_id and c.user_id = auth.uid()));
create policy "via_curriculum" on public.exercises for all
  using (exists (select 1 from public.curricula c where c.id = curriculum_id and c.user_id = auth.uid()));

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Migrations

After the initial schema above, run every file in `backend/db/migrations/` in order. They're idempotent (`add column if not exists`, etc.) and safe to re-run.

Currently:

- `002_curriculum_assessment.sql` — adds Assessor output columns (`goal`, `native_language`, `target_language`, `level`, `learning_style`, `time_budget_mins_per_week`, `assessment_json`, `assessor_status`) to `curricula`.
- `003_time_budget_per_day.sql` — renames `time_budget_mins_per_week` → `time_budget_mins_per_day` (the Assessor now asks per-day, not per-week).
- `004_planner.sql` — adds `plan_json` (top-level overview: title, summary, phases, total_weeks) and `planner_status` to `curricula`. Per-week detail goes into `curriculum_weeks.plan_json`.

For each file: open **SQL Editor → New query**, paste the contents, click **Run**.

### JWT signing keys (recommended)

The legacy shared **JWT Secret** (HS256) still works, but Supabase now prefers **asymmetric JWT signing keys** (ES256/RS256). In **Project Settings → API → JWT Settings**, promote an asymmetric key to "In use". The backend auto-detects the algorithm and verifies via the project's JWKS endpoint — no extra config needed as long as `SUPABASE_URL` is set.

---

## 3. Get an OpenAI API key

1. Go to <https://platform.openai.com>.
2. Sign up / log in.
3. **Settings → Billing** → add a payment method and buy at least $5 of credit. (API usage is separate from ChatGPT Plus — you pay per-request here.)
4. **Dashboard → API keys → Create new secret key**.
5. Copy the key (starts with `sk-…`) → `OPENAI_API_KEY`. You won't see it again.

The default model is `gpt-4o`. Swap via `OPENAI_MODEL=gpt-4o-mini` (cheaper) or any other model name in `.env`.

---

## 4. Wire up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `backend/.env` and fill in what you got above:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_JWT_SECRET=...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Run it:

```bash
python app.py
```

Separate terminal:

```bash
curl http://localhost:8000/health
```

Should print:

```json
{
  "status": "ok",
  "service": "allteacher-backend",
  "env": "development",
  "configured": { "supabase": true, "openai": true, "revenuecat": false }
}
```

If `supabase` or `openai` show `false`, your `.env` isn't being read — double-check you're in `backend/` when running.

---

## 5. Wire up the iOS app

```bash
cd ../ios
npm install
cp .env.example .env
```

`.env` for the simulator is fine as-is (`EXPO_PUBLIC_API_URL=http://localhost:8000`). Also paste in your Supabase URL and anon key from step 2.

Boot it:

```bash
npx expo start --ios
```

First run will take a few minutes: it downloads Expo Go into the simulator, bundles the app, opens it. You should see the AllTeacher screen with a **green "ok" card** showing which integrations are configured.

Red card instead? Check that the backend terminal is still running. If you're on a physical phone instead of the simulator, use your Mac's LAN IP (see `ios/README.md`).

---

## 6. You're set up

End-to-end loop is alive:

```
iOS Simulator (Expo) ──/health──▶ Flask (:8000) ──▶ Config check
                        ◀──── { status: "ok", configured: {...} }
```

### Architecture: master Orchestrator

All agent calls go through `backend/app/agents/orchestrator.py`. Routes are thin — they translate HTTP into orchestrator intents (`start_curriculum`, `submit_assessor_answer`, `generate_plan`, …) and translate orchestrator results / errors back into JSON. Subagents (`assessor.py`, `planner.py`, future `evaluator.py`, `tracker.py`, `adapter.py`) stay pure: structured input → structured output, no DB or HTTP.

```
iOS  ──HTTP──▶  Flask route  ──intent──▶  Orchestrator  ──▶  Subagent (Assessor / Planner / …)
                                            │  ▲
                                            ▼  │
                                       Supabase Postgres
```

Add a new subagent by dropping a new module under `app/agents/` and wiring it into the orchestrator — never call subagents from routes directly.

### What to try

- Sign up / log in from the iOS app — the **Signed in as …** line + the green **/auth/me** card prove the Supabase JWT round-trips to Flask.
- Tap **Start new curriculum**, type any goal in any language. The Assessor asks 8–10 MCQs in your native language and ends with a structured summary (domain / level / learning style / time per day / target language).
- After the assessment, tap **Generate my plan**. The Planner returns a week-by-week curriculum (title, summary, phases, weeks with modules / objective / milestone / daily minutes), persisted to `curricula.plan_json` + `curriculum_weeks`.
- Back on Home, the curriculum row shows **Plan ready** and reopens straight into the plan view.

Next, in roughly MVP order:

1. ~~Supabase Auth — email/password signup/login in `ios/app/(auth)/` that writes to `public.users`.~~ ✅
2. ~~Assessor agent — adaptive quiz, structured summary in native language.~~ ✅
3. ~~Planner agent — turn the Assessor summary into a week-by-week plan in `curriculum_weeks`, dispatched by the master Orchestrator.~~ ✅
4. Exercise Writer + Evaluator — sessions screen with streaming responses via SSE.
5. Tracker + Adapter — progress dashboard.
6. RevenueCat → tier enforcement.
7. TestFlight submission.
