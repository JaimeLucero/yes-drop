-- Per-user Gmail send accounts (OAuth gmail.send). Refresh token stored encrypted.
create table if not exists public.email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google',
  email text,
  refresh_token_encrypted text not null,
  scopes text,
  last_error text,
  connected_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.email_accounts enable row level security;

drop policy if exists "Users manage own email accounts" on public.email_accounts;
create policy "Users manage own email accounts" on public.email_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists email_accounts_user_idx on public.email_accounts (user_id);

-- Gmail threading ids snapshot on each request (for follow-up threading).
alter table public.approval_requests
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text;

-- Brevo sender identities are superseded by Gmail send.
drop table if exists public.sender_identities;
