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

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const batchId = searchParams.get('batchId');
        const courseId = searchParams.get('courseId');

        if (!batchId || !courseId) {
            return NextResponse.json({ error: 'batchId and courseId are required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data: instAdmin } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const instituteId = instAdmin.institute_id;

        // 1. Get all students in this batch belonging to this institute
        const { data: students, error: stuErr } = await admin
            .from('students')
            .select('id, name, enrollment_number, batch_id, photo_url')
            .eq('institute_id', instituteId)
            .eq('batch_id', batchId)
            .eq('is_active', true);

        if (stuErr) throw stuErr;

        // 2. Check which students already have a SCHEDULED/IN_PROGRESS exam for this course
        const studentIds = (students ?? []).map(s => s.id);
        const { data: existingExams } = await admin
            .from('exams')
            .select('student_id, status')
            .eq('course_id', courseId)
            .in('status', ['scheduled', 'in_progress'])
            .in('student_id', studentIds.length > 0 ? studentIds : ['00000000-0000-0000-0000-000000000000']);

        const alreadyScheduledIds = new Set((existingExams ?? []).map(e => e.student_id));

        // 3. Get student enrollments to check exam_fee
        const { data: enrollments } = await admin
            .from('student_enrollments')
            .select('student_id, exam_fee_status')
            .eq('course_id', courseId)
            .in('student_id', studentIds.length > 0 ? studentIds : ['00000000-0000-0000-0000-000000000000']);

        const feeMap: Record<string, string> = {};
        (enrollments ?? []).forEach((e: any) => { feeMap[e.student_id] = e.exam_fee_status; });

        const eligibleStudents = (students ?? []).map(s => ({
            ...s,
            has_photo: !!s.photo_url,
            exam_fee_paid: feeMap[s.id] === 'paid',
            already_scheduled: alreadyScheduledIds.has(s.id),
            // For now all active students in the batch are eligible (remove fee check if not collected)
            is_eligible: !alreadyScheduledIds.has(s.id),
        }));

        return NextResponse.json({
            students: eligibleStudents,
            total_in_batch: students?.length ?? 0,
            eligible_count: eligibleStudents.filter(s => s.is_eligible).length
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
