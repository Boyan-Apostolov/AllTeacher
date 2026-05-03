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
- `009_admin_billing_usage.sql` — `subscriptions` (per-user tier + `monthly_price_cents` for MRR math) and `token_usage_log` (one row per OpenAI call: `agent`, `model`, `prompt_tokens`, `completion_tokens`, `cost_cents`, `created_at`). Powers the admin dashboard.

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

### Admin dashboard + per-call cost ledger (2026-04-28)

User asked for an admin view restricted to `boian4934@gmail.com` with totals on users, subscriptions, used API cost and profit-from-subs. Built as a hidden tab inside the iOS app on top of a new always-on token-cost ledger (no historical backfill — we start counting from this deploy).

- **Migration** `009_admin_billing_usage.sql` — adds two tables.
  - `subscriptions` (one row per user — `user_id` PK referencing `auth.users`, `tier` ∈ free/pro/power, `monthly_price_cents`, `currency` default EUR, `status`, `started_at`, `current_period_end`, `revenuecat_id`). Seeded manually for now; the RevenueCat webhook is still stubbed and will write here once it's wired up.
  - `token_usage_log` (id, `user_id`, `curriculum_id`, `agent`, `model`, `prompt_tokens`, `completion_tokens`, `cost_cents` numeric(12,4), `created_at`). One row per OpenAI call. Indexed on `created_at`, `(user_id, created_at)`, `(agent, created_at)` so the dashboard time-series queries stay cheap.

- **Usage meter** `backend/app/services/usage_meter.py` — request-scoped via a Python `ContextVar`. `begin(user_id, curriculum_id)` opens the scope; agents call `record(model=..., usage=...)` after each `chat.completions.create`; `flush()` persists all events. We chose this over plumbing `user_id` through every agent's signature because subagents are pure (`{input dict} → {output dict}`) and we want to keep them that way. The meter is best-effort — Supabase insert failures are logged and swallowed; billing telemetry never bubbles into the user-facing response.

- **Pricing table** in `config.py` (`OPENAI_PRICING_USD_PER_1K`) — keyed by model name with a `default` fallback. Costs are stored at write time, so a future price change doesn't retroactively rewrite history. Cost is USD-cents; subscription revenue is EUR-cents — the dashboard treats them as comparable for a rough margin lens (good enough for a one-operator business-health view).

- **Wiring** — `record(...)` called from all six agents (assessor, planner, exercise_writer, evaluator, adapter, explainer) right after the OpenAI completion. `begin(user_id=g.user_id, curriculum_id=request.view_args.get("curriculum_id"))` runs inside `require_auth` so every authenticated route automatically opens a scope; `app.teardown_request` calls `flush()` so the rows persist whether the route returned cleanly or raised.

- **Admin gate** — new decorator `admin_only` in `backend/app/middleware/auth.py`. Checks `g.user_email` against `Config.ADMIN_EMAIL` (default `boian4934@gmail.com`, configurable via env). Returns **404 not_found** instead of 403 so the surface looks indistinguishable from "no such route" for non-admins. Stack order: `@require_auth` first, then `@admin_only`.

- **Admin routes** `backend/app/routes/admin.py` (registered as the `admin` blueprint under `/admin`):
  - `GET /admin/overview` — single roll-up payload (totals, signups today/7d/30d, DAU/WAU/MAU, sub counts by tier, MRR, today + 30-day cost, 30-day margin).
  - `GET /admin/users?days=N` — recent users + each user's window cost (capped at top-200 by spend so the iOS list stays small).
  - `GET /admin/usage?days=N` — daily cost series + per-agent + per-model breakdowns.
  - `GET /admin/engagement?days=N` — daily distinct active users + total sessions completed.
  - `GET /admin/profit?months=N` — month-by-month revenue (MRR booked) − cost rollup.

- **iOS — hidden tab** — `useAdmin()` hook in `lib/auth.tsx` returns true only when the logged-in email matches `ADMIN_EMAIL`. The home screen renders an extra "🛠 Admin" pill in the hero CTA row when true; non-admins never see it. Wraps `app/admin.tsx` (the dashboard screen) which loads all five endpoints in parallel, supports pull-to-refresh, and renders KPI tiles, mini bar-charts, and per-agent/per-model spend breakdowns.

- **Configuration** — `ADMIN_EMAIL` (defaults to `boian4934@gmail.com`) and `OPENAI_PRICING_USD_PER_1K` live in `config.py`. The pricing dict has stub entries for the gpt-5.4-* family currently set as defaults — update once real pricing is published.

### Evaluator language consistency + canonical tag reuse (2026-04-28 patch)

User reported: the post-submit screen shows the main `feedback` paragraph in English while `gap`, `weak_areas`, and `next_focus` come back in Hindi (the user's native language). Worse, the FinishedView "To revisit" recap mixes scripts ("समय प्रबंधन" + "gestión del tiempo") and shows near-duplicates ("समय प्रबंधन" / "समय प्रबंधन रणनीतियाँ") for the same theme.

- **Evaluator prompt strengthened** (`backend/app/agents/evaluator.py`) — top-of-prompt LANGUAGE RULE block spells out that EVERY user-facing field (`feedback`, `gap`, every entry in `weak_areas` / `strengths`, `next_focus`) must be in the user's native_language script, including when the exercise content itself is in target_language. Adds a re-read-before-returning check to catch the in-response language drift the model was producing. Also nudges weak_areas to 1–3 words. Temperature dropped from 0.3 → 0.1 for stricter adherence.
- **Canonical tag reuse** — orchestrator now passes `existing_weak_areas` + `existing_strengths` (curriculum's recent_weak_areas / recent_strengths) into the Evaluator payload. New CANONICAL TAGS prompt block tells the model to reuse those strings verbatim when the same theme applies, instead of coining variants.
- **Client-side safety net** (`ios/components/session/FinishedView.tsx`) — `topTags()` rewritten as a bucketing pass: trim + casefold every tag, group tags whose normalized form is a prefix/substring of another (so "time management" and "time management strategies" merge), and render the most-frequent surface form within each bucket. The recap shows one row per theme even if the model still leaks the occasional translated variant.

### Multimodal — listening exercises + visual lessons (2026-04-29)

User wanted the curriculum to grow past plain text. Two new surfaces in this slice — audio listening exercises (TTS-generated, played via `expo-av`) and optional Mermaid diagrams in lessons (rendered in a WebView). Built the smaller, scope-tight version on purpose: pronunciation evaluation and AI-generated lesson images deferred to follow-up iterations.

Schema:
- **Migration 010** (`db/migrations/010_multimodal_exercise_types.sql`) — extends the `exercises.type` and `exercise_bank.type` CHECK constraints to allow `listen_choice` and `image_match` (the latter is a placeholder for the next iteration so we don't burn another migration when we ship it). Constraint discovery uses a `pg_constraint` DO block since the original was created via the Supabase dashboard with an unknown name.

Backend:
- **TTS service** (`backend/app/services/media.py`) — `tts_to_url(text, voice?, model?)` returns a public Supabase Storage URL. Cache key = `sha256(text+voice+model)`, stored as `{key}.mp3`. Identical content reuses the cached file (no re-spend). Idempotent `_ensure_bucket` handles bucket auto-create. Records cost via `usage_meter` with `agent='tts'`; `usage_meter._cost_cents` patched to honour a `cost_cents_override` field on the synthetic usage object so per-character TTS pricing lands accurately. New config: `OPENAI_TTS_MODEL` (`tts-1`), `OPENAI_TTS_VOICE` (`alloy`), `OPENAI_TTS_USD_PER_1K_CHARS`, `STORAGE_BUCKET_AUDIO` (`exercise-audio`), `STORAGE_BUCKET_LESSON_MEDIA` (`lesson-media`, reserved for the next iteration).
- **Exercise Writer** (`agents/exercise_writer.py`) — `EXERCISE_TYPE_ENUM` adds `listen_choice`. RESPONSE_SCHEMA gains `audio_text`, `language`, `prompt_native` (all required-but-empty for non-audio types per OpenAI's strict JSON schema rule). System prompt: type only allowed when `listening_enabled=true` (orchestrator gates by tier), `target_language` is set, and the domain is language-flavoured — never picked for code/math/fitness. `_strip_empty()` whitelists the new fields. New `WriterInput.listening_enabled: bool` so the writer doesn't waste output tokens on items that would be discarded.
- **Orchestrator** (`orchestrator/_exercises.py`) — `generate_exercises` takes a new `tier` kwarg (route passes `g.user_tier`). New `_materialise_audio()` helper runs after the bank+writer steps but before the DB insert: free users have all `listen_choice` rows dropped silently; Pro+ rows missing `audio_url` get hydrated via `media.tts_to_url`; rows that fail TTS are dropped (silent listening cards are worse than missing). The writer payload also gets `listening_enabled = tier in {'pro','power'}`.
- **Explainer** (`agents/explainer.py`) — RESPONSE_SCHEMA adds `diagram_mermaid: string` (required, empty = no diagram). System prompt's new DIAGRAMS block teaches when a diagram earns its keep (process flows, hierarchies, sequences, comparisons), what to avoid (vocab/single-fact concepts, anything ≤ 8 nodes can clarify), and constrains output to mermaid's four core renderers (`flowchart`, `classDiagram`, `sequenceDiagram`, `mindmap`).

iOS:
- **Deps** (`ios/package.json`) — `expo-av@~14.0.7` and `react-native-webview@13.8.6` declared (Expo SDK 51 compatible). User runs `npm install` later.
- **Types** (`ios/lib/api.ts`) — `ExerciseType` adds `'listen_choice'` and `'image_match'` (latter reserved). `ExerciseContent` adds `audio_url`, `audio_text`, `language`, `prompt_native`, `image_url`. `LessonContent` adds `diagram_mermaid?`.
- **ListenChoice** (`components/session/ListenChoice.tsx` + `.styles.ts`) — lazy `require('expo-av')` so the file typechecks before install. Big play/replay button on a card; auto-plays once on mount; options stay locked until first playback finishes (so the user can't peek at the answer while audio plays). On TTS failure, falls back to showing `audio_text` inline so the exercise still works as a regular MCQ. Submission shape is `{ choice_index }` — same as `multiple_choice`, so the Evaluator path is unchanged.
- **MermaidDiagram** (`components/lesson/MermaidDiagram.tsx` + `.styles.ts`) — lazy WebView require (default OR named export to handle multiple package versions). Inline HTML pins `mermaid@10.9.1` from cdnjs, themes the diagram against the app palette (`brand`/`brandDeep`), posts measured SVG height back over `postMessage` so the parent `<View>` resizes (clamped 80–600px). LessonView renders it in a new "Visual" section between Example and Watch out — only when `content_json.diagram_mermaid` is non-empty.

Plus a Writer LANGUAGE-rule fix unrelated to multimodal: user reported the Writer was writing prompts and explanations in `target_language` (e.g. Dutch) when the user is learning Dutch. The previous "may use target_language so the user actually practices it" carve-out was too loose. Tightened the rule: prompts, instructions, rubric bullets, and any explanation text are ALWAYS native_language. Only the *artifact being tested* (a Dutch word, a sentence to translate) appears in target_language. `audio_text` for `listen_choice` is the explicit exception (it's literally the spoken artifact).

Out of scope (deliberate — picked up later):
- Speech-to-text / pronunciation evaluation (needs Whisper + a new Evaluator branch).
- AI-generated lesson images (DALL-E / `gpt-image-1`) — the schema reserved space (`image_url` on `ExerciseContent`, `STORAGE_BUCKET_LESSON_MEDIA` in config) but no generation pipeline yet.
- `image_match` exercise type — reserved in the type union and the migration, no Writer support yet.

User actions remaining: `cd ios && npm install`; apply `010_multimodal_exercise_types.sql` in Supabase SQL editor; optionally pre-create the `exercise-audio` bucket as Public if the service-role key can't create buckets (the helper tries idempotently on first use).

### Sign in with Apple (2026-05-03)

Apple Sign In added to the login and signup screens. Users can authenticate with a single tap using their Apple ID — no email/password required. Supabase handles the token exchange server-side.

**How it works**: the iOS sheet is shown via `expo-apple-authentication`. Apple returns an `identityToken` (a short-lived JWT signed by Apple's keys). The app calls `supabase.auth.signInWithIdToken({ provider: 'apple', token })` — Supabase validates the token against Apple's JWKS endpoint and either creates a new `auth.users` row or signs in the existing one. The `handle_new_user` trigger fires on first sign-in and seeds `public.users` + `public.subscriptions` as normal.

**Code changes**:
- `ios/package.json` — added `expo-apple-authentication@~6.4.0`
- `ios/app.json` — `ios.usesAppleSignIn: true`, `expo-apple-authentication` added to `plugins`
- `ios/lib/auth.tsx` — `signInWithApple()` added to `AuthContextValue` and `AuthProvider`. Lazy `import()` of the module so Android builds are unaffected. `ERR_CANCELED` is swallowed (user dismissed the sheet).
- `ios/app/(auth)/login.tsx` — Apple "Sign in with Apple" button (black style) after the email/password CTA, separated by an "— or —" divider. Rendered only when `AppleAuthentication.isAvailableAsync()` returns true (real devices and Simulator with a signed-in Apple ID).
- `ios/app/(auth)/signup.tsx` — Apple "Continue with Apple" button placed *above* the email form (per Apple's HIG: the native option should be the most prominent on signup screens).

**User action remaining (Supabase + Apple Developer Console — manual steps)**:

See the "Enable Sign in with Apple" section below (§ 2a).

---

## 2a. Enable Sign in with Apple

These are one-time manual steps. Do them before running the app on a real device.

### Apple Developer Console

1. Go to <https://developer.apple.com> → **Certificates, Identifiers & Profiles**.
2. **Register an App ID** (if not already done):
   - Identifiers → `+` → App IDs → App
   - Bundle ID: `com.allteacher.app`
   - Scroll to **Capabilities** → tick **Sign In with Apple** → Continue → Register.
3. **Create a Services ID** (used by Supabase as the OAuth client):
   - Identifiers → `+` → Services IDs
   - Description: `AllTeacher`
   - Identifier: `com.allteacher.app.siwa` (or any reverse-DNS string)
   - Continue → Register.
   - Click the new Services ID → tick **Sign In with Apple** → Configure:
     - Primary App ID: `com.allteacher.app`
     - Domains and Subdomains: `<your-project-ref>.supabase.co`
     - Return URLs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Save → Continue → Register.
4. **Create a Key**:
   - Keys → `+`
   - Name: `AllTeacher SIWA`
   - Tick **Sign In with Apple** → Configure → Primary App ID: `com.allteacher.app`
   - Continue → Register → **Download** the `.p8` file (you can only download it once — save it safely).
   - Note the **Key ID** shown on the confirmation page.
5. Note your **Team ID** — it appears top-right next to your name on the developer portal (10-character string, e.g. `AB12CD34EF`).

### Supabase Dashboard

1. Open your Supabase project → **Authentication → Providers → Apple**.
2. Toggle **Enable Apple provider** on.
3. Fill in:
   - **Service ID (for OAuth)**: the Services ID from step 3 above (e.g. `com.allteacher.app.siwa`)
   - **Apple Team ID**: your 10-character Team ID from step 5
   - **Key ID**: the Key ID from step 4
   - **Private Key**: open the `.p8` file in a text editor and paste the entire contents (including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines)
4. **Save**.
5. Copy the **Callback URL** shown by Supabase (format: `https://<ref>.supabase.co/auth/v1/callback`) — confirm it matches what you entered in the Apple Developer Services ID.

### Local dev (Simulator)

`expo-apple-authentication` works in the iOS Simulator when the Simulator has an Apple ID signed in:
- Simulator → **Settings → Sign in to your iPhone** → use your Apple ID.

The Apple button is hidden automatically on simulators without a signed-in Apple ID and on all Android/web builds (guarded by `isAvailableAsync()`).

### Install the package

```bash
cd ios
npm install
```

Then re-run:

```bash
npx expo run:ios
```

(A bare `npx expo start --ios` won't pick up the new native module — you need a full native build after adding `expo-apple-authentication`.)

---

### Tier enforcement — manual grants, no payments yet (2026-04-29)

User wanted the three-tier hierarchy (free / pro / power) wired up end-to-end without dealing with Apple / RevenueCat. Operator manually promotes users from the admin dashboard for now; RevenueCat IAP becomes step 7b later.

Backend:
- **Tier loading** (`backend/app/middleware/auth.py`) — after JWT verification, `_load_user_tier()` reads the user's `subscriptions` row and writes the effective tier to `g.user_tier` (default `'free'` for missing row, expired `current_period_end`, non-active status, or any DB hiccup — auth must not 500 because the subscriptions table sneezed). Cached on `g` so the orchestrator + the existing `@require_tier` decorator share one query.
- **Curriculum cap** (`backend/config.py` + `orchestrator/_assessment.py`) — added `CURRICULUM_CAPS = {free: 1, pro: 3, power: None}` and `ADAPTER_TIER_MIN = 'pro'`. `start_curriculum` counts the user's non-archived curricula and raises `OrchestratorError(status=402, code='tier_curriculum_cap')` when the cap is hit. Route passes `g.user_tier`.
- **Adapter gating** (`orchestrator/_tracker.py`) — `_adapter_tier_ok()` helper centralises the rank check. `_run_adapter_if_eligible` now returns `None` for free users so the auto-path call in `submit_exercise` silently skips (free user still gets scoring + tracker rollups). The explicit `run_adapter` route raises `tier_adapter_required` (402) so the iOS layer can show an upgrade CTA. `tier` threaded through `submit_exercise`, `submit_exercise_stream`, `_persist_evaluator_result`, `run_adapter`; the routes pass `g.user_tier`.
- **Manual grant routes** (`backend/app/routes/admin.py`) — `POST /admin/subscriptions/grant {user_id, tier, days?=30}` upserts the subscriptions row keyed on `user_id`, sets `current_period_end = now + days`, `status='active'`, `started_at=now()` so the admin sees "granted on …", `monthly_price_cents` from `Config.TIER_PRICES_EUR_CENTS`. `POST /admin/subscriptions/revoke {user_id}` snaps the row to free + cancelled, period_end=now. Both behind `@require_auth + @admin_only`. Granting `tier='free'` rejects with a friendlier "use revoke" error.
- **Self-readback** (`backend/app/routes/auth.py`) — `GET /auth/me/subscription` returns `{tier, status, current_period_end, started_at, monthly_price_cents, currency, effective_tier}`. Synthesises a free-tier response when no row exists / Supabase is down so the iOS layer never has to branch on 404. Also folds `tier` into the existing `GET /auth/me` response.

iOS:
- **API surface** (`ios/lib/api.ts`) — added `Subscription`, `Tier`, `SubscriptionStatus`, `GrantTierBody`, `GrantTierResponse` types and `api.mySubscription`, `api.adminGrantTier`, `api.adminRevokeTier` methods. New exported `ApiError` class so call sites can branch on `e.body.error` / `e.status` instead of substring-matching the formatted message string. Existing handlers that key off `(e as Error).message` keep working — the message is still the same `"402 PAYMENT REQUIRED: ..."` shape.
- **Tier badge** (`ios/app/index.tsx`) — small `<TierBadge>` pill rendered in the home-screen hero. Refetches on focus so a freshly-granted Pro lands without a sign-out cycle. Shows tier label (Free/Pro/Power) and an "until Aug 28" expiry hint for paid plans. No settings tab existed yet, so the home screen is where it lives.
- **402 handling** (`ios/app/curriculum/new.tsx`) — `createCurriculum` rejections with `e.body.error === 'tier_curriculum_cap'` surface as a friendly Alert ("Plan limit reached") with the backend's detail string, instead of dropping the raw "402 PAYMENT REQUIRED: …" into the generic error MessageBox.
- **Admin grant UI** (`ios/app/admin.tsx`) — Top-spenders list refactored to per-user `<UserRow>` components. Each row shows a coloured tier pill (Free=grey, Pro=brand, Power=brandDeep), the status, and Grant/Revoke buttons. Grant opens a `<GrantTierModal>` with two segmented controls (Pro/Power × 30/90/365 days). Submit POSTs `/admin/subscriptions/grant`, then re-runs the existing `load()` so the row refreshes. Revoke is a confirmation Alert that POSTs `/revoke`. Errors surface as Alerts with the backend's detail string.

Out of scope (deliberate — picked up later):
- RevenueCat webhook + Apple IAP receipt validation (becomes step 7b in the next-steps list).
- Free-tier daily exercise rate limit — the brief mentions "limited exercises/day" but the curriculum cap is the higher-leverage gate; revisit when the admin sees free users churning through them.

Sanity checks: TS + Python compile clean (verified via subagent). Runtime check: hit `POST /admin/subscriptions/grant` from the admin dashboard and confirm the recipient's `/auth/me/subscription` flips to `pro`/`power` on next request. Curriculum-cap rejection: try creating a 2nd curriculum as a free user and confirm the Alert fires.

### Lessons in native_language (2026-04-29)

User feedback: lessons should be in the user's native language. The Explainer prompt already nominally said so, but the language clause was buried mid-prompt and the `example` exception was broadly worded ("may use target_language content … when that's what the user is here to learn"), which the model was reading as license to drop wholesale into target_language.

- **Explainer prompt restructured** (`backend/app/agents/explainer.py`) — moved the language rule to the top of the prompt as a non-negotiable LANGUAGE block. Spells out the five prose fields (`concept_title`, `intro`, `key_points`, `pitfalls`, `next_up`) MUST be in `native_language`, period. Tightens the `example` carve-out: prose / commentary / setup is still native; only the artifact being taught (a target-language phrase, a code snippet, a musical term, a formula) may appear in another language, and it must be glossed in native. Adds the "could a monolingual `native_language` user read this?" self-check.
- Native-form jargon nudge — for languages with established translations of common technical terms (e.g. `bg` → "променлива" instead of "variable") prefer the native form. Proper nouns, framework names, file extensions stay as-is.
- No DB migration, no client change — purely a prompt strengthening. Existing cached lesson rows keep their content_json; only newly-generated lessons benefit. If we want to retroactively re-translate, we can add a `lessons.regen` admin route later.

### Streaming Evaluator (2026-04-29)

User wanted the post-submit `feedback` and `gap` text to appear progressively instead of after the 3–6s round-trip the synchronous Evaluator used to take. Built end-to-end SSE on the existing `submit_exercise` plumbing — same persistence, same tracker / adapter side-effects, just an additional generator wrapper that yields partial Evaluator snapshots while the model is still typing.

- **Evaluator** (`backend/app/agents/evaluator.py`) — `evaluate_stream()` wraps `client.beta.chat.completions.stream(...)` over the same `evaluator_response` strict json_schema. Yields `{"snapshot": <partial parsed dict>}` on every content delta and a final `{"final": <full dict>, "usage": <obj>}` when the stream closes. Pure agent, no DB.
- **Orchestrator** (`backend/app/agents/orchestrator/_exercises.py`) — added `submit_exercise_stream()` mirroring `submit_exercise`. Both code paths now share `_prepare_evaluator_call()` (loads + ownership-checks the row, stashes the submission immediately so a crash in the Evaluator can't lose the user's text, builds the canonical-tag-aware payload) and `_persist_evaluator_result()` (writes feedback back to the row, rolls weak_areas / strengths into the curriculum, completes the week if everything in it is evaluated, runs the Adapter fail-soft). Streaming path also calls `usage_meter.record(...)` on the final usage object so the per-call cost ledger gets the same row a synchronous submit would have produced.
- **Route** `POST /curriculum/exercises/<eid>/submit/stream` (`backend/app/routes/curriculum.py`) — returns `Response(generator, mimetype="text/event-stream")` with `X-Accel-Buffering: no` to defeat proxy buffering on the home VPS. Frame contract: `event: delta` carries `{snapshot}`, `event: done` carries the full ExerciseEvalPayload, `event: error` carries `{error, detail}`. Pre-stream errors (auth, 404 ownership, 409 already-evaluated) come back as normal JSON HTTP responses so the client can branch the same way it does on the sync path.
- **iOS SSE client** — added `react-native-sse@^1.2.1` to `ios/package.json` (run `npm install` once). `ios/lib/api.ts` exposes `api.submitExerciseStream(token, exerciseId, submission)` returning `AsyncIterable<SubmitStreamFrame>`. The wrapper imports `react-native-sse` via a try/catch — if the package isn't installed yet the iterator emits one `{kind:"error"}` frame and the call site falls back to `submitExercise`. Same fall-back pattern the `Gradient` component uses for missing `expo-linear-gradient`.
- **iOS UI** — `FeedbackCard.tsx` now accepts an optional `streaming?: { feedback?, gap? }` prop. While that prop is present it renders a neutral "Scoring" tone (no green/red yet, since the verdict isn't trustworthy mid-stream), shows the partial `feedback` and `gap` text live, hides the score / weak_areas / next_focus blocks, and decorates the active text with a blinking caret (`Animated.Value` opacity loop). `ExerciseView.tsx` swaps the "Scoring…" spinner for the streaming card whenever the parent passes `streamingFeedback`.
- **iOS session screen** (`ios/app/curriculum/session.tsx`) — `submit()` now branches on exercise type. For `short_answer` (and legacy `essay_prompt` rows still in the DB) it consumes `api.submitExerciseStream` and pumps `{feedback, gap}` snapshots into a per-exercise `streamingFeedback` map; the final `done` frame falls into a shared `applyFinal()` helper. Multiple-choice / flashcards keep using the synchronous `submitExercise` — they score in <1s and the SSE round-trip would just add latency. Any error mid-stream falls back to the synchronous endpoint so the user still gets feedback.

Sanity check (deferred to runtime — needs a running backend with a seeded short_answer row): `curl -N -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" -d '{"submission":{"text":"..."}}' http://localhost:8000/curriculum/exercises/<eid>/submit/stream`. Expect a stream of `event: delta` lines followed by one `event: done` line whose payload matches the row eventually written to `exercises.feedback_json`.

### Per-answer feedback + bonus drill + retired essays (2026-04-28)

User feedback on the post-submit screen: the **EXPLANATION** block was just restating the question's requirements. The end-of-session view was a single percentage with no recap. Long-form essays felt like homework rather than practice. This change addresses all three plus adds one more learning loop.

- **Per-answer "gap" feedback** (replaces static `content.explanation`)
  - **Evaluator** (`backend/app/agents/evaluator.py`) now emits a `gap` field — 1–2 sentences in the user's native language naming the *specific* shortfall between their submission and the goal (e.g. cites a missing rubric item or what they actually wrote). Empty for `verdict="correct"` or `score≥0.9`. Added to the structured-output schema (required, strict mode) and to the system prompt's anti-restate-the-prompt guard rails.
  - **Exercise Writer** (`backend/app/agents/exercise_writer.py`) no longer emits the static `explanation` field — it just restated the question. Schema cleaned up; `_strip_empty` updated.
  - **Orchestrator + types** (`backend/app/agents/orchestrator/_exercises.py`, `types.py`) pass `gap` and `strengths` through the submit return value.
  - **iOS FeedbackCard** (`ios/components/session/FeedbackCard.tsx`) renders the gap under the heading **"Where it fell short"** instead of the old "Explanation" block.

- **Essays retired in favour of short_answer**
  - `essay_prompt` removed from the Exercise Writer's type enum and from the iOS `typeAccent` palette. Long-form prompts now use `short_answer` with a rubric — same evaluator path, less intimidating ask.
  - Legacy compatibility: `ExerciseType` keeps `essay_prompt` in the union and `ExerciseView.tsx` routes those rows to `ShortAnswer`, so old DB rows render fine without a data migration. `EssayPrompt.tsx` is stubbed (filesystem doesn't allow deletion) and no longer imported.

- **Bonus drill when the session score is poor**
  - **Backend**: `generate_exercises` accepts `focus_weak_areas: bool` (route + orchestrator). When true, the Exercise Writer is told to target the curriculum's `recent_weak_areas` tags, the bank lookup is skipped (one-user-specific drills shouldn't pollute the shared cache), and rows land with `module_index=null`. Route: `POST /curriculum/<id>/exercises` with `{ "focus_weak_areas": true }`.
  - **iOS** `ios/app/curriculum/session.tsx` adds a `bonus` phase to its phase machine: `lesson → exercises → … → finished ↘ (avg < 60% & user opts in) bonus → finished`. Bonus exercises are tracked separately in `bonusIds` so they don't pollute the progress bar or the per-module batch filter, and so the wrap-up chart can mark them visually.

- **End-of-session recap (replaces the bare percentage)**
  - **iOS FinishedView** (`ios/components/session/FinishedView.tsx`) — now shows the cheer line, a big % score, a **per-exercise bar chart** (color-coded green/amber/red, bonus drill bars rendered semi-transparent with a ★ marker), a **"To revisit"** card aggregating each exercise's weak-area tags, a **"Strong areas"** card aggregating strengths, and a **"Start bonus drill"** CTA when avg < 60% AND the bonus hasn't been started for this session yet.

- **Implicit re-leveling — assess after every session**
  - The user wanted "assessment after every session so we're doing perfect learning". Implemented as a passive signal rather than a quiz interruption: the orchestrator computes `recent_avg_score` (avg of the last 12 evaluated exercises) and surfaces it to both the **Explainer** and the **Exercise Writer** in their input payloads. Their system prompts have a new block that says, in plain English: if recent avg < 0.55 slow down (more scaffolding, easier exercises, more flashcards, fewer short_answer); if > 0.85 tighten up (skip basics, push harder questions, fewer flashcards, more short_answer). Helper: `_recent_avg_score()` in `_exercises.py`.

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
5. ~~Tracker + Adapter — progress dashboard, weak-area accumulation, re-plan upcoming weeks.~~ ✅
6. ~~Streaming responses end-to-end (SSE) for the Evaluator's longer feedback.~~ ✅
7. ~~Tier enforcement — manual admin grants, no payments yet.~~ ✅
7b. RevenueCat → Apple IAP webhook + receipt validation. ← deferred until the user is ready to deal with App Store Connect.
7c. ~~Sign in with Apple.~~ ✅
8. ~~Multimodal — listening exercises (TTS) + visual lessons (Mermaid).~~ ✅
9. TestFlight submission.

#### Step 6 subtasks — streaming Evaluator (resumable checklist)

Goal: when the user submits a `short_answer` exercise, render the Evaluator's `feedback` + `gap` text progressively (token-by-token feel) instead of after a 3–6s wait. Score / verdict / tags arrive at the end.

Design choice: OpenAI's `client.beta.chat.completions.stream()` over the same `evaluator_response` json_schema. Server forwards each parsed snapshot as one SSE `event: delta`; client renders `feedback` and `gap` strings as they grow. Final `event: done` carries the full row + DB-persisted `id`. The non-streaming `/submit` route stays for back-compat.

Backend:
- [x] **6a** — `agents/evaluator.py`: add `evaluate_stream(payload) -> Iterator[dict]`. Uses `client.beta.chat.completions.stream(...)`, yields `{"snapshot": <partial parsed dict>}` per content delta; final yield carries `{"final": <full dict>, "usage": <obj>}` for the meter.
- [x] **6b** — `orchestrator/_exercises.py`: `submit_exercise_stream(...)` mirrors `submit_exercise` but iterates through `evaluate_stream`. Shared side-effects extracted into `_prepare_evaluator_call` + `_persist_evaluator_result` helpers used by both paths.
- [x] **6c** — `routes/curriculum.py`: `POST /curriculum/exercises/<eid>/submit/stream` returns `Response(generator, mimetype="text/event-stream")`. Emits `event: delta` with snapshot JSON, `event: done` with final row, `event: error` on failure.
- [x] **6d** — usage_meter: recorded once inside `submit_exercise_stream` using the final usage object before yielding the `done` frame.
- [ ] **6e** — sanity test: hit `/submit/stream` with `curl -N`. **Deferred** — needs a running backend with a real OpenAI key + seeded `short_answer` row; curl command is logged in the Streaming Evaluator section of the changelog for the user to run locally.

iOS:
- [x] **6f** — `react-native-sse@^1.2.1` added to `ios/package.json`. **User action remaining: run `npm install` in `ios/`.**
- [x] **6g** — `lib/api.ts`: `api.submitExerciseStream(token, exerciseId, submission)` returns an `AsyncIterable<SubmitStreamFrame>` (`"delta" | "done" | "error"`). Lazy `require("react-native-sse")` inside try/catch so the file still typechecks before `npm install`.
- [x] **6h** — `components/session/FeedbackCard.tsx`: `streaming?: { feedback?: string; gap?: string }` prop renders the partial text live with a blinking caret; score/verdict/weak-areas/next-focus are hidden until streaming completes. Last-seen text is buffered in local state so dropped keys don't flash empty.
- [x] **6i** — `app/curriculum/session.tsx`: `short_answer` and the legacy `essay_prompt` go through `submitExerciseStream`; on stream error or for `multiple_choice` / `flashcard`, falls through to the synchronous `api.submitExercise` path.

QA + docs:
- [x] **6j** — TS + Python compile clean (verified via subagent).
- [x] **6k** — SETUP.md: "Streaming Evaluator (2026-04-29)" section added under the Recent changes log; step 6 crossed off the next-steps list above.

Tick each box (`[x]`) as you finish — that way a fresh session can pick up at the first `[ ]` without re-reading the whole codebase.

#### Step 7 subtasks — tier enforcement, manual grants (resumable checklist)

Goal: ship the tier hierarchy (free / pro / power) end-to-end WITHOUT Apple / RevenueCat. The admin can promote a user to pro or power from the admin dashboard for a chosen number of days; everything else (curriculum cap, Adapter gating, /me/subscription readback) keys off the `subscriptions.tier` column. RevenueCat wiring lands as a separate step 7b once the user is ready to deal with App Store Connect.

Already in place from earlier work: `subscriptions` table (migration 009) with `tier`, `status`, `current_period_end`, `revenuecat_id`; `@require_tier` decorator stub in `middleware/tier_check.py`; `@admin_only` gate via `Config.ADMIN_EMAIL`; admin dashboard at `ios/app/admin.tsx`; `TIER_PRICES_EUR_CENTS` in `config.py`. Missing: tier loading, cap enforcement, grant route, grant UI, /me readback.

Backend:
- [x] **7a** — `middleware/auth.py`: after `g.user_id` is set, look up the user's `subscriptions` row and write `g.user_tier` (default `'free'` when no row exists or status isn't `'active'`). One Supabase call per request, cached on `g`. Unblocks the existing `@require_tier` decorator.
- [x] **7b** — `config.py`: add `CURRICULUM_CAPS = {"free": 1, "pro": 3, "power": None}` (None = unlimited) and `ADAPTER_TIER_MIN = "pro"`. `orchestrator/_assessment.py` (or wherever `start_curriculum` lives): count active curricula for the user, raise `OrchestratorError(status=402, code="tier_curriculum_cap")` when the cap is reached.
- [x] **7c** — Tier check centralised in `_TrackerMixin._adapter_tier_ok` and applied at TWO places: `_run_adapter_if_eligible` returns `None` for free users (so the auto path silently skips), `run_adapter` raises `tier_adapter_required` (402) for explicit re-plan calls so the iOS layer can show an upgrade CTA. `tier` threaded through `submit_exercise`, `submit_exercise_stream`, `_persist_evaluator_result`, `run_adapter`; routes pass `g.user_tier`.
- [x] **7d** — `routes/admin.py`: `POST /admin/subscriptions/grant` (body `{user_id, tier, days?=30}`) upserts the row keyed on `user_id`, sets `current_period_end = now + days`, `status='active'`, `monthly_price_cents` from `Config.TIER_PRICES_EUR_CENTS`. Reset `started_at=now` on every grant so the admin sees "granted on …". `POST /admin/subscriptions/revoke` (body `{user_id}`) resets to free + cancelled. Both behind `@require_auth + @admin_only`. `tier='free'` on grant returns a clearer "use revoke" error.
- [x] **7e** — `routes/auth.py`: `GET /auth/me/subscription` returns `{tier, status, current_period_end, started_at, monthly_price_cents, currency, effective_tier}`. Synthesises a free-tier response when no row exists or Supabase is down so the iOS layer never has to branch on 404. Also folds `tier` into the existing `GET /auth/me` payload.

iOS:
- [x] **7f** — `lib/api.ts`: added `Subscription`, `Tier`, `SubscriptionStatus`, `GrantTierBody`, `GrantTierResponse` types + `api.mySubscription`, `api.adminGrantTier`, `api.adminRevokeTier`. New `ApiError` class so call sites can branch on `e.body.error` / `e.status` instead of substring-matching the message. Tier badge lives in the home-screen hero (no settings tab existed yet); `app/curriculum/new.tsx` now catches the 402 `tier_curriculum_cap` `ApiError` and surfaces it as an Alert.
- [x] **7g** — `app/admin.tsx`: refactored the Top-spenders list into `<UserRow>` components — email + 30-day spend on top, tier pill (Free=grey, Pro=brand, Power=brandDeep) + status + Grant/Revoke buttons on the second line. New `<GrantTierModal>` opens with two segmented controls (Pro/Power × 30/90/365 days), POSTs `/admin/subscriptions/grant`, then re-runs `load()` so the row refreshes. Revoke is a confirm-first Alert that calls `/admin/subscriptions/revoke`.

QA + docs:
- [x] **7h** — TS + Python compile clean (verified via subagent). SETUP.md: "Tier enforcement — manual grants, no payments yet (2026-04-29)" section added under Recent changes; main next-steps list shows step 7 crossed off and a new `7b.` placeholder for the RevenueCat / Apple IAP wiring.

#### Step 8 subtasks — multimodal: listening exercises + visual lessons (resumable checklist)

Goal: take the curriculum past plain text. Two new surfaces in this slice — a `listen_choice` exercise type that plays TTS audio of a phrase (in `target_language`) and asks the user to pick what was said (in `native_language`), and an optional `diagram_mermaid` field on lessons that the Explainer can fill when a structural diagram earns its keep (process flows, hierarchies, comparisons).

Design choices, called out so future-me can disagree without re-deriving them:
- **Audio = OpenAI TTS (`tts-1`)**, one round-trip per exercise, generated server-side AFTER the Writer has produced the row, BEFORE the row is persisted. Cached in Supabase Storage by content hash so a regenerated batch with identical text doesn't re-spend.
- **Storage = Supabase Storage public bucket** (`exercise-audio`). Public is fine — the URL is unguessable (hashed key) and the audio is the same content the user is paying us to hear. Saves us from signed-URL plumbing.
- **Visual lessons = Mermaid only** for v1. Free, no API cost, renders client-side in a WebView. AI-generated lesson images (DALL-E / `gpt-image-1`) are deferred — they'd be 5–10× the per-lesson cost, so they earn a separate decision later.
- **Tier-gating**: `listen_choice` is Pro+ only. Free users have those rows dropped from the batch by the orchestrator (rather than served audio-less, which would just be a worse multiple-choice). `diagram_mermaid` is free for everyone — text-only, no marginal cost.
- **No new DB columns** — both audio_url and diagram_mermaid live inside `content_json` per the existing pattern.

Backend:
- [x] **8a** — Migration `010_multimodal_exercise_types.sql` adds `listen_choice` + `image_match` to the type CHECK on both `exercises` and `exercise_bank`. Constraint discovery uses a `pg_constraint` DO block since the original was created via the Supabase dashboard with an unknown name.
- [x] **8b** — `app/services/media.py::tts_to_url(text, voice?, model?)` returns the cached/uploaded mp3's public URL. Cache key = sha256(text+voice+model), stored in the `exercise-audio` bucket as `{key}.mp3`. `_ensure_bucket` is idempotent. Records cost via `usage_meter` with `agent='tts'`; `usage_meter._cost_cents` patched to honour a `cost_cents_override` so per-character TTS pricing lands accurately. New config: `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_TTS_USD_PER_1K_CHARS`, `STORAGE_BUCKET_AUDIO`.
- [x] **8c** — Writer's `EXERCISE_TYPE_ENUM` adds `listen_choice`; schema gets `audio_text`, `language`, `prompt_native` (all required-but-empty for non-audio types per strict JSON schema). SYSTEM_PROMPT teaches when to pick the type: only with `listening_enabled=true`, `target_language` set, language-flavoured domain. `_strip_empty()` whitelists the new fields. WriterInput gets `listening_enabled: bool` so the orchestrator can gate by tier.
- [x] **8d** — `generate_exercises` takes a new `tier` kwarg (route passes `g.user_tier`). New `_materialise_audio()` helper runs after the bank+writer steps but before the DB insert: free users have all `listen_choice` rows dropped; Pro+ rows missing `audio_url` get hydrated via `media.tts_to_url`; rows with TTS failures are dropped (silent is worse than missing). The writer payload also gets `listening_enabled = tier in {'pro','power'}` so it doesn't waste output tokens on items that would be discarded.
- [x] **8e** — Explainer's RESPONSE_SCHEMA gets `diagram_mermaid: string` (required, empty = no diagram). System prompt's new DIAGRAMS block teaches when a diagram earns its keep (process flows, hierarchies, sequences, comparisons), what to avoid (vocab/single-fact concepts), and constrains output to mermaid's four core renderers + ≤8 nodes for the small mobile viewport.

iOS:
- [x] **8f** — `ios/package.json` adds `expo-av@~14.0.7` and `react-native-webview@13.8.6` (Expo SDK 51 compatible — user runs `npm install` later). `lib/api.ts`: `ExerciseType` adds `'listen_choice'` and `'image_match'` (latter is reserved for the next iteration); `ExerciseContent` adds `audio_url`, `audio_text`, `language`, `prompt_native`, `image_url`; `LessonContent` adds `diagram_mermaid?`.
- [x] **8g** — `ListenChoice.tsx` + `.styles.ts` added. Lazy `require('expo-av')` so the file typechecks before `npm install`. Auto-plays once on mount, locks options until first playback finishes, replay button never disables. On TTS failure, falls back to showing the audio_text inline so the exercise still works as a regular MCQ. Wired into `ExerciseView`'s switch.
- [x] **8g** — see Step 8f log entry above (consolidated).
- [x] **8h** — `components/lesson/MermaidDiagram.tsx` + `.styles.ts`: lazy WebView require (default OR named export to handle multiple package versions). Inline HTML pins mermaid 10.9.1 from cdnjs, themes the diagram against the app palette, posts rendered SVG height via `postMessage` so the parent `<View>` resizes (clamped 80–600px). LessonView renders the diagram in a new "Visual" section between Example and Watch out — only when `content_json.diagram_mermaid` is non-empty.

QA + docs:
- [x] **8i** — TS + Python compile clean (subagent). SETUP.md log entry added below; main next-steps list shows step 8 crossed off. **Remaining user actions**: (1) `cd ios && npm install` to pull in `expo-av` + `react-native-webview`; (2) hit `apply` on `db/migrations/010_multimodal_exercise_types.sql` in the Supabase SQL editor; (3) optional — pre-create the `exercise-audio` bucket in Supabase Storage as Public if the service-role key can't create buckets (the helper attempts it idempotently on first use).

Tick each box as you finish.

Tick each box (`[x]`) as you finish.
