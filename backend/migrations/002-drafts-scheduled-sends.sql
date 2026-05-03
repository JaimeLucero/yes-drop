-- YesDrop Database Migration: Drafts & Scheduled Sends
-- Run in Supabase Dashboard → SQL Editor

-- 1. Update status constraint to include draft and scheduled
ALTER TABLE public.approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_status_check;

ALTER TABLE public.approval_requests
ADD CONSTRAINT approval_requests_status_check
CHECK (status IN ('draft', 'scheduled', 'pending', 'approved', 'rejected'));

-- 2. Add new columns for scheduled sending
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approver_email TEXT,
ADD COLUMN IF NOT EXISTS notify_requester BOOLEAN DEFAULT true;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_approval_requests_scheduled
ON public.approval_requests(status, scheduled_send_at)
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_approval_requests_daily_sent
ON public.approval_requests(user_id, created_at DESC, status)
WHERE status IN ('pending', 'approved', 'rejected');

CREATE INDEX IF NOT EXISTS idx_approval_requests_user_status
ON public.approval_requests(user_id, status, created_at DESC);

-- 4. Function: Get daily sent count for a user
CREATE OR REPLACE FUNCTION get_daily_sent_count(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM public.approval_requests
  WHERE user_id = user_uuid
    AND status IN ('pending', 'approved', 'rejected')
    AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
  RETURN count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Function: Find next available day (has < 5 sent requests)
CREATE OR REPLACE FUNCTION get_next_available_day(user_uuid UUID, start_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
DECLARE
  available_date DATE;
  day_count INTEGER;
BEGIN
  available_date := start_date;
  LOOP
    SELECT COUNT(*) INTO day_count
    FROM public.approval_requests
    WHERE user_id = user_uuid
      AND status IN ('pending', 'approved', 'rejected')
      AND DATE(created_at AT TIME ZONE 'UTC') = available_date;
    
    IF day_count < 5 THEN
      RETURN available_date;
    END IF;
    
    available_date := available_date + INTERVAL '1 day';
    
    -- Safety: max 30 days in future
    IF available_date > start_date + INTERVAL '30 day' THEN
      RETURN NULL;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Update RLS policies for new columns
DROP POLICY IF EXISTS "Users can view own requests" ON public.approval_requests;
CREATE POLICY "Users can view own requests"
ON public.approval_requests FOR SELECT
TO authenticated
USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can create requests" ON public.approval_requests;
CREATE POLICY "Users can create requests"
ON public.approval_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can update own requests" ON public.approval_requests;
CREATE POLICY "Users can update own requests"
ON public.approval_requests FOR UPDATE
TO authenticated
USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can delete own requests" ON public.approval_requests;
CREATE POLICY "Users can delete own requests"
ON public.approval_requests FOR DELETE
TO authenticated
USING (auth.uid()::uuid = user_id);

-- Done!
