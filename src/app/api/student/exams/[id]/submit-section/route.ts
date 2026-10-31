import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { isExamExpired, EXPIRED_MESSAGE } from '@/utils/examWindow';
import { courseFallbackContent } from '@/utils/examContent';
import { computeWordStats } from '@/utils/typingStats';

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

        // Guard: the exam must belong to this student and still be within its
        // scheduled day. Without this, submitting bypassed every start check.
        const { data: examRow } = await admin
            .from('exams')
            .select('id, exam_date, start_time, end_time, status, course_id')
            .eq('id', id)
            .eq('student_id', user.id)
            .single();

        if (!examRow) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        // Finalised exams can't be re-submitted (would overwrite the result).
        if (examRow.status === 'completed') {
            return NextResponse.json({ error: 'Exam already submitted.' }, { status: 409 });
        }
        if (isExamExpired(examRow)) {
            return NextResponse.json({ error: EXPIRED_MESSAGE }, { status: 403 });
        }

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

        // Enforce section order: each section once, and only after the previous one.
        const done = {
            1: existingAnswer?.mcq_answers != null,
            2: existingAnswer?.letter_html != null,
            3: existingAnswer?.speed_wpm != null,
        } as Record<number, boolean>;
        if (![1, 2, 3].includes(section)) return NextResponse.json({ error: 'Invalid section.' }, { status: 400 });
        if (done[section]) return NextResponse.json({ error: `Section ${section} already submitted.` }, { status: 409 });
        if (section > 1 && !done[section - 1]) {
            return NextResponse.json({ error: `Submit Section ${section - 1} first.` }, { status: 400 });
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
            // Score is recomputed HERE from the typed text — client-sent
            // wpm/accuracy are ignored (they were trivially forgeable).
            const { typedText, timeSpent: rawTime } = data ?? {};

            // Guard: refuse to finalise the exam without the typed text.
            // (Prevents silently failing students when the payload is malformed.)
            if (typeof typedText !== 'string' || typedText.length > 50000) {
                return NextResponse.json({
                    error: 'Speed section text missing. Exam NOT finalised — please submit again.'
                }, { status: 400 });
            }

            const { data: examInfo } = await admin
                .from('exams')
                .select('courses(passing_criteria_wpm, name, language_id, languages(name))')
                .eq('id', id)
                .single();
            const course = (examInfo as { courses?: { name?: string; language_id?: string; languages?: { name?: string } | null } | null } | null)?.courses;
            const marathi = /marathi/i.test(`${course?.languages?.name ?? ''} ${course?.name ?? ''}`);

            // Same passage resolution as GET /api/student/exams/[id]
            const { data: speedAss } = await admin
                .from('exam_question_assignments')
                .select('content_id')
                .eq('exam_id', id)
                .eq('question_type', 'speed')
                .limit(1);
            let passage: { passage_text?: string } | null = null;
            if (speedAss?.[0]) {
                ({ data: passage } = await admin.from('speed_passages').select('passage_text').eq('id', speedAss[0].content_id).maybeSingle());
            }
            if (!passage) passage = await courseFallbackContent(admin, 'speed_passages', examRow.course_id, course?.language_id);
            if (!passage?.passage_text) {
                return NextResponse.json({ error: 'No speed passage configured for this course. Exam NOT finalised.' }, { status: 400 });
            }

            // ponytail: time is still client-reported (clamped to the 8-min section); record a server start time if WPM forging matters.
            const timeSpent = Math.min(480, Math.max(1, Math.round(Number(rawTime) || 0)));
            const { typedWordCount, accuracy, mistakes } = computeWordStats(typedText, passage.passage_text, { final: true, marathi });
            const wpm = Math.round(typedWordCount / (timeSpent / 60));

            // Pass floor lowered to 20 WPM (business decision: students were
            // not reaching the 30 WPM course criteria). The student's actual
            // typed WPM is still stored below for records.
            const EXAM_PASS_WPM = 20;
            const requiredWpm = EXAM_PASS_WPM;
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
            updateData.speed_mistakes = mistakes ?? 0;
            updateData.speed_time_spent = timeSpent ?? 0;
            updateData.speed_required_wpm = requiredWpm;
            updateData.speed_passed = speedPassed;

            updateData.overall_result = overallResult;
            // NOTE: total_marks_obtained lives on the exams table only —
            // writing it here crashed the whole update (column doesn't exist
            // on exam_answers) and silently lost every student's speed data.
            updateData.result_breakdown = {
                mcqPass: mcqMarks >= 20,
                speedPass: speedPassed,
                reasons: [] as string[]
            };
            if (mcqMarks < 20) updateData.result_breakdown.reasons.push('MCQ score below 20');
            if (wpm < requiredWpm) updateData.result_breakdown.reasons.push(`WPM below ${requiredWpm}`);
            if (accuracy < 80) updateData.result_breakdown.reasons.push('Accuracy below 80%');

            // Save answers FIRST — only mark the exam completed once the
            // section data is safely persisted.
            updateData.updated_at = new Date().toISOString();
            updateData.submitted_at = new Date().toISOString();
            const { error: answersErr } = await admin
                .from('exam_answers')
                .update(updateData)
                .eq('id', answerId);
            if (answersErr) throw answersErr;

            const { error: examErr } = await admin
                .from('exams')
                .update({
                    status: 'completed',
                    end_time: new Date().toISOString(),
                    result: overallResult,
                    total_marks_obtained: mcqMarks
                })
                .eq('id', id);
            if (examErr) throw examErr;

            // Answers already written for section 3 — skip the generic update below
            const { data: finalAnswer3 } = await admin
                .from('exam_answers')
                .select('*')
                .eq('id', answerId)
                .single();
            return NextResponse.json({ success: true, answer: finalAnswer3 });
        }

        if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();

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
