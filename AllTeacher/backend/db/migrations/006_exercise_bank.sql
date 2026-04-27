-- 006_exercise_bank.sql
-- Adds the global Exercise Bank so we don't regenerate exercises per user.
--
-- The bank stores every exercise we ever generate (or curate), keyed by
-- (domain, level, target_language, week_number, weak_areas[]). Two flows:
--
-- 1. First session — same for everyone with the same (domain, level,
--    target_language). The first user to land on a new key triggers an
--    LLM call; the result is frozen in the bank with is_first_session=true
--    and reused for every future user with that key.
--
-- 2. Follow-up sessions — adaptive. We rank bank rows by overlap with the
--    user's recent weak_areas; if we don't have enough hits we generate
--    fresh exercises (passing the weak_areas to the writer) and persist
--    them in the bank for future reuse.
--
-- Per-user state still lives on `exercises` (submission_json, feedback_json,
-- score, status). `exercises.bank_id` points back to the canonical content.
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.exercise_bank (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  level text not null,
  target_language text,                -- nullable: not every domain has one
  week_number int,                     -- null only for is_first_session=true
  is_first_session boolean not null default false,
  weak_areas text[] not null default '{}',  -- focus tags this exercise targets
  exercise_focus text[] not null default '{}', -- the week's focus tags
  type text not null
    check (type in ('multiple_choice','flashcard','short_answer','essay_prompt')),
  title text not null,
  content_json jsonb not null,
  source text not null default 'generated'
    check (source in ('generated','curated')),
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Lookup paths the orchestrator uses.
create index if not exists exercise_bank_first_session_idx
  on public.exercise_bank (domain, level, target_language)
  where is_first_session = true;

create index if not exists exercise_bank_week_idx
  on public.exercise_bank (domain, level, target_language, week_number)
  where is_first_session = false;

-- GIN index so weak_areas overlap (`&&`) is fast.
create index if not exists exercise_bank_weak_areas_gin
  on public.exercise_bank using gin (weak_areas);

-- Avoid inserting the literal same exercise twice for the same key.
-- Title is short and stable per LLM output; this is good enough as a
-- soft uniqueness guard. (Two semantically-similar exercises with
-- different titles are still allowed — that's diversity, not dupe.)
create unique index if not exists exercise_bank_dedupe_idx
  on public.exercise_bank (
    domain, level,
    coalesce(target_language, ''),
    coalesce(week_number, 0),
    is_first_session,
    title
  );


-- Per-user exercise rows now reference the bank entry they were sourced
-- from. Nullable for rows created before this migration.
alter table public.exercises
  add column if not exists bank_id uuid references public.exercise_bank(id)
    on delete set null;

create index if not exists exercises_bank_id_idx
  on public.exercises (bank_id);


-- Track the user's recent struggles so adaptive sessions can target them.
-- Capped to the most recent K entries by the orchestrator on write.
alter table public.curricula
  add column if not exists recent_weak_areas text[] not null default '{}';
