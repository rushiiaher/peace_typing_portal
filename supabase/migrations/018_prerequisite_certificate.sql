-- Migration 018: Add prerequisite certificate fields to students table
-- Required for students enrolling in courses with passing_criteria_wpm >= 40

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS prerequisite_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS prerequisite_cert_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Comment for documentation
COMMENT ON COLUMN public.students.prerequisite_cert_url IS
  'URL of the uploaded prerequisite certificate (required for courses with passing_criteria_wpm >= 40)';

COMMENT ON COLUMN public.students.prerequisite_cert_uploaded_at IS
  'Timestamp when the prerequisite certificate was uploaded';
