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

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data: instAdmin } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const instituteId = instAdmin.institute_id;

        // Step 1: Get all student IDs in this institute
        const { data: instituteStudents } = await admin
            .from('students')
            .select('id')
            .eq('institute_id', instituteId)
            .eq('is_active', true);

        const studentIds = (instituteStudents ?? []).map(s => s.id);
        if (studentIds.length === 0) {
            return NextResponse.json({ exams: [] });
        }

        // Step 2: Fetch exams for these students
        const { data, error } = await admin
            .from('exams')
            .select(`
                id, exam_date, start_time, end_time, status, result, attendance_status,
                system_id, exam_center_code,
                students ( name, enrollment_number ),
                courses ( name ),
                exam_patterns:exam_pattern_id ( pattern_name ),
                institute_systems:system_id ( system_name, system_number )
            `)
            .in('student_id', studentIds)
            .order('start_time', { ascending: false, nullsFirst: false });

        if (error) throw error;

        const exams = (data ?? []).map((e: any) => ({
            id: e.id,
            student_name: e.students?.name ?? '—',
            enrollment: e.students?.enrollment_number ?? '—',
            course_name: e.courses?.name ?? '—',
            pattern_name: e.exam_patterns?.pattern_name ?? '—',
            exam_date: e.exam_date,
            start_time: e.start_time,
            status: e.status,
            attendance: e.attendance_status,
            system_name: e.institute_systems?.system_name || (e.institute_systems?.system_number ? `PC-${e.institute_systems.system_number}` : '—'),
            center_code: e.exam_center_code ?? '—',
        }));

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH - update attendance or status
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { id, attendance_status, status, result } = body;

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const admin = getAdmin();
        const { data, error } = await admin
            .from('exams')
            .update({
                ...(attendance_status && { attendance_status }),
                ...(status && { status }),
                ...(result && { result }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ exam: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
