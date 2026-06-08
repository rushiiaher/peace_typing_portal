-- Migration 019: Exam Answers Table
-- Stores every student's responses for each exam section.
-- MCQs are auto-graded server-side. Writing sections saved for record.

CREATE TABLE IF NOT EXISTS public.exam_answers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id              UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,

    -- Section 1: MCQ
    mcq_answers          JSONB,          -- { "question_uuid": "a"|"b"|"c"|"d", ... }
    mcq_correct_count    INTEGER,        -- how many correct (server-computed)
    mcq_total_count      INTEGER,        -- total MCQs attempted
    mcq_marks_obtained   INTEGER,        -- correct_count × 2
    mcq_total_marks      INTEGER DEFAULT 50, -- 25 questions × 2

    -- Section 1: Email
    email_content        JSONB,          -- { to, subject, cc, body }

    -- Section 2: Letter
    letter_html          TEXT,           -- innerHTML from contentEditable editor

    -- Section 2: Statement
    statement_grid       JSONB,          -- 2-D array of cell strings

    -- Section 3: Speed
    speed_wpm            INTEGER,
    speed_accuracy       DECIMAL(5,2),
    speed_time_spent     INTEGER,        -- seconds
    speed_mistakes       INTEGER,
    speed_required_wpm   INTEGER,        -- course passing_criteria_wpm at time of exam
    speed_passed         BOOLEAN,        -- wpm >= required AND accuracy >= 80

    -- Overall
    overall_result       TEXT CHECK (overall_result IN ('pass', 'fail')),
    result_breakdown     JSONB,          -- { mcqPass, speedPass, reasons: [] }

    submitted_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (exam_id)  -- one row per exam
);

-- Ensure exams table has batch_id for grouping results
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id);

-- Enable RLS
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- Students can insert/view their own answers
CREATE POLICY "Students manage own exam answers"
    ON public.exam_answers FOR ALL
    USING (student_id = auth.uid());

-- Institute admins can view answers for their institute's students
CREATE POLICY "Institute admins view exam answers"
    ON public.exam_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.institute_admins ia
            JOIN public.students s ON s.institute_id = ia.institute_id
            WHERE ia.id = auth.uid() AND s.id = exam_answers.student_id
        )
    );

-- Super admins full access
CREATE POLICY "Super admins manage exam answers"
    ON public.exam_answers FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_exam_answers_exam_id ON public.exam_answers(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_student_id ON public.exam_answers(student_id);
