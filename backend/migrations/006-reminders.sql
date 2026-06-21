-- 006-reminders.sql
-- Explicit reminder rows replace the brittle day-offset follow_up_strategy
-- execution model. Each row is one reminder with an absolute send time, so a
-- request can have any number of reminders at exact times, each with its own
-- optional copy. The status flag provides dedup (a sent reminder never re-fires).

create table if not exists request_reminders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references approval_requests(id) on delete cascade,
  kind text not null check (kind in ('before_deadline', 'after_sending', 'absolute')),
  send_at timestamptz not null,
  custom_message text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_reminders_due
  on request_reminders (status, send_at);
create index if not exists idx_request_reminders_request
  on request_reminders (request_id);

-- Only the backend (service role) touches this table; service role bypasses RLS.
alter table request_reminders enable row level security;

-- Pending reminders that are due, whose parent request is still awaiting a
-- decision (status = 'pending'). Reminders for resolved/ignored requests are
-- simply never returned. The row status flag dedups already-sent reminders.
create or replace function get_due_reminders()
returns table (
  reminder_id uuid,
  request_id uuid,
  kind text,
  custom_message text,
  token text,
  title text,
  message text,
  file_url text,
  approver_email text,
  requester_email text,
  user_id uuid,
  deadline timestamptz,
  sent_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    r.id, r.request_id, r.kind, r.custom_message,
    a.token, a.title, a.message, a.file_url,
    a.approver_email, a.requester_email, a.user_id,
    a.deadline, a.sent_at
  from request_reminders r
  join approval_requests a on a.id = r.request_id
  where r.status = 'pending'
    and r.send_at <= now()
    and a.status = 'pending';
$$;
