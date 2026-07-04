-- 008-ai-usage.sql
-- Tracks AI generation calls (Gemini compose, reminder planner) so we can rate
-- limit against a shared free-tier key: a per-user cap for fairness/abuse and a
-- global cap to protect the provider's RPM/RPD ceiling across all workers.
-- One row per successful call attempt; counts are read via the two functions
-- below (mirrors the get_daily_sent_count RPC pattern).

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'compose',
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_created on ai_usage (user_id, created_at desc);
create index if not exists idx_ai_usage_created on ai_usage (created_at);

-- Only the backend (service role) touches this table; service role bypasses RLS.
alter table ai_usage enable row level security;

-- Count this user's calls since a timestamp (rolling-window rate limit).
create or replace function get_ai_usage_count(user_uuid uuid, since_ts timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from public.ai_usage
  where user_id = user_uuid
    and created_at >= since_ts;
$$;

-- Count all users' calls since a timestamp (shared-quota global limit).
create or replace function get_ai_usage_count_global(since_ts timestamptz)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from public.ai_usage
  where created_at >= since_ts;
$$;
