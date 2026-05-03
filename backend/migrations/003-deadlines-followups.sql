-- YesDrop Database Migration: Deadlines & Follow-ups
-- Run in Supabase Dashboard → SQL Editor

-- 1. Update status constraint to include 'ignored'
ALTER TABLE public.approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_status_check;

ALTER TABLE public.approval_requests
ADD CONSTRAINT approval_requests_status_check
CHECK (status IN ('draft', 'scheduled', 'pending', 'approved', 'rejected', 'ignored'));

-- 2. Add new columns for deadlines and follow-ups
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS follow_up_strategy TEXT DEFAULT '1_day_before' 
  CHECK (follow_up_strategy IN ('none', '1_day_before', '2_days_after', 'both'));

-- 3. Indexes for deadline queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_deadline
ON public.approval_requests(status, deadline)
WHERE status = 'pending' AND deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_follow_up
ON public.approval_requests(status, sent_at, follow_up_strategy, deadline)
WHERE status = 'pending' AND follow_up_strategy != 'none';

-- 4. Function: Get pending requests past deadline (mark as ignored)
CREATE OR REPLACE FUNCTION get_requests_past_deadline()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  approver_email TEXT,
  title TEXT,
  deadline TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    ar.approver_email,
    ar.title,
    ar.deadline
  FROM public.approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.deadline IS NOT NULL
    AND ar.deadline < NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Function: Get requests due for 1_day_before follow-up
CREATE OR REPLACE FUNCTION get_requests_due_for_1day_followup()
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
    AND ar.follow_up_strategy IN ('1_day_before', 'both')
    AND ar.deadline IS NOT NULL
    AND ar.deadline - INTERVAL '1 day' <= NOW()
    AND ar.deadline > NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.request_email_events ree
      WHERE ree.request_id = ar.id
        AND ree.event_type = 'followup_1day'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Function: Get requests due for 2_days_after follow-up
CREATE OR REPLACE FUNCTION get_requests_due_for_2days_followup()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  approver_email TEXT,
  title TEXT,
  sent_at TIMESTAMPTZ,
  requester_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.user_id,
    ar.approver_email,
    ar.title,
    ar.sent_at,
    ar.requester_email
  FROM public.approval_requests ar
  WHERE ar.status = 'pending'
    AND ar.follow_up_strategy IN ('2_days_after', 'both')
    AND ar.sent_at IS NOT NULL
    AND ar.sent_at + INTERVAL '2 days' <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM public.request_email_events ree
      WHERE ree.request_id = ar.id
        AND ree.event_type = 'followup_2days'
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Update RLS policies for new columns
DROP POLICY IF EXISTS "Users can view own requests" ON public.approval_requests;
CREATE POLICY "Users can view own requests"
ON public.approval_requests FOR SELECT
TO authenticated
USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can update own requests" ON public.approval_requests;
CREATE POLICY "Users can update own requests"
ON public.approval_requests FOR UPDATE
TO authenticated
USING (auth.uid()::uuid = user_id);

-- Done!
