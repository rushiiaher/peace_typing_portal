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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // 1. Fetch exam basic details
        const { data: exam, error: examError } = await admin
            .from('exams')
            .select(`
                *,
                exam_patterns (*),
                courses (*)
            `)
            .eq('id', id)
            .eq('student_id', user.id)
            .single();

        if (examError || !exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

        // 2. Fetch assigned questions for each section
        const { data: assignments, error: assignmentError } = await admin
            .from('exam_question_assignments')
            .select('*')
            .eq('exam_id', id);

        if (assignmentError) throw assignmentError;

        // 3. Fetch full content for each assigned question
        const fullContent: any = {
            mcq: [],
            email: null,
            letter: null,
            statement: null,
            speed: null
        };

        for (const ass of (assignments ?? [])) {
            let table = '';
            switch (ass.question_type) {
                case 'mcq': table = 'mcq_question_bank'; break;
                case 'email': table = 'email_templates'; break;
                case 'letter': table = 'letter_templates'; break;
                case 'statement': table = 'statement_templates'; break;
                case 'speed': table = 'speed_passages'; break;
            }

            if (table) {
                const { data: content } = await admin.from(table).select('*').eq('id', ass.content_id).single();
                if (content) {
                    if (ass.question_type === 'mcq') {
                        fullContent.mcq.push(content);
                    } else {
                        fullContent[ass.question_type] = content;
                    }
                }
            }
        }

        // 4. Fetch exam_answers to determine resume section
        const { data: examAnswers } = await admin
            .from('exam_answers')
            .select('mcq_answers, letter_html, speed_wpm, submitted_at')
            .eq('exam_id', id)
            .maybeSingle();

        // Infer which section to resume based on what's already saved
        let resumeSection = 1;
        if (examAnswers) {
            if (examAnswers.speed_wpm != null) resumeSection = 4;        // all done
            else if (examAnswers.letter_html != null) resumeSection = 3; // section 2 done
            else if (examAnswers.mcq_answers != null) resumeSection = 2; // section 1 done
        }

        return NextResponse.json({ exam, content: fullContent, resumeSection, server_time: new Date().toISOString() });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { status, results } = body;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // Guard: attendance present AND scheduled start time reached (server time)
        if (status === 'in_progress') {
            const { data: currentExam } = await admin
                .from('exams')
                .select('attendance_status, start_time')
                .eq('id', id)
                .eq('student_id', user.id)
                .single();

            if (!currentExam || currentExam.attendance_status !== 'present') {
                return NextResponse.json({
                    error: 'Your attendance has not been marked as Present. Please contact your institute before starting the exam.'
                }, { status: 403 });
            }

            // Independent check — attendance does NOT bypass the schedule
            if (currentExam.start_time && Date.now() < new Date(currentExam.start_time).getTime()) {
                return NextResponse.json({
                    error: 'The exam has not started yet. You can begin at the scheduled start time.'
                }, { status: 403 });
            }
        }

        const { data, error } = await admin
            .from('exams')
            .update({
                status,
                ...(status === 'completed' && {
                    end_time: new Date().toISOString(),
                    result: 'pass',
                    total_marks_obtained: results?.totalMarks || 0
                }),
                // NOTE: start_time is the SCHEDULED time — do NOT overwrite it when going in_progress
            })
            .eq('id', id)
            .eq('student_id', user.id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ exam: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

