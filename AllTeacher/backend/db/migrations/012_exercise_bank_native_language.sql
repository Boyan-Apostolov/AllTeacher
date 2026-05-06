-- 012_exercise_bank_native_language.sql
--
-- The exercise bank was keyed by (domain, level, target_language) but not by
-- native_language. This meant exercises generated for a German user learning
-- Dutch (questions in German) could be served to an English user learning
-- Dutch — giving them incomprehensible questions.
--
-- Fix: add native_language column, rebuild dedupe + lookup indexes to include
-- it, and back-fill existing rows to 'en' (the safe assumption for any row
-- created before multi-language support).
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

-- 1. Add the column (defaults to 'en' for all pre-existing rows).
alter table public.exercise_bank
  add column if not exists native_language text not null default 'en';

-- 2. Rebuild the unique dedupe index to include native_language.
drop index if exists exercise_bank_dedupe_idx;
create unique index if not exists exercise_bank_dedupe_idx
  on public.exercise_bank (
    domain, level,
    coalesce(target_language, ''),
    coalesce(week_number, 0),
    is_first_session,
    native_language,
    title
  );

-- 3. Rebuild lookup indexes to include native_language so Postgres uses them.
drop index if exists exercise_bank_first_session_idx;
create index if not exists exercise_bank_first_session_idx
  on public.exercise_bank (domain, level, target_language, native_language)
  where is_first_session = true;

drop index if exists exercise_bank_week_idx;
create index if not exists exercise_bank_week_idx
  on public.exercise_bank (domain, level, target_language, native_language, week_number)
  where is_first_session = false;
