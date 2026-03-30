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

        return NextResponse.json({ exam, content: fullContent });
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

        // Guard: attendance must be marked present before exam can start
        if (status === 'in_progress') {
            const { data: currentExam } = await admin
                .from('exams')
                .select('attendance_status')
                .eq('id', id)
                .eq('student_id', user.id)
                .single();

            if (!currentExam || currentExam.attendance_status !== 'present') {
                return NextResponse.json({
                    error: 'Your attendance has not been marked as Present. Please contact your institute before starting the exam.'
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
                ...(status === 'in_progress' && { start_time: new Date().toISOString() })
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

