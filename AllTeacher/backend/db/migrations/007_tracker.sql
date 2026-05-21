-- 007_tracker.sql
-- Tracker + Adapter columns.
--
-- Adds the small amount of denormalised state the Tracker reads (streaks,
-- strengths, last activity) and the Adapter writes (replan_count, bonus
-- weeks). Most progress data is still derived on the fly from `exercises`
-- and `curriculum_weeks`; only the things that are expensive or impossible
-- to derive live here.
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

-- 1. recent_strengths — parallel to recent_weak_areas, capped to ~K most
--    recent entries by the orchestrator on write. Lets the Adapter say
--    "skip review of X, the user is solid; lean into Y, they keep
--    fumbling it."
alter table public.curricula
  add column if not exists recent_strengths text[] not null default '{}';

-- 2. last_active_at — bumped whenever the user submits an exercise.
--    Drives streak math without scanning every exercise row at read time.
alter table public.curricula
  add column if not exists last_active_at timestamptz;

-- 3. replan_count — how many times the Adapter has rewritten the plan.
--    Surfaced in the dashboard so users see "your plan has adapted N times
--    based on your progress".
alter table public.curricula
  add column if not exists replan_count int not null default 0;

-- 4. is_bonus — flag for weeks the Adapter inserted on top of the
--    Planner's original arc to drill stubborn weak areas. Lets the UI mark
--    them visually + lets the next Adapter run treat them differently
--    (e.g. drop them once the user is no longer struggling there).
alter table public.curriculum_weeks
  add column if not exists is_bonus boolean not null default false;

-- 5. Cheap index for the dashboard's per-user "active recently?" lookup.
create index if not exists curricula_user_last_active_idx
  on public.curricula (user_id, last_active_at desc);
