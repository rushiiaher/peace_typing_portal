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

        const { data: rawExams, error: examErr } = await admin
            .from('exams')
            .select('id, student_id, course_id, batch_id, exam_date, start_time, status, attendance_status')
            .order('exam_date', { ascending: false })
            .order('start_time', { ascending: true });
        if (examErr) throw examErr;
        if (!rawExams?.length) return NextResponse.json({ exams: [] });

        const studentIds = [...new Set(rawExams.map((e: any) => e.student_id).filter(Boolean))];
        const courseIds  = [...new Set(rawExams.map((e: any) => e.course_id).filter(Boolean))];
        const batchIds   = [...new Set(rawExams.map((e: any) => e.batch_id).filter(Boolean))];

        const [stuRes, crsRes, batRes] = await Promise.all([
            studentIds.length > 0
                ? admin.from('students').select('id, name, enrollment_number').in('id', studentIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length > 0
                ? admin.from('courses').select('id, name').in('id', courseIds)
                : Promise.resolve({ data: [], error: null }),
            batchIds.length > 0
                ? admin.from('batches').select('id, batch_name, institute_id').in('id', batchIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        // Fetch institute names for batches
        const instituteIds = [...new Set((batRes.data ?? []).map((b: any) => b.institute_id).filter(Boolean))];
        const { data: instRows } = instituteIds.length > 0
            ? await admin.from('institutes').select('id, name').in('id', instituteIds)
            : { data: [] };

        const stuMap  = Object.fromEntries((stuRes.data ?? []).map((s: any) => [s.id, s]));
        const crsMap  = Object.fromEntries((crsRes.data ?? []).map((c: any) => [c.id, c]));
        const batMap  = Object.fromEntries((batRes.data ?? []).map((b: any) => [b.id, b]));
        const instMap = Object.fromEntries((instRows ?? []).map((i: any) => [i.id, i]));

        const exams = rawExams.map((e: any) => {
            const bat = batMap[e.batch_id];
            return {
                id: e.id,
                student: stuMap[e.student_id]?.name ?? '—',
                enrollment: stuMap[e.student_id]?.enrollment_number ?? '—',
                institute: bat ? (instMap[bat.institute_id]?.name ?? '—') : '—',
                course: crsMap[e.course_id]?.name ?? '—',
                examDate: e.exam_date ?? '—',
                startTime: e.start_time ?? null,
                status: e.status ?? '—',
                attendance: e.attendance_status ?? '—',
            };
        });

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
