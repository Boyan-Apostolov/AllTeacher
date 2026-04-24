-- 002_curriculum_assessment.sql
-- Adds Assessor agent output columns to the curricula table.
-- Run in Supabase → SQL Editor → New query.

alter table public.curricula
  add column if not exists goal text,
  add column if not exists native_language text,
  add column if not exists target_language text,
  add column if not exists level text,
  add column if not exists learning_style text,
  add column if not exists time_budget_mins_per_week int,
  add column if not exists assessment_json jsonb not null default '{}'::jsonb,
  add column if not exists assessor_status text not null default 'pending'
    check (assessor_status in ('pending','in_progress','complete'));

-- assessment_json holds the Assessor transcript:
-- {
--   "transcript": [
--     { "question": "...", "options": ["A","B","C"], "answer": "A" },
--     ...
--   ]
-- }
