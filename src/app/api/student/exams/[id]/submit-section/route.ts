import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { section, data } = body;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // Ensure the exam_answers row exists
        const { data: existingAnswer, error: checkError } = await admin
            .from('exam_answers')
            .select('*')
            .eq('exam_id', id)
            .single();

        let answerId = existingAnswer?.id;

        if (!existingAnswer && checkError?.code === 'PGRST116') {
            // Create the row
            const { data: newAnswer, error: insertError } = await admin
                .from('exam_answers')
                .insert({
                    exam_id: id,
                    student_id: user.id
                })
                .select()
                .single();
            if (insertError) throw insertError;
            answerId = newAnswer.id;
        } else if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        const updateData: any = {};

        if (section === 1) {
            // MCQ & Email
            const { answers, emailValues } = data; // answers: { [qId]: 'a'|'b'|'c'|'d' }

            // Fetch correct answers for these MCQs
            const qIds = Object.keys(answers || {});
            let correctCount = 0;
            const totalCount = qIds.length;

            if (totalCount > 0) {
                const { data: questions } = await admin
                    .from('mcq_question_bank')
                    .select('id, correct_answer')
                    .in('id', qIds);

                const questionMap = new Map((questions || []).map(q => [q.id, q.correct_answer]));

                for (const [qId, ans] of Object.entries(answers)) {
                    if (questionMap.get(qId) === ans) {
                        correctCount++;
                    }
                }
            }

            const marksObtained = correctCount * 2; // Each MCQ is 2 marks

            updateData.mcq_answers = answers;
            updateData.mcq_correct_count = correctCount;
            updateData.mcq_total_count = totalCount;
            updateData.mcq_marks_obtained = marksObtained;
            updateData.email_content = emailValues;

        } else if (section === 2) {
            // Letter & Statement
            const { letterHtml, statementGrid } = data;
            updateData.letter_html = letterHtml;
            updateData.statement_grid = statementGrid;

        } else if (section === 3) {
            // Speed Passage - Final Submission
            const { wpm, accuracy, mistakes, timeSpent } = data;
            
            // Get course passing criteria
            const { data: examInfo } = await admin
                .from('exams')
                .select('courses(passing_criteria_wpm)')
                .eq('id', id)
                .single();
                
            const requiredWpm = (examInfo?.courses as any)?.passing_criteria_wpm || 30;
            const speedPassed = wpm >= requiredWpm && accuracy >= 80;

            // Fetch current MCQ marks to calculate overall result
            const { data: currentAnswers } = await admin
                .from('exam_answers')
                .select('mcq_marks_obtained')
                .eq('id', answerId)
                .single();

            const mcqMarks = currentAnswers?.mcq_marks_obtained || 0;
            const overallPassed = speedPassed && mcqMarks >= 20;
            const overallResult = overallPassed ? 'pass' : 'fail';

            updateData.speed_wpm = wpm;
            updateData.speed_accuracy = accuracy;
            updateData.speed_mistakes = mistakes;
            updateData.speed_time_spent = timeSpent;
            updateData.speed_required_wpm = requiredWpm;
            updateData.speed_passed = speedPassed;
            
            updateData.overall_result = overallResult;
            updateData.total_marks_obtained = mcqMarks; // Overall marks is just MCQ marks for now
            updateData.result_breakdown = {
                mcqPass: mcqMarks >= 20,
                speedPass: speedPassed,
                reasons: []
            };
            if (mcqMarks < 20) updateData.result_breakdown.reasons.push('MCQ score below 20');
            if (wpm < requiredWpm) updateData.result_breakdown.reasons.push(`WPM below ${requiredWpm}`);
            if (accuracy < 80) updateData.result_breakdown.reasons.push('Accuracy below 80%');

            // Also update the main exams table
            await admin
                .from('exams')
                .update({
                    status: 'completed',
                    end_time: new Date().toISOString(),
                    result: overallResult,
                    total_marks_obtained: mcqMarks
                })
                .eq('id', id);
        }

        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
            if (section === 3) updateData.submitted_at = new Date().toISOString();
            
            const { error: updateError } = await admin
                .from('exam_answers')
                .update(updateData)
                .eq('id', answerId);

            if (updateError) throw updateError;
        }

        // Return updated row
        const { data: finalAnswer } = await admin
            .from('exam_answers')
            .select('*')
            .eq('id', answerId)
            .single();

        return NextResponse.json({ success: true, answer: finalAnswer });
    } catch (err: any) {
        console.error('Submit Section Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
