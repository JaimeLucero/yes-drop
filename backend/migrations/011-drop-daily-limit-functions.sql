-- 011-drop-daily-limit-functions.sql
-- The per-day send cap was removed, so nothing calls these helpers any more.
-- Already applied to production as migration 011_drop_daily_limit_functions.

drop function if exists public.get_daily_sent_count(uuid);
drop function if exists public.get_next_available_day(uuid, date);
