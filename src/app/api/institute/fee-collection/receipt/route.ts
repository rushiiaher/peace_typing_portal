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

// GET /api/institute/fee-collection/receipt?student_id=uuid
// Returns all info needed to build a receipt for a student
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const studentId = req.nextUrl.searchParams.get('student_id');
        if (!studentId) return NextResponse.json({ error: 'student_id is required' }, { status: 400 });

        const admin = getAdmin();

        // Verify institute admin
        const { data: instAdmin } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get institute details
        const { data: institute } = await admin
            .from('institutes')
            .select('name, address, city, state, phone, email, code')
            .eq('id', instAdmin.institute_id)
            .single();

        // Get student with batch + course
        const { data: student, error: stuErr } = await admin
            .from('students')
            .select(`
                id, name, enrollment_number, created_at,
                batch_id,
                batches (
                    batch_name, batch_code, course_id,
                    courses ( name, code, duration_months, base_course_fee, exam_fee )
                )
            `)
            .eq('id', studentId)
            .eq('institute_id', instAdmin.institute_id)
            .single();

        if (stuErr || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        // Get custom fee
        const courseId = (student as any).batches?.course_id;
        let instituteFee = (student as any).batches?.courses?.base_course_fee ?? 0;
        if (courseId) {
            const { data: ic } = await admin
                .from('institute_courses')
                .select('institute_course_fee')
                .eq('institute_id', instAdmin.institute_id)
                .eq('course_id', courseId)
                .single();
            if (ic) instituteFee = ic.institute_course_fee;
        }

        const examFee = (student as any).batches?.courses?.exam_fee ?? 0;
        const totalFee = instituteFee + examFee;

        // Get all payment history for this student, ordered chronologically
        const { data: payments } = await admin
            .from('student_fee_collection')
            .select('id, course_fee_collected, exam_fee_collected, total_collected, payment_mode, receipt_number, notes, collected_at')
            .eq('student_id', studentId)
            .eq('institute_id', instAdmin.institute_id)
            .order('collected_at', { ascending: true });

        const paymentList = (payments ?? []).map((p: any, i: number) => ({
            id: p.id,
            label: ordinal(i + 1) + ' Installment',
            amount: Number(p.total_collected),
            paymentMode: (p.payment_mode ?? 'cash').toUpperCase(),
            receiptNo: p.receipt_number ?? '',
            date: fmtDate(p.collected_at),
            notes: p.notes ?? '',
        }));

        const totalPaid = paymentList.reduce((s: number, p: any) => s + p.amount, 0);

        const inst = (institute as any) ?? {};
        const course = (student as any).batches?.courses ?? {};
        const batch = (student as any).batches ?? {};

        // Admission month from student created_at
        const createdAt = student.created_at ? new Date(student.created_at) : new Date();
        const admissionMonth = createdAt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

        return NextResponse.json({
            receipt: {
                studentName: (student as any).name ?? '—',
                rollNo: (student as any).enrollment_number ?? '—',
                courseName: course.name ?? '—',
                courseCode: course.code ?? '—',
                batchName: batch.batch_name ?? '—',
                admissionMonth,
                courseDuration: course.duration_months ? `${course.duration_months} Months` : '—',
                totalFee,
                totalPaid,
                balance: totalFee - totalPaid,
                instituteName: inst.name ?? 'PEACEXPERTS ACADEMY, NASHIK',
                instituteAddress: [inst.address, inst.city, inst.state].filter(Boolean).join(', '),
                institutePhone: inst.phone ?? '',
                instituteEmail: inst.email ?? '',
                payments: paymentList,
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function ordinal(n: number) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDate(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
