-- 011_add_starter_tier.sql
--
-- Adds 'starter' (€3/mo) between 'free' and 'pro'.
-- New tier ladder: free → starter → pro → power
--
-- Run order: after 009_admin_billing_usage.sql (which created the subscriptions table).

-- 1. Drop the old tier check constraint and re-create it with 'starter' included.
--    Supabase / Postgres requires naming the constraint to drop it; the name was
--    set in 009. Adjust the constraint name below if yours differs.

alter table public.subscriptions
  drop constraint if exists subscriptions_tier_check;

alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('free', 'starter', 'pro', 'power'));

-- 2. Update monthly_price_cents defaults for each tier so the admin dashboard
--    MRR calculation stays accurate on existing rows (no rows to backfill yet,
--    but the constraint is in place for new rows).

-- Note: monthly_price_cents is set per-row at grant time by the backend;
-- there is no column-level default to change here.  The values used by
-- the grant endpoint are:
--   starter  →  300  (€3.00)
--   pro      →  800  (€8.00)   (was 799)
--   power    →  1500 (€15.00)  (was 1499)
-- Update the backend's grant logic to use these rounded values.

comment on table public.subscriptions is
  'User billing tier. Tiers: free (€0) | starter (€3) | pro (€8) | power (€15).';
