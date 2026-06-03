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

        // 1. Fetch all students in this batch for this institute.
        //    Use neq(is_active, false) instead of eq(is_active, true) so that
        //    students with is_active = NULL are included (NULL != false in SQL).
        const { data: students, error: stuErr } = await admin
            .from('students')
            .select('id, name, enrollment_number, batch_id, photo_url')
            .eq('institute_id', instituteId)
            .eq('batch_id', batchId)
            .neq('is_active', false);

        if (stuErr) throw stuErr;

        const studentIds = (students ?? []).map((s: any) => s.id);
        const idParam = studentIds.length > 0 ? studentIds : ['00000000-0000-0000-0000-000000000000'];

        // 2. Already scheduled/in-progress for this course
        const { data: existingExams } = await admin
            .from('exams')
            .select('student_id, status')
            .eq('course_id', courseId)
            .in('status', ['scheduled', 'in_progress'])
            .in('student_id', idParam);

        const alreadyScheduledIds = new Set((existingExams ?? []).map((e: any) => e.student_id));

        // 3. Fee status — check BOTH sources:
        //    a) student_enrollments.exam_fee_status (enrollment-time flag)
        //    b) student_fee_collection.exam_fee_collected (student paid institute)
        //    c) institute_payments (payment_type='exam_fee') (institute paid super admin)
        //    A student is exam-fee-paid if ANY source confirms it.

        const [enrollmentRes, collectionRes, courseRes, instPayRes] = await Promise.all([
            admin
                .from('student_enrollments')
                .select('student_id, exam_fee_status')
                .eq('course_id', courseId)
                .in('student_id', idParam),
            admin
                .from('student_fee_collection')
                .select('student_id, exam_fee_collected')
                .in('student_id', idParam),
            admin
                .from('courses')
                .select('exam_fee')
                .eq('id', courseId)
                .single(),
            // Check institute_payments: institute paid super admin exam fee per student
            admin
                .from('institute_payments')
                .select('student_id')
                .eq('payment_type', 'exam_fee')
                .in('student_id', idParam),
        ]);

        // Build enrollment status map
        const enrollmentMap: Record<string, string> = {};
        (enrollmentRes.data ?? []).forEach((r: any) => {
            enrollmentMap[r.student_id] = r.exam_fee_status;
        });

        // Sum exam_fee_collected per student across all payment records
        const collectedMap: Record<string, number> = {};
        (collectionRes.data ?? []).forEach((r: any) => {
            collectedMap[r.student_id] = (collectedMap[r.student_id] ?? 0) + Number(r.exam_fee_collected ?? 0);
        });

        // Set of students whose exam fee has been paid to super admin by institute
        const instPaidIds = new Set<string>(
            (instPayRes.data ?? []).map((r: any) => r.student_id).filter(Boolean)
        );

        // If course exam_fee is 0, all students are fee-eligible regardless
        const courseExamFee = Number((courseRes.data as any)?.exam_fee ?? 1);

        const isExamFeePaid = (id: string): boolean => {
            if (courseExamFee === 0) return true;                    // free exam
            if (enrollmentMap[id] === 'paid') return true;           // enrollment flag
            if ((collectedMap[id] ?? 0) > 0) return true;           // student paid institute
            if (instPaidIds.has(id)) return true;                    // institute paid super admin
            return false;
        };

        const eligibleStudents = (students ?? []).map((s: any) => {
            const feePaid = isExamFeePaid(s.id);
            const alreadyScheduled = alreadyScheduledIds.has(s.id);
            return {
                ...s,
                has_photo: !!s.photo_url,
                exam_fee_paid: feePaid,
                already_scheduled: alreadyScheduled,
                is_eligible: feePaid && !alreadyScheduled,
            };
        });

        return NextResponse.json({
            students: eligibleStudents,
            total_in_batch: students?.length ?? 0,
            eligible_count: eligibleStudents.filter((s: any) => s.is_eligible).length,
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
