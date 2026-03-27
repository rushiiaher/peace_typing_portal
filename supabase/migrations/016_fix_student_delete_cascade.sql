-- Migration 016: Fix FK cascade on student deletion
-- All child tables referencing students(id) should CASCADE or SET NULL on delete

-- student_enrollments
ALTER TABLE public.student_enrollments DROP CONSTRAINT IF EXISTS student_enrollments_student_id_fkey;
ALTER TABLE public.student_enrollments
  ADD CONSTRAINT student_enrollments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_fee_transactions
ALTER TABLE public.student_fee_transactions DROP CONSTRAINT IF EXISTS student_fee_transactions_student_id_fkey;
ALTER TABLE public.student_fee_transactions
  ADD CONSTRAINT student_fee_transactions_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- exam_applications
ALTER TABLE public.exam_applications DROP CONSTRAINT IF EXISTS exam_applications_student_id_fkey;
ALTER TABLE public.exam_applications
  ADD CONSTRAINT exam_applications_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- exam_reschedule_requests
ALTER TABLE public.exam_reschedule_requests DROP CONSTRAINT IF EXISTS exam_reschedule_requests_student_id_fkey;
ALTER TABLE public.exam_reschedule_requests
  ADD CONSTRAINT exam_reschedule_requests_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- exams
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_student_id_fkey;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_practice_sessions
ALTER TABLE public.student_practice_sessions DROP CONSTRAINT IF EXISTS student_practice_sessions_student_id_fkey;
ALTER TABLE public.student_practice_sessions
  ADD CONSTRAINT student_practice_sessions_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
