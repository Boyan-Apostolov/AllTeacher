-- 014_video_choice_type.sql
-- Adds `video_choice` to the exercises and exercise_bank type constraints.
-- video_choice is a multiple-choice exercise where a short YouTube/video
-- clip is embedded above the question. content_json carries:
--   { "type", "title", "video_url", "prompt", "options", "correct_index",
--     "explanation" }
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

-- exercises.type
do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'exercises'
      and t.relnamespace = 'public'::regnamespace
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%type%'
      and pg_get_constraintdef(c.oid) ilike '%multiple_choice%'
  loop
    execute format('alter table public.exercises drop constraint %I', cname);
  end loop;
end$$;

alter table public.exercises
  add constraint exercises_type_check
  check (type in (
    'multiple_choice',
    'flashcard',
    'short_answer',
    'essay_prompt',
    'listen_choice',
    'image_match',
    'video_choice'
  ));


-- exercise_bank.type
do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'exercise_bank'
      and t.relnamespace = 'public'::regnamespace
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%type%'
      and pg_get_constraintdef(c.oid) ilike '%multiple_choice%'
  loop
    execute format('alter table public.exercise_bank drop constraint %I', cname);
  end loop;
end$$;

alter table public.exercise_bank
  add constraint exercise_bank_type_check
  check (type in (
    'multiple_choice',
    'flashcard',
    'short_answer',
    'essay_prompt',
    'listen_choice',
    'image_match',
    'video_choice'
  ));
