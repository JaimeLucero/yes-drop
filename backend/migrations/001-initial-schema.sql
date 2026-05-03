-- YesDrop Database Migrations
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================================
-- 1. Create approval_requests table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  approver_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  file_url TEXT,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
DO $$ BEGIN
  CREATE POLICY "Users can view own requests"
  ON public.approval_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can create their own requests
DO $$ BEGIN
  CREATE POLICY "Users can create requests"
  ON public.approval_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can update their own requests
DO $$ BEGIN
  CREATE POLICY "Users can update own requests"
  ON public.approval_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can delete their own requests
DO $$ BEGIN
  CREATE POLICY "Users can delete own requests"
  ON public.approval_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_approval_requests_user_id 
ON public.approval_requests(user_id, created_at DESC);

-- ============================================================================
-- 2. Create storage bucket for files
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'approval-files', 
  'approval-files', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Storage RLS Policies
-- ============================================================================
-- Authenticated users can upload files
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'approval-files');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public can view files (for sharing with approvers)
DO $$ BEGIN
  CREATE POLICY "Public can view files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'approval-files');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can delete their own files
DO $$ BEGIN
  CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'approval-files' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can update their own files
DO $$ BEGIN
  CREATE POLICY "Users can update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'approval-files' AND owner = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Create function to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.approval_requests;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Done!
-- ============================================================================
