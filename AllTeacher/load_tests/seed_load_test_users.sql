-- seed_load_test_users.sql
-- Pre-inserts 20 load test users so FK constraints pass when running
-- load tests against a real local Supabase instance.
--
-- These UUIDs are deterministically derived from md5("lt-N") and must
-- match LOAD_TEST_UIDS in load_tests/locustfile.py.
--
-- Run once after applying all migrations:
--   psql "$DATABASE_URL" -f load_tests/seed_load_test_users.sql
-- Or paste into Supabase SQL Editor.
--
-- Safe to re-run — all inserts use ON CONFLICT DO NOTHING.

-- Insert into auth.users first (bypasses the signup flow).
-- instance_id and aud are required non-null fields in Supabase's auth schema.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values
  ('d8fb3abf-7224-83dd-2b22-9be346476db2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-0@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('1440bef5-4d9c-5fdf-accc-9306d3c5c4f9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-1@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('2c09a2e4-fd4c-704e-fdf3-9eb584ca5cdc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-2@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('fcc2e87e-5740-f53f-9494-1c0d27a55291', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-3@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('00ebbeb7-232b-dac1-2675-81a76b3306c0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-4@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('9d4daa4c-81ee-bb7c-ab68-3793447f9f76', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-5@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('4c5209d5-f81f-fadc-4a55-c9c60dac21e0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-6@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('b54184b1-8dcf-e221-e9f9-cd758451c52f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-7@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('63c42f40-ec33-89c7-ae1f-98f2bd83d220', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-8@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('d30d6887-6d79-995e-6a4b-d2baaed6dfa4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-9@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('21c23813-d5dd-6e5e-323c-3f26bc01b1d7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-10@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('4f420ac2-6a81-6f23-100d-def4c73265fe', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-11@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('4cc409c1-7571-4536-d32b-aa2fd66bec86', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-12@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('661977f0-7152-c230-a7fb-1bddf202da15', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-13@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('5aa914c4-ba15-0e24-9a00-8c1976a41cd8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-14@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('1aa1b94c-c06b-9a2a-a28c-723090017a13', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-15@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('7af95937-1e0a-b9b4-3969-cc23153237ea', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-16@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('197df305-7343-93fa-a23d-b634aecbc363', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-17@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('32e10a3c-bd84-acbd-fbb7-288d51b33f98', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-18@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false),
  ('0c88965d-9de4-532a-35f1-74213e9c5d82', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lt-19@loadtest.local', '', now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false)
on conflict (id) do nothing;

-- public.users + subscriptions (trigger fires on auth.users insert but
-- we handle it manually here in case the trigger hasn't run yet).
insert into public.users (id, email) values
  ('d8fb3abf-7224-83dd-2b22-9be346476db2', 'lt-0@loadtest.local'),
  ('1440bef5-4d9c-5fdf-accc-9306d3c5c4f9', 'lt-1@loadtest.local'),
  ('2c09a2e4-fd4c-704e-fdf3-9eb584ca5cdc', 'lt-2@loadtest.local'),
  ('fcc2e87e-5740-f53f-9494-1c0d27a55291', 'lt-3@loadtest.local'),
  ('00ebbeb7-232b-dac1-2675-81a76b3306c0', 'lt-4@loadtest.local'),
  ('9d4daa4c-81ee-bb7c-ab68-3793447f9f76', 'lt-5@loadtest.local'),
  ('4c5209d5-f81f-fadc-4a55-c9c60dac21e0', 'lt-6@loadtest.local'),
  ('b54184b1-8dcf-e221-e9f9-cd758451c52f', 'lt-7@loadtest.local'),
  ('63c42f40-ec33-89c7-ae1f-98f2bd83d220', 'lt-8@loadtest.local'),
  ('d30d6887-6d79-995e-6a4b-d2baaed6dfa4', 'lt-9@loadtest.local'),
  ('21c23813-d5dd-6e5e-323c-3f26bc01b1d7', 'lt-10@loadtest.local'),
  ('4f420ac2-6a81-6f23-100d-def4c73265fe', 'lt-11@loadtest.local'),
  ('4cc409c1-7571-4536-d32b-aa2fd66bec86', 'lt-12@loadtest.local'),
  ('661977f0-7152-c230-a7fb-1bddf202da15', 'lt-13@loadtest.local'),
  ('5aa914c4-ba15-0e24-9a00-8c1976a41cd8', 'lt-14@loadtest.local'),
  ('1aa1b94c-c06b-9a2a-a28c-723090017a13', 'lt-15@loadtest.local'),
  ('7af95937-1e0a-b9b4-3969-cc23153237ea', 'lt-16@loadtest.local'),
  ('197df305-7343-93fa-a23d-b634aecbc363', 'lt-17@loadtest.local'),
  ('32e10a3c-bd84-acbd-fbb7-288d51b33f98', 'lt-18@loadtest.local'),
  ('0c88965d-9de4-532a-35f1-74213e9c5d82', 'lt-19@loadtest.local')
on conflict (id) do nothing;

insert into public.subscriptions (user_id, tier, status, current_period_end) values
  ('d8fb3abf-7224-83dd-2b22-9be346476db2', 'pro', 'active', null),
  ('1440bef5-4d9c-5fdf-accc-9306d3c5c4f9', 'pro', 'active', null),
  ('2c09a2e4-fd4c-704e-fdf3-9eb584ca5cdc', 'pro', 'active', null),
  ('fcc2e87e-5740-f53f-9494-1c0d27a55291', 'pro', 'active', null),
  ('00ebbeb7-232b-dac1-2675-81a76b3306c0', 'pro', 'active', null),
  ('9d4daa4c-81ee-bb7c-ab68-3793447f9f76', 'pro', 'active', null),
  ('4c5209d5-f81f-fadc-4a55-c9c60dac21e0', 'pro', 'active', null),
  ('b54184b1-8dcf-e221-e9f9-cd758451c52f', 'pro', 'active', null),
  ('63c42f40-ec33-89c7-ae1f-98f2bd83d220', 'pro', 'active', null),
  ('d30d6887-6d79-995e-6a4b-d2baaed6dfa4', 'pro', 'active', null),
  ('21c23813-d5dd-6e5e-323c-3f26bc01b1d7', 'pro', 'active', null),
  ('4f420ac2-6a81-6f23-100d-def4c73265fe', 'pro', 'active', null),
  ('4cc409c1-7571-4536-d32b-aa2fd66bec86', 'pro', 'active', null),
  ('661977f0-7152-c230-a7fb-1bddf202da15', 'pro', 'active', null),
  ('5aa914c4-ba15-0e24-9a00-8c1976a41cd8', 'pro', 'active', null),
  ('1aa1b94c-c06b-9a2a-a28c-723090017a13', 'pro', 'active', null),
  ('7af95937-1e0a-b9b4-3969-cc23153237ea', 'pro', 'active', null),
  ('197df305-7343-93fa-a23d-b634aecbc363', 'pro', 'active', null),
  ('32e10a3c-bd84-acbd-fbb7-288d51b33f98', 'pro', 'active', null),
  ('0c88965d-9de4-532a-35f1-74213e9c5d82', 'pro', 'active', null)
on conflict (user_id) do nothing;
