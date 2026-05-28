-- 001_initial_schema.sql
-- Base schema for AllTeacher. Run this first, then 002–NNN in order.
-- Safe to run on a fresh Supabase project (local or hosted).

-- users profile (auth.users is managed by Supabase Auth)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  native_language text default 'en',
  target_language text,
  created_at timestamptz default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','starter','pro','power')),
  revenuecat_id text,
  token_usage_month int default 0,
  updated_at timestamptz default now()
);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null,
  domain text,
  status text not null default 'active' check (status in ('active','completed','paused','archived')),
  created_at timestamptz default now()
);

create table if not exists public.curriculum_weeks (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  week_number int not null,
  plan_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  week_id uuid references public.curriculum_weeks(id) on delete set null,
  type text not null,
  content_json jsonb not null default '{}'::jsonb,
  seen boolean default false,
  score numeric,
  created_at timestamptz default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete cascade,
  conversation_history_json jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.mastery_scores (
  user_id uuid not null references public.users(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  topic text not null,
  score numeric not null,
  updated_at timestamptz default now(),
  primary key (user_id, curriculum_id, topic)
);

-- RLS: users read/write their own rows. Service role bypasses these.
alter table public.users            enable row level security;
alter table public.subscriptions    enable row level security;
alter table public.curricula        enable row level security;
alter table public.curriculum_weeks enable row level security;
alter table public.exercises        enable row level security;
alter table public.sessions         enable row level security;
alter table public.mastery_scores   enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='users' and policyname='self') then
    create policy "self" on public.users for all using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='subscriptions' and policyname='self') then
    create policy "self" on public.subscriptions for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='curricula' and policyname='self') then
    create policy "self" on public.curricula for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='sessions' and policyname='self') then
    create policy "self" on public.sessions for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='mastery_scores' and policyname='self') then
    create policy "self" on public.mastery_scores for all using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='curriculum_weeks' and policyname='via_curriculum') then
    create policy "via_curriculum" on public.curriculum_weeks for all
      using (exists (select 1 from public.curricula c where c.id = curriculum_id and c.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='exercises' and policyname='via_curriculum') then
    create policy "via_curriculum" on public.exercises for all
      using (exists (select 1 from public.curricula c where c.id = curriculum_id and c.user_id = auth.uid()));
  end if;
end $$;

-- Auto-create profile row on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.subscriptions (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
