-- Migration 010: Exam Management Refinement
-- 1. Update Institutes for Operational Hours and Center Code
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00';
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '18:00:00';
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS working_days JSONB DEFAULT '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]'::jsonb;
ALTER TABLE public.institutes ADD COLUMN IF NOT EXISTS center_code TEXT;

-- 2. Update Exam Patterns for Section Details and Sequence
ALTER TABLE public.exam_patterns ADD COLUMN IF NOT EXISTS sequence_order INTEGER DEFAULT 1; -- For Exam N requirement
ALTER TABLE public.exam_patterns ADD COLUMN IF NOT EXISTS section_1_duration INTEGER DEFAULT 25;
ALTER TABLE public.exam_patterns ADD COLUMN IF NOT EXISTS section_2_duration INTEGER DEFAULT 25;
-- Section 3 (Speed) duration is dynamic based on WPM/Words

-- 3. Refine Exams Table for Scheduling and Seat Allocation
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS system_id UUID REFERENCES public.institute_systems(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_center_code TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS reporting_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS gate_closing_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS attendance_status TEXT CHECK (attendance_status IN ('pending', 'present', 'absent')) DEFAULT 'pending';

-- 4. Create Exam Questions Sets (Snapshot of questions assigned to an exam)
CREATE TABLE IF NOT EXISTS public.exam_question_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL, -- 'mcq', 'email', 'letter', 'statement', 'speed'
    content_id UUID NOT NULL, -- FK to respective content table
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exam_question_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function to Generate Hall Ticket Number / Roll No
-- (Will implement in application logic for now or as a trigger if needed)
