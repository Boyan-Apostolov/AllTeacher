-- 005_exercises.sql
-- Extends the exercises table with columns the Exercise Writer + Evaluator
-- pipeline needs: a stable lifecycle (pending → submitted → evaluated /
-- skipped), a pointer to the module within a week, the user's submission,
-- and the Evaluator's structured feedback.
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

alter table public.exercises
  add column if not exists module_index int,
  add column if not exists status text not null default 'pending'
    check (status in ('pending','submitted','evaluated','skipped')),
  add column if not exists submission_json jsonb,
  add column if not exists feedback_json jsonb,
  add column if not exists evaluated_at timestamptz;

-- content_json holds the Exercise Writer's structured payload. Shape varies
-- by `type`:
--
-- type=multiple_choice:
--   { "title": "...", "prompt": "...", "options": ["..."],
--     "correct_index": 0, "explanation": "..." }
--
-- type=flashcard:
--   { "title": "...", "front": "...", "back": "...",
--     "explanation": "..." }
--
-- type=short_answer:
--   { "title": "...", "prompt": "...", "expected": "...",
--     "rubric": ["..."], "explanation": "..." }
--
-- type=essay_prompt:
--   { "title": "...", "prompt": "...", "rubric": ["..."],
--     "expected_length": "1-2 paragraphs", "explanation": "..." }
--
-- submission_json holds the user's response, shape varies by type:
--   multiple_choice → { "choice_index": 2 }
--   flashcard       → { "self_rating": "easy"|"medium"|"hard", "note": "..." }
--   short_answer    → { "text": "..." }
--   essay_prompt    → { "text": "..." }
--
-- feedback_json holds the Evaluator's response:
--   { "score": 0..1, "verdict": "correct"|"partial"|"incorrect"|"reviewed",
--     "feedback": "...native_language...",
--     "weak_areas": ["..."], "next_focus": "..." }

create index if not exists exercises_curriculum_status_idx
  on public.exercises (curriculum_id, status);

create index if not exists exercises_week_status_idx
  on public.exercises (week_id, status);
