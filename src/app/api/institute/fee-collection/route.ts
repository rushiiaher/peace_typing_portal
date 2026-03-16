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

async function getInstituteId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getAdmin();
    const { data } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
    return data?.institute_id ?? null;
}

// GET — students in this institute with their fee collection status
export async function GET() {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // Get all students with batch, course, and fee collection info
        const { data: students, error: sErr } = await admin
            .from('students')
            .select(`
                id, enrollment_number, name, email, is_active,
                batch_id,
                batches (
                    id, batch_name, batch_code, course_id,
                    courses ( id, name, code, exam_fee, delivery_fee, base_course_fee )
                ),
                student_fee_collection ( id, course_fee_collected, exam_fee_collected, total_collected, payment_mode, receipt_number, collected_at )
            `)
            .eq('institute_id', instituteId)
            .order('created_at', { ascending: false });

        if (sErr) throw sErr;

        // Get institute's custom fee per course
        const { data: instCourses } = await admin
            .from('institute_courses')
            .select('course_id, institute_course_fee')
            .eq('institute_id', instituteId);

        const feeMap = new Map((instCourses ?? []).map((ic: any) => [ic.course_id, ic.institute_course_fee]));

        const rows = (students ?? []).map((s: any) => {
            const courseId = s.batches?.course_id ?? '';
            const instituteFee = feeMap.get(courseId) ?? s.batches?.courses?.base_course_fee ?? 0;
            const examFee = s.batches?.courses?.exam_fee ?? 0;
            const totalDue = instituteFee + examFee;

            const latestPayment = (s.student_fee_collection ?? []).sort((a: any, b: any) =>
                new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime())[0] ?? null;

            const totalPaid = (s.student_fee_collection ?? []).reduce((sum: number, p: any) => sum + Number(p.total_collected), 0);
            const isPaid = totalPaid >= totalDue && totalDue > 0;

            return {
                id: s.id,
                enrollment_number: s.enrollment_number,
                name: s.name,
                email: s.email,
                is_active: s.is_active,
                batch_id: s.batch_id ?? '',
                batch_name: s.batches?.batch_name ?? '—',
                course_id: courseId,
                course_name: s.batches?.courses?.name ?? '—',
                institute_course_fee: instituteFee,
                exam_fee: examFee,
                total_due: totalDue,
                total_paid: totalPaid,
                balance: totalDue - totalPaid,
                fee_status: isPaid ? 'paid' : totalPaid > 0 ? 'partial' : 'pending',
                latest_receipt: latestPayment?.receipt_number ?? '',
                last_payment_at: latestPayment?.collected_at ?? null,
                payment_count: (s.student_fee_collection ?? []).length,
            };
        });

        return NextResponse.json({ students: rows });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — record fee collection from a student
export async function POST(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { student_id, batch_id, course_fee_collected, exam_fee_collected, payment_mode, receipt_number, notes } = body;

        if (!student_id || course_fee_collected === undefined || exam_fee_collected === undefined)
            return NextResponse.json({ error: 'student_id, course_fee_collected, and exam_fee_collected are required.' }, { status: 400 });

        const admin = getAdmin();

        // Verify student belongs to this institute
        const { data: student } = await admin
            .from('students').select('id').eq('id', student_id).eq('institute_id', instituteId).single();
        if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

        const { data, error } = await admin.from('student_fee_collection').insert({
            student_id,
            institute_id: instituteId,
            batch_id: batch_id || null,
            course_fee_collected: Number(course_fee_collected),
            exam_fee_collected: Number(exam_fee_collected),
            payment_mode: payment_mode || 'cash',
            receipt_number: receipt_number || null,
            notes: notes || null,
        }).select().single();

        if (error) throw error;
        return NextResponse.json({ collection: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
