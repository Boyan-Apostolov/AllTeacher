-- 010_multimodal_exercise_types.sql
-- Extends the exercise type enumeration to allow audio + image-based
-- exercises. Two new values:
--
--   listen_choice  → audio TTS clip + multiple-choice answers. Used for
--                    listening comprehension in language-learning
--                    curricula. content_json carries:
--                      { "title", "audio_url", "audio_text", "language",
--                        "prompt_native", "options", "correct_index",
--                        "explanation" }
--                    audio_url is generated post-Writer by the
--                    orchestrator (OpenAI TTS → Supabase Storage upload).
--                    audio_text is the spoken phrase in the user's
--                    target_language; prompt_native is the question
--                    shown above the play button in the user's
--                    native_language.
--
--   image_match    → reserved for the next iteration (no Writer support
--                    yet). Allowing it here so the next migration is
--                    only about wiring, not constraint juggling.
--
-- Both `exercises.type` and `exercise_bank.type` enforce the same set
-- so the bank can cache rows of the new types. We DROP and re-ADD the
-- check constraints — the original `exercises_type_check` was created
-- through the Supabase dashboard and its constraint name is the
-- Postgres default. The DO block discovers the actual name first so
-- this migration works on any deployment of the table.
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

-- exercises.type
do $$
declare
  cname text;
begin
  -- Find any check constraint on `exercises` that mentions the `type`
  -- column. There should be exactly one matching the existing
  -- (multiple_choice|flashcard|short_answer|essay_prompt) enumeration;
  -- drop it whatever it's called.
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
    'image_match'
  ));


-- exercise_bank.type — same drill. The constraint here was created
-- inline in migration 006 (`check (type in (...))`) so it has an
-- auto-generated name like `exercise_bank_type_check`. Discover and
-- drop defensively.
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
    'image_match'
  ));
