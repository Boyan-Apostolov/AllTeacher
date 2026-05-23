-- 013_knowledge_cards.sql
-- Spaced-repetition card library: domain-agnostic knowledge bank auto-
-- populated from flashcard exercises and Explainer lessons, plus manual
-- user entries.

create table if not exists public.knowledge_cards (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete cascade,
  front         text        not null,
  back          text        not null,
  example       text,
  domain        text        not null default 'general',
  curriculum    text        not null default '',
  curriculum_id uuid        references public.curricula(id) on delete set null,
  emoji         text        not null default '📝',
  difficulty    text        not null default 'medium'
                              check (difficulty in ('easy', 'medium', 'hard')),
  mastery       integer     not null default 0
                              check (mastery >= 0 and mastery <= 100),
  last_reviewed timestamptz,
  next_due      timestamptz,
  -- origin of the card
  source        text        not null default 'manual'
                              check (source in ('exercise', 'lesson', 'manual')),
  source_id     uuid,       -- exercise.id or lesson.id that produced this card
  created_at    timestamptz default now()
);

alter table public.knowledge_cards enable row level security;

create policy "self" on public.knowledge_cards
  for all using (auth.uid() = user_id);

create index if not exists knowledge_cards_user_id_idx
  on public.knowledge_cards (user_id);

create index if not exists knowledge_cards_user_due_idx
  on public.knowledge_cards (user_id, next_due);

create index if not exists knowledge_cards_user_curriculum_idx
  on public.knowledge_cards (user_id, curriculum_id);

-- Prevent duplicate cards from the same source (exercise or lesson).
create unique index if not exists knowledge_cards_source_uniq
  on public.knowledge_cards (user_id, source_id)
  where source_id is not null;
