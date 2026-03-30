-- Migration 017: Seed Fixed Exam Pattern for Each Course
--
-- The exam pattern is fixed system-wide:
--   Section 1 (25 min): 25 MCQs + 1 Email Writing
--   Section 2 (25 min): 1 Letter Writing + 1 Table/Statement
--   Section 3 (dynamic, WPM-based timer): 1 Speed Passage
--
-- This migration ensures every course has exactly one active exam pattern
-- with the correct fixed values. If a course already has a pattern, it is
-- updated to the canonical values; otherwise a new one is inserted.

-- Add a unique constraint so each course has at most one active pattern.
-- (Drop first if re-running to keep idempotent.)
ALTER TABLE public.exam_patterns
    DROP CONSTRAINT IF EXISTS exam_patterns_course_id_unique;

ALTER TABLE public.exam_patterns
    ADD CONSTRAINT exam_patterns_course_id_unique UNIQUE (course_id);

-- Insert or update the fixed pattern for every existing course.
INSERT INTO public.exam_patterns (
    course_id,
    pattern_name,
    mcq_count,
    email_count,
    letter_count,
    statement_count,
    speed_passage_count,
    keyboard_lesson_count,
    section_1_duration,
    section_2_duration,
    -- Section 3 duration is dynamic (words / WPM), so duration_minutes covers only sections 1+2.
    duration_minutes,
    total_marks,
    passing_marks,
    is_active
)
SELECT
    id                       AS course_id,
    'Standard Exam Pattern'  AS pattern_name,
    25                       AS mcq_count,
    1                        AS email_count,
    1                        AS letter_count,
    1                        AS statement_count,
    1                        AS speed_passage_count,
    0                        AS keyboard_lesson_count,
    25                       AS section_1_duration,
    25                       AS section_2_duration,
    50                       AS duration_minutes,   -- 25 + 25 (Section 3 timer is dynamic)
    100                      AS total_marks,
    40                       AS passing_marks,
    true                     AS is_active
FROM public.courses
ON CONFLICT (course_id)
DO UPDATE SET
    pattern_name         = EXCLUDED.pattern_name,
    mcq_count            = EXCLUDED.mcq_count,
    email_count          = EXCLUDED.email_count,
    letter_count         = EXCLUDED.letter_count,
    statement_count      = EXCLUDED.statement_count,
    speed_passage_count  = EXCLUDED.speed_passage_count,
    keyboard_lesson_count= EXCLUDED.keyboard_lesson_count,
    section_1_duration   = EXCLUDED.section_1_duration,
    section_2_duration   = EXCLUDED.section_2_duration,
    duration_minutes     = EXCLUDED.duration_minutes,
    total_marks          = EXCLUDED.total_marks,
    passing_marks        = EXCLUDED.passing_marks,
    is_active            = EXCLUDED.is_active,
    updated_at           = NOW();

-- Deactivate any extra/stale patterns that might exist per course (safety clean-up).
-- Keep only the most recently updated one per course.
UPDATE public.exam_patterns ep
SET is_active = false
WHERE is_active = true
  AND id NOT IN (
      SELECT DISTINCT ON (course_id) id
      FROM public.exam_patterns
      WHERE is_active = true
      ORDER BY course_id, updated_at DESC
  );
