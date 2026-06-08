import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data: studentRow } = await admin
            .from('students')
            .select('id, is_active')
            .eq('id', user.id)
            .single();
        if (!studentRow || !studentRow.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: exams, error } = await admin
            .from('exams')
            .select(`
                id, exam_date, start_time, status, result, attendance_status, total_marks_obtained,
                courses ( name, passing_criteria_wpm ),
                exam_patterns ( pattern_name, sequence_order, section_1_duration, section_2_duration ),
                exam_answers ( mcq_marks_obtained, speed_wpm, speed_accuracy, speed_passed, overall_result, result_breakdown )
            `)
            .eq('student_id', user.id)
            .order('exam_date', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
