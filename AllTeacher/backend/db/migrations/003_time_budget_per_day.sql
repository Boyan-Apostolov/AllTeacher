-- 003_time_budget_per_day.sql
-- Rename the Assessor's time-budget column from per-week to per-day.
-- Run in Supabase → SQL Editor → New query.

alter table public.curricula
  rename column time_budget_mins_per_week to time_budget_mins_per_day;
