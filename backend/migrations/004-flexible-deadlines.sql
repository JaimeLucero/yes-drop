-- YesDrop Database Migration: Flexible Deadlines & Follow-ups
-- Run in Supabase Dashboard → SQL Editor

-- 1. Update follow_up_strategy to use JSONB for flexibility
ALTER TABLE public.approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_follow_up_strategy_check;

ALTER TABLE public.approval_requests
ALTER COLUMN follow_up_strategy TYPE JSONB USING 
  CASE 
    WHEN follow_up_strategy = 'none' THEN '{"enabled": false}'::jsonb
    WHEN follow_up_strategy = '1_day_before' THEN '{"enabled": true, "days_before_deadline": 1}'::jsonb
    WHEN follow_up_strategy = '2_days_after' THEN '{"enabled": true, "days_after_sending": 2}'::jsonb
    WHEN follow_up_strategy = 'both' THEN '{"enabled": true, "days_before_deadline": 1, "days_after_sending": 2}'::jsonb
    ELSE '{"enabled": false}'::jsonb
  END;

-- 2. Add deadline_days column for custom deadline duration
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS deadline_days INTEGER DEFAULT 3;

-- 3. Update deadline calculation to use deadline_days
-- Drop old function
DROP FUNCTION IF EXISTS get_requests_past_deadline();

-- Recreate with new logic
CREATE OR REPLACE FUNCTION get_requests_past_deadline()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  approver_email TEXT,
  title TEXT,
  deadline TIMESTAMPTZ,
  requester_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    ar.approver_email,
    ar.title,
    ar.deadline,
    ar.requester_email
  FROM public.approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.deadline IS NOT NULL
    AND ar.deadline < NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- Update 1_day_before function to use JSONB config
DROP FUNCTION IF EXISTS get_requests_due_for_1day_followup();

CREATE OR REPLACE FUNCTION get_requests_due_for_followup_before_deadline()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  approver_email TEXT,
  title TEXT,
  deadline TIMESTAMPTZ,
  requester_email TEXT,
  days_before INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    ar.approver_email,
    ar.title,
    ar.deadline,
    ar.requester_email,
    (ar.follow_up_strategy->>'days_before_deadline')::INTEGER as days_before
  FROM public.approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.follow_up_strategy->>'enabled' = 'true'
    AND ar.follow_up_strategy ? 'days_before_deadline'
    AND ar.deadline IS NOT NULL
    AND ar.deadline - (COALESCE((ar.follow_up_strategy->>'days_before_deadline')::INTEGER, 1) || ' days')::INTERVAL <= NOW()
    AND ar.deadline > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.request_email_events ree
      WHERE ree.request_id = ar.id
        AND ree.event_type = 'followup_before_deadline'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Update 2_days_after function to use JSONB config
DROP FUNCTION IF EXISTS get_requests_due_for_2days_followup();

CREATE OR REPLACE FUNCTION get_requests_due_for_followup_after_sending()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  approver_email TEXT,
  title TEXT,
  sent_at TIMESTAMPTZ,
  requester_email TEXT,
  days_after INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    ar.approver_email,
    ar.title,
    ar.sent_at,
    ar.requester_email,
    (ar.follow_up_strategy->>'days_after_sending')::INTEGER as days_after
  FROM public.approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.follow_up_strategy->>'enabled' = 'true'
    AND ar.follow_up_strategy ? 'days_after_sending'
    AND ar.sent_at IS NOT NULL
    AND ar.sent_at + (COALESCE((ar.follow_up_strategy->>'days_after_sending')::INTEGER, 2) || ' days')::INTERVAL <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.request_email_events ree
      WHERE ree.request_id = ar.id
        AND ree.event_type = 'followup_after_sending'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Done!
