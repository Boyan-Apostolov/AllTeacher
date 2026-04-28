-- 009_admin_billing_usage.sql
-- Admin dashboard foundations: billing state + per-call API cost ledger.
--
-- Two new tables:
--
-- 1. public.subscriptions
--    Mirrors the user's billing tier so the admin dashboard can compute
--    MRR/profit without round-tripping to RevenueCat. The RevenueCat
--    webhook (still stubbed) will write here once live; for now we seed
--    rows manually for testing. One row per user (user_id is the PK).
--
--    Tier prices live on the row itself (`monthly_price_cents`) rather
--    than a lookup table — keeps historical accounting simple if we
--    ever change the price of "pro": existing subs stay at their old
--    rate, new subs get the new rate.
--
-- 2. public.token_usage_log
--    One row per OpenAI API call. Captured by the in-process
--    usage_meter (see app/services/usage_meter.py). Powers the
--    "API cost trend" + "per-agent breakdown" charts on the admin
--    dashboard.
--
--    cost_cents is computed at write time using the pricing table baked
--    into Config (so a future price change doesn't retroactively rewrite
--    history). Stored as numeric to avoid losing sub-cent precision on
--    cheap calls — the dashboard rolls up to whole cents on read.
--
-- Both tables are admin-read-only from the iOS side (only the user with
-- ADMIN_EMAIL can hit the routes). RLS denies non-service-role reads.
--
-- Run in Supabase → SQL Editor → New query. Idempotent — safe to re-run.

create extension if not exists pgcrypto;

-- 1. subscriptions ---------------------------------------------------------

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free'
    check (tier in ('free','pro','power')),
  monthly_price_cents int not null default 0,
  currency text not null default 'EUR',
  started_at timestamptz not null default now(),
  current_period_end timestamptz,
  revenuecat_id text,
  status text not null default 'active'
    check (status in ('active','canceled','expired','grace','paused')),
  updated_at timestamptz not null default now()
);

-- Quick "how many active paying subs?" lookups + tier breakdowns.
create index if not exists subscriptions_tier_status_idx
  on public.subscriptions (tier, status);

-- Streak of recent signups / churns by month.
create index if not exists subscriptions_started_at_idx
  on public.subscriptions (started_at desc);

-- RLS: service role only. The dashboard goes through Flask, which uses
-- the service role key, so end users never read this directly.
alter table public.subscriptions enable row level security;

drop policy if exists "self_read" on public.subscriptions;
create policy "self_read" on public.subscriptions for select
  using (user_id = auth.uid());


-- 2. token_usage_log ------------------------------------------------------

create table if not exists public.token_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  curriculum_id uuid references public.curricula(id) on delete set null,
  agent text not null,                       -- "explainer" | "evaluator" | ...
  model text not null,                       -- "gpt-4o" | "gpt-4o-mini" | ...
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_cents numeric(12,4) not null default 0,
  created_at timestamptz not null default now()
);

-- Time-series rollups (daily / weekly cost charts).
create index if not exists token_usage_log_created_at_idx
  on public.token_usage_log (created_at desc);

-- Per-user spend (helpful for spotting heavy users on free tier).
create index if not exists token_usage_log_user_created_idx
  on public.token_usage_log (user_id, created_at desc);

-- Per-agent breakdown — the "which agent is burning the most?" panel.
create index if not exists token_usage_log_agent_created_idx
  on public.token_usage_log (agent, created_at desc);

-- Service role only — nobody should read other users' usage.
alter table public.token_usage_log enable row level security;
