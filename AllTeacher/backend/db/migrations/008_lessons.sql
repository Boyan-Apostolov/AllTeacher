-- 008_lessons.sql
-- Adds the lessons table powering the new "teach before you drill" flow.
--
-- The Planner already breaks each week into discrete `modules[]` (one per
-- concept — e.g. "Past tense", "List comprehensions"). Before exercising a
-- module, the user now reads a short lesson the Explainer agent generated
-- for that exact (curriculum, week, module_index). One lesson per module.
--
-- Lesson length adapts to the user's level via the agent prompt — the row
-- itself just stores whatever JSON the agent returned.
--
-- State machine on `lessons.status`:
--
--   pending   — row reserved before the LLM call (rare; the orchestrator
--               tends to fall through directly to ready on success)
--   ready     — content_json populated, never opened by the user yet
--   seen      — user advanced past the lesson screen at least once
--
-- content_json shape (Explainer output):
--   {
--     "concept_title": "...",
--     "intro": "...",                 -- one-paragraph hook in native_language
--     "key_points": ["...", "..."],   -- 2–6 bullets
--     "example": "...",               -- worked example
--     "pitfalls": ["...", "..."],     -- common misconceptions, may be empty
--     "next_up": "..."                -- one-line bridge into the exercises
--   }
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  week_id uuid not null references public.curriculum_weeks(id) on delete cascade,
  module_index int not null,
  concept_title text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  status text not null default 'ready'
    check (status in ('pending','ready','seen')),
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- One lesson per (curriculum, week, module). The orchestrator relies on
-- this for the "look up existing, generate if missing" path.
create unique index if not exists lessons_curriculum_week_module_uniq
  on public.lessons (curriculum_id, week_id, module_index);

-- Hot path: list lessons for a week ordered by module_index.
create index if not exists lessons_week_idx
  on public.lessons (curriculum_id, week_id, module_index);

-- RLS: a user can read/write a lesson iff they own the parent curriculum.
-- Service role bypasses (the Flask backend uses it).
alter table public.lessons enable row level security;

drop policy if exists "via_curriculum" on public.lessons;
create policy "via_curriculum" on public.lessons for all
  using (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_id and c.user_id = auth.uid()
    )
  );
