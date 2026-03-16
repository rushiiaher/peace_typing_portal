-- TEMPORARY FIX: Disable RLS for testing
-- Run this in Supabase SQL Editor to allow inserts without authentication

ALTER TABLE public.institutes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages DISABLE ROW LEVEL SECURITY;

-- Or add a permissive policy for testing:
-- DROP POLICY IF EXISTS "Super admins full access institutes" ON public.institutes;
-- CREATE POLICY "Allow all for testing" ON public.institutes FOR ALL USING (true);
