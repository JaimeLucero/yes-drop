-- 010-ai-provider-keys.sql
-- Bring-your-own-key AI: one provider API key per user, stored encrypted (Fernet,
-- same TOKEN_ENC_KEY as email_accounts). The key never leaves the backend.
-- Also drops the global shared-key usage counter; there is no shared key any more.

create table if not exists public.ai_provider_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'anthropic', 'openai')),
  model text not null,
  api_key_encrypted text not null,
  connected_at timestamptz not null default now()
);

-- Only the backend (service role, bypasses RLS) reads this table. No client
-- policy is created on purpose: the browser must never be able to select the key.
alter table public.ai_provider_keys enable row level security;

drop function if exists get_ai_usage_count_global(timestamptz);
