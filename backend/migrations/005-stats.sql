-- 005-stats.sql
-- Aggregate stats functions for the data-driven landing page (public) and the
-- dashboard analytics band (per-user). Called from the backend via the service
-- role key, so RLS is bypassed. search_path pinned for safety.

-- Global marketing aggregates for the public landing page.
create or replace function get_public_stats()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'total_sent', (
      select count(*) from approval_requests where sent_at is not null
    ),
    'total_approved', (
      select count(*) from approval_requests where status = 'approved'
    ),
    'total_rejected', (
      select count(*) from approval_requests where status = 'rejected'
    ),
    'approval_rate', (
      select case
        when count(*) filter (where status in ('approved', 'rejected')) = 0 then null
        else round(
          100.0 * count(*) filter (where status = 'approved')
          / count(*) filter (where status in ('approved', 'rejected'))
        )
      end
      from approval_requests
    ),
    'avg_response_hours', (
      select round(
        avg(extract(epoch from (updated_at - sent_at)) / 3600.0)::numeric, 1
      )
      from approval_requests
      where status in ('approved', 'rejected') and sent_at is not null
    ),
    'active_users', (
      select count(distinct user_id) from approval_requests
    )
  );
$$;

-- Per-user aggregates for the authenticated dashboard analytics band.
create or replace function get_user_stats(user_uuid uuid)
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'total', (
      select count(*) from approval_requests where user_id = user_uuid
    ),
    'by_status', (
      select coalesce(json_object_agg(status, cnt), '{}'::json)
      from (
        select status, count(*) as cnt
        from approval_requests
        where user_id = user_uuid
        group by status
      ) s
    ),
    'sent', (
      select count(*) from approval_requests
      where user_id = user_uuid and sent_at is not null
    ),
    'pending', (
      select count(*) from approval_requests
      where user_id = user_uuid and status = 'pending'
    ),
    'approved', (
      select count(*) from approval_requests
      where user_id = user_uuid and status = 'approved'
    ),
    'approval_rate', (
      select case
        when count(*) filter (where status in ('approved', 'rejected')) = 0 then null
        else round(
          100.0 * count(*) filter (where status = 'approved')
          / count(*) filter (where status in ('approved', 'rejected'))
        )
      end
      from approval_requests
      where user_id = user_uuid
    ),
    'avg_response_hours', (
      select round(
        avg(extract(epoch from (updated_at - sent_at)) / 3600.0)::numeric, 1
      )
      from approval_requests
      where user_id = user_uuid
        and status in ('approved', 'rejected')
        and sent_at is not null
    ),
    'volume_30d', (
      select coalesce(json_agg(row_to_json(v) order by v.date), '[]'::json)
      from (
        select date_trunc('day', sent_at)::date as date, count(*) as count
        from approval_requests
        where user_id = user_uuid
          and sent_at is not null
          and sent_at >= now() - interval '30 days'
        group by 1
      ) v
    )
  );
$$;
