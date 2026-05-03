-- YesDrop Feedback Table Migration
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- 1. Create request_feedback table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.request_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  approver_email TEXT NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups by request
CREATE INDEX IF NOT EXISTS idx_request_feedback_request_id
ON public.request_feedback(request_id);

-- Create index for faster lookups by approver
CREATE INDEX IF NOT EXISTS idx_request_feedback_approver_email
ON public.request_feedback(approver_email);

-- ============================================================================
-- 2. Enable RLS on request_feedback
-- ============================================================================
ALTER TABLE public.request_feedback ENABLE ROW LEVEL SECURITY;

-- Request creators can view feedback on their requests
DO $$ BEGIN
  CREATE POLICY "Users can view feedback on own requests"
  ON public.request_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE id = request_id AND user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anyone can insert feedback (approvers don't have user accounts, use email)
DO $$ BEGIN
  CREATE POLICY "Anyone can create feedback"
  ON public.request_feedback FOR INSERT
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3. Add requester_email, feedback, and scheduled_send_at columns to approval_requests
-- ============================================================================
ALTER TABLE public.approval_requests
ADD COLUMN IF NOT EXISTS requester_email TEXT,
ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notify_requester BOOLEAN DEFAULT true;

-- Update status constraint to include new statuses
ALTER TABLE public.approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_status_check;

ALTER TABLE public.approval_requests
ADD CONSTRAINT approval_requests_status_check
CHECK (status IN ('draft', 'scheduled', 'pending', 'approved', 'rejected'));

-- ============================================================================
-- Done!
-- ============================================================================
