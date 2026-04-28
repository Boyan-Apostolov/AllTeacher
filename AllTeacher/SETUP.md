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
- `005_exercises.sql` — extends `exercises` with `module_index`, `status` enum (`pending` / `submitted` / `evaluated` / `skipped`), `submission_json`, `feedback_json`, `evaluated_at`, plus indexes on `(curriculum_id, status)` and `(week_id, status)`. Used by the Exercise Writer + Evaluator pipeline.
- `006_exercise_bank.sql` — global `exercise_bank` table for caching/dedup across users (keyed by domain/level/target_language/week_number/weak_areas). Adds `exercises.bank_id` and `curricula.recent_weak_areas`.
- `007_tracker.sql` — Tracker/Adapter columns on `curricula` (`recent_strengths`, `last_active_at`, replan bookkeeping).
- `008_lessons.sql` — `lessons` table for the Explainer agent (one row per planner module: `concept_title`, `content_json`, `status` ∈ `pending`/`ready`/`seen`). Powers the lesson→exercises flow.

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

This installs everything in `package.json`, including `expo-linear-gradient` (used by the redesigned UI for hero / button / flashcard gradients). The `Gradient` component falls back to a solid color if it isn't installed yet, so the app still boots without it — but `npm install` is the supported path.

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

All agent calls go through `backend/app/agents/orchestrator/` (composed from per-phase mixins: `_assessment.py`, `_lessons.py`, `_exercises.py`, `_tracker.py`). Routes are thin — they translate HTTP into orchestrator intents (`start_curriculum`, `submit_assessor_answer`, `generate_plan`, `generate_lesson`, `mark_lesson_seen`, `generate_exercises`, `submit_exercise`, `dashboard_summary`, `run_adapter`, …) and translate orchestrator results / errors back into JSON. Subagents (`assessor.py`, `planner.py`, `explainer.py`, `exercise_writer.py`, `evaluator.py`, `tracker.py`, `adapter.py`) stay pure: structured input → structured output, no DB or HTTP.

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
- On any week card in the plan view, tap **Start session →**. The session now teaches before drilling: for each planner module the Explainer writes a short lesson (concept_title, intro, key points, worked example, pitfalls, next-up) adapted to your level (longer for beginners, terse refresher for advanced), then the Exercise Writer generates a small batch of exercises (mix of multiple-choice / flashcards / short-answer / writing prompts) scoped to that same module so the practice drills the concept you just read. Submit each one — the Evaluator scores it and gives feedback in your native language. The screen advances concept → exercises → next concept → … and ends with the average score.

### Explainer agent — teach before drilling (2026-04-27)

- **New agent** `backend/app/agents/explainer.py` — pure agent, same shape as the existing subagents. Takes one planner module + the user profile (level, native_language, target_language, learning_style, recent_weak_areas) and emits `{concept_title, intro, key_points, example, pitfalls, next_up}`. Length adapts to level via the system prompt: longer scaffolded lessons for beginners, terse refreshers for advanced.
- **New mixin** `backend/app/agents/orchestrator/_lessons.py` — `generate_lesson`, `mark_lesson_seen`, `list_lessons`. Cached per `(curriculum, week, module_index)` so repeat opens don't burn tokens.
- **New routes** `POST /curriculum/<id>/lessons`, `GET /curriculum/<id>/lessons`, `POST /curriculum/lessons/<lid>/seen`.
- **New table** `public.lessons` (see `008_lessons.sql`) — `concept_title`, `content_json`, `status` ∈ `pending`/`ready`/`seen`. Cascades from the parent curriculum and week.
- **`generate_exercises` extended** with optional `module_index` so each batch is scoped to one concept (the bank is bypassed in that path so per-module content doesn't leak into the cross-user week-keyed cache).
- **iOS** `ios/components/session/LessonView.tsx` renders the lesson card; `ios/app/curriculum/session.tsx` is now a phase machine — `lesson(module_i) → exercises(module_i) → lesson(i+1) → … → finished`. The "Start exercises →" CTA marks the lesson seen and triggers a per-module exercise generation.
- **StrictMode-safe fetches** in `session.tsx`: the lesson and exercise generation effects no longer use a per-effect `cancelled` cleanup flag. In dev StrictMode the cleanup ran during the unmount/remount dance, throwing away the resolved response while the `generationStarted` ref blocked the second mount from re-fetching — which left the screen stuck on **Preparing your lesson…** until the user backed out and re-entered. Responses are now applied based on whether the user is still viewing the requested module (compared via `currentModuleRef`), and on error the dedup key is freed so the next render retries.

### UI redesign + prompt trim (2026-04-26)

- **Design tokens** live in `ios/lib/theme.ts` — colors, per-exercise-type accents (`typeAccent`), radii, spacing, type, shadow. Every screen pulls from this one source so the look stays coherent.
- **Gradient component** `ios/components/Gradient.tsx` wraps `expo-linear-gradient` and falls back to a solid View if the package isn't installed yet.
- **Screens redesigned**: Home, login, signup, new curriculum, curriculum detail (assessor / summary / plan), exercise session. Hero gradients + soft cards + pill CTAs throughout.
- **Flashcards** now flip with an animated 3D rotation using React Native's `Animated` API — gradient front face (turquoise → cyan), light back face, with hard / medium / easy buttons that gradient when active.
- **Agent prompts trimmed** (`backend/app/agents/{assessor,planner,exercise_writer,evaluator}.py`) — system prompts are now ~10–17 lines each (down ~75–85%). The structured-output JSON schemas enforce shape, so prompts only carry the rules the schema can't enforce: language behaviour, exercise/scoring vocabulary, quality bar, and dedup constraints. Per-call `reminder` system messages dropped.

Next, in roughly MVP order:

1. ~~Supabase Auth — email/password signup/login in `ios/app/(auth)/` that writes to `public.users`.~~ ✅
2. ~~Assessor agent — adaptive quiz, structured summary in native language.~~ ✅
3. ~~Planner agent — turn the Assessor summary into a week-by-week plan in `curriculum_weeks`, dispatched by the master Orchestrator.~~ ✅
4. ~~Exercise Writer + Evaluator — per-week session: generate exercises, render typed UI, submit, get scored feedback.~~ ✅
5. Tracker + Adapter — progress dashboard, weak-area accumulation, re-plan upcoming weeks.
6. Streaming responses end-to-end (SSE) for the Evaluator's longer feedback.
7. RevenueCat → tier enforcement.
8. TestFlight submission.
