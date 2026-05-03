-- YesDrop Email Tracking Migration
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- 1. Create request_email_events table for tracking opens
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.request_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'open',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups by request
CREATE INDEX IF NOT EXISTS idx_request_email_events_request_id
ON public.request_email_events(request_id, created_at DESC);

-- ============================================================================
-- 2. Enable RLS on request_email_events
-- ============================================================================
ALTER TABLE public.request_email_events ENABLE ROW LEVEL SECURITY;

-- Request owners can view events on their requests
DO $$ BEGIN
  CREATE POLICY "Users can view email events on own requests"
  ON public.request_email_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests
      WHERE id = request_id AND user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anyone can insert events (email clients don't have sessions)
DO $$ BEGIN
  CREATE POLICY "Anyone can insert email events"
  ON public.request_email_events FOR INSERT
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Done!
-- ============================================================================
