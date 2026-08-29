-- approval_requests.user_id referenced auth.users(id) with NO ACTION, unlike
-- every other FK to auth.users in this schema (email_accounts, ai_usage).
-- Deleting a user who had any request failed with the Supabase dashboard's
-- generic "Database error deleting user".
--
-- The request_* children (email_events, feedback, reminders) already cascade
-- from approval_requests, so cascading this one constraint completes the chain:
-- auth.users -> approval_requests -> request_email_events / request_feedback /
-- request_reminders.
--
-- user_id is NOT NULL, so "on delete set null" is not an option here.

alter table public.approval_requests
  drop constraint approval_requests_user_id_fkey,
  add constraint approval_requests_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
