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

        // 1. Identify institute
        const { data: instAdmin, error: iaErr } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (iaErr || !instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const instituteId = instAdmin.institute_id;

        // 2. Get all batch IDs belonging to this institute
        const { data: batchRows, error: batchErr } = await admin
            .from('batches')
            .select('id')
            .eq('institute_id', instituteId);
        if (batchErr) throw batchErr;

        const batchIds = (batchRows ?? []).map((b: any) => b.id as string);
        if (batchIds.length === 0) return NextResponse.json({ exams: [] });

        // 3. Fetch raw exams — NO embedded joins to avoid PostgREST FK ambiguity
        const { data: rawExams, error: examErr } = await admin
            .from('exams')
            .select('id, student_id, course_id, system_id, exam_date, start_time, end_time, status, result, attendance_status, exam_center_code')
            .in('batch_id', batchIds)
            .order('start_time', { ascending: false, nullsFirst: false });
        if (examErr) throw examErr;
        if (!rawExams || rawExams.length === 0) return NextResponse.json({ exams: [] });

        // 4. Collect unique IDs for batch lookups
        const studentIds  = [...new Set(rawExams.map((e: any) => e.student_id).filter(Boolean))];
        const courseIds   = [...new Set(rawExams.map((e: any) => e.course_id).filter(Boolean))];
        const systemIds   = [...new Set(rawExams.map((e: any) => e.system_id).filter(Boolean))];

        // 5. Parallel lookups
        const [stuRes, crsRes, sysRes] = await Promise.all([
            studentIds.length > 0
                ? admin.from('students').select('id, name, enrollment_number').in('id', studentIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length > 0
                ? admin.from('courses').select('id, name').in('id', courseIds)
                : Promise.resolve({ data: [], error: null }),
            systemIds.length > 0
                ? admin.from('institute_systems').select('id, system_name').in('id', systemIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (stuRes.error) throw stuRes.error;
        if (crsRes.error) throw crsRes.error;
        if (sysRes.error) throw sysRes.error;

        // 6. Build lookup maps
        const stuMap = Object.fromEntries((stuRes.data ?? []).map((s: any) => [s.id, s]));
        const crsMap = Object.fromEntries((crsRes.data ?? []).map((c: any) => [c.id, c]));
        const sysMap = Object.fromEntries((sysRes.data ?? []).map((s: any) => [s.id, s]));

        // 7. Assemble final rows
        const exams = rawExams.map((e: any) => {
            const stu = stuMap[e.student_id];
            const crs = crsMap[e.course_id];
            const sys = sysMap[e.system_id];
            return {
                id: e.id,
                student_name: stu?.name ?? '—',
                enrollment: stu?.enrollment_number ?? '—',
                course_name: crs?.name ?? '—',
                exam_date: e.exam_date,
                start_time: e.start_time,
                status: e.status,
                attendance: e.attendance_status,
                system_name: sys?.system_name ?? '—',
                center_code: e.exam_center_code ?? '—',
            };
        });

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
