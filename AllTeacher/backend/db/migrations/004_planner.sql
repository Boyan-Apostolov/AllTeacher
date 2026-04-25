-- 004_planner.sql
-- Adds Planner agent output columns to the curricula table.
-- Run in Supabase → SQL Editor → New query.

alter table public.curricula
  add column if not exists plan_json jsonb,
  add column if not exists planner_status text not null default 'pending'
    check (planner_status in ('pending','in_progress','complete'));

-- plan_json holds the Planner's TOP-LEVEL view of the curriculum:
-- {
--   "title":            "...",          -- refined topic title in native_language
--   "summary_for_user": "...",          -- 1-2 paragraph intro in native_language
--   "phases": [
--     { "name": "...", "weeks": [1,2,3], "description": "..." },
--     ...
--   ],
--   "total_weeks": 10
-- }
--
-- Per-week detail (modules, milestone, daily_minutes, etc.) lives in
-- public.curriculum_weeks.plan_json — one row per week.
