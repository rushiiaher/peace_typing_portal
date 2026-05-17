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

        const { data: rawExams, error: examErr } = await admin
            .from('exams')
            .select('id, student_id, course_id, batch_id, system_id, exam_date, start_time, end_time, reporting_time, status, attendance_status, exam_center_code')
            .order('exam_date', { ascending: true })
            .order('start_time', { ascending: true });
        if (examErr) throw examErr;
        if (!rawExams?.length) return NextResponse.json({ exams: [] });

        const studentIds = [...new Set(rawExams.map((e: any) => e.student_id).filter(Boolean))];
        const courseIds  = [...new Set(rawExams.map((e: any) => e.course_id).filter(Boolean))];
        const batchIds   = [...new Set(rawExams.map((e: any) => e.batch_id).filter(Boolean))];
        const systemIds  = [...new Set(rawExams.map((e: any) => e.system_id).filter(Boolean))];

        const [stuRes, crsRes, batRes, sysRes] = await Promise.all([
            studentIds.length > 0
                ? admin.from('students').select('id, name, enrollment_number, photo_url').in('id', studentIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length > 0
                ? admin.from('courses').select('id, name, code').in('id', courseIds)
                : Promise.resolve({ data: [], error: null }),
            batchIds.length > 0
                ? admin.from('batches').select('id, batch_name, batch_code, institute_id').in('id', batchIds)
                : Promise.resolve({ data: [], error: null }),
            systemIds.length > 0
                ? admin.from('institute_systems').select('id, system_name').in('id', systemIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        // Fetch institute names for batches
        const instituteIds = [...new Set((batRes.data ?? []).map((b: any) => b.institute_id).filter(Boolean))];
        const { data: instRows } = instituteIds.length > 0
            ? await admin.from('institutes').select('id, name, code').in('id', instituteIds)
            : { data: [] };

        const stuMap  = Object.fromEntries((stuRes.data ?? []).map((s: any) => [s.id, s]));
        const crsMap  = Object.fromEntries((crsRes.data ?? []).map((c: any) => [c.id, c]));
        const batMap  = Object.fromEntries((batRes.data ?? []).map((b: any) => [b.id, b]));
        const sysMap  = Object.fromEntries((sysRes.data ?? []).map((s: any) => [s.id, s]));
        const instMap = Object.fromEntries((instRows ?? []).map((i: any) => [i.id, i]));

        const exams = rawExams.map((e: any) => {
            const bat = batMap[e.batch_id];
            const inst = bat ? instMap[bat.institute_id] : null;
            return {
                id: e.id,
                student: stuMap[e.student_id]?.name ?? '—',
                enrollment: stuMap[e.student_id]?.enrollment_number ?? '—',
                photoUrl: stuMap[e.student_id]?.photo_url ?? null,
                institute: inst?.name ?? '—',
                instituteCode: inst?.code ?? '',
                instituteId: bat?.institute_id ?? '',
                course: crsMap[e.course_id]?.name ?? '—',
                courseCode: crsMap[e.course_id]?.code ?? '',
                batch: bat?.batch_name ?? '—',
                batchCode: bat?.batch_code ?? '',
                batchId: e.batch_id ?? '',
                systemName: sysMap[e.system_id]?.system_name ?? '—',
                examDate: e.exam_date ?? '—',
                startTime: e.start_time ?? null,
                endTime: e.end_time ?? null,
                reportingTime: e.reporting_time ?? null,
                status: e.status ?? '—',
                attendance: e.attendance_status ?? 'pending',
                centerCode: e.exam_center_code ?? '—',
            };
        });

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── PATCH — Super Admin reschedule (NO 6-day restriction) ─────────────────
// Body: { ids: string[], newExamDate: "YYYY-MM-DD", newStartTime: "HH:mm" }

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { ids, newExamDate, newStartTime } = body;

        if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
        if (!newExamDate || !newStartTime) {
            return NextResponse.json({ error: 'newExamDate and newStartTime are required' }, { status: 400 });
        }

        const admin = getAdmin();

        // Build timestamps — treat input as IST wall-clock
        const startDT = new Date(`${newExamDate}T${newStartTime}:00+05:30`);
        const EXAM_DURATION_MINUTES = 50;
        const endDT = new Date(startDT.getTime() + EXAM_DURATION_MINUTES * 60 * 1000);
        const reportingDT = new Date(startDT.getTime() - 30 * 60 * 1000);
        const gateDT = new Date(startDT.getTime() - 5 * 60 * 1000);

        const { error } = await admin
            .from('exams')
            .update({
                exam_date: newExamDate,
                start_time: startDT.toISOString(),
                end_time: endDT.toISOString(),
                reporting_time: reportingDT.toISOString(),
                gate_closing_time: gateDT.toISOString(),
            })
            .in('id', ids);

        if (error) throw error;
        return NextResponse.json({ success: true, message: `Updated ${ids.length} exam(s) to ${newExamDate} at ${newStartTime}.` });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
