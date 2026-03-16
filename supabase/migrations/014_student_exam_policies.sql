-- Migration 014: Student Exam Policies
-- Allow students to read their own exams
CREATE POLICY "Students can read own exams" ON public.exams
    FOR SELECT USING (auth.uid() = student_id);

-- Allow students to update their own exam status and results
CREATE POLICY "Students can update own exam status" ON public.exams
    FOR UPDATE USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Allow students to read their own exam applications
CREATE POLICY "Students can read own exam applications" ON public.exam_applications
    FOR SELECT USING (auth.uid() = student_id);

-- Allow students to read content assignments for their exams
CREATE POLICY "Students can read own exam assignments" ON public.exam_question_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.exams 
            WHERE exams.id = exam_question_assignments.exam_id 
            AND exams.student_id = auth.uid()
        )
    );
