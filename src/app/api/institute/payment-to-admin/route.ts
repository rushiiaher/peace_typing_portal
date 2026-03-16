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

async function getAdminData() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getAdmin();
    const { data } = await admin.from('institute_admins').select('institute_id, name, email, phone').eq('id', user.id).single();
    return data;
}

// GET — pending & paid payments to super admin (exam fees + delivery charges)
export async function GET() {
    try {
        const instAdmin = await getAdminData();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const instituteId = instAdmin.institute_id;

        const admin = getAdmin();

        // ── Exam fee payments (per student) ──────────────────────────────────
        // Get students whose exam fee is NOT yet paid to super admin
        // (student is in institute + has batch + no institute_payments exam_fee record for them)

        const { data: students } = await admin
            .from('students')
            .select(`
                id, enrollment_number, name, email, is_active,
                batch_id,
                batches ( id, batch_name, courses ( id, name, exam_fee ) )
            `)
            .eq('institute_id', instituteId)
            .not('batch_id', 'is', null);

        // Get all exam fee payments this institute has already made
        const { data: existingPayments } = await admin
            .from('institute_payments')
            .select('id, student_id, batch_id, payment_type, amount, payment_mode, payment_reference, is_verified, paid_at')
            .eq('institute_id', instituteId);

        const paidStudentIds = new Set(
            (existingPayments ?? [])
                .filter((p: any) => p.payment_type === 'exam_fee')
                .map((p: any) => p.student_id)
        );

        const examFeeRows = (students ?? []).map((s: any) => ({
            id: s.id,
            enrollment_number: s.enrollment_number,
            student_name: s.name,
            email: s.email,
            phone: s.phone,
            batch_name: s.batches?.batch_name ?? '—',
            course_name: s.batches?.courses?.name ?? '—',
            exam_fee: s.batches?.courses?.exam_fee ?? 0,
            is_paid: paidStudentIds.has(s.id),
            student_is_active: s.is_active,
            batch_id: s.batch_id,
        }));

        // ── Delivery charge payments (per batch) ─────────────────────────────
        const { data: batches } = await admin
            .from('batches')
            .select(`
                id, batch_name, batch_code, delivery_fee_paid,
                courses ( id, name, delivery_fee ),
                students ( id )
            `)
            .eq('institute_id', instituteId);

        const paidBatchIds = new Set(
            (existingPayments ?? [])
                .filter((p: any) => p.payment_type === 'delivery_charge')
                .map((p: any) => p.batch_id)
        );

        const deliveryRows = (batches ?? []).map((b: any) => ({
            id: b.id,
            batch_name: b.batch_name,
            batch_code: b.batch_code,
            course_name: b.courses?.name ?? '—',
            delivery_fee: b.courses?.delivery_fee ?? 0,
            student_count: Array.isArray(b.students) ? b.students.length : 0,
            is_paid: paidBatchIds.has(b.id) || b.delivery_fee_paid,
        }));

        // ── Payment history ───────────────────────────────────────────────────
        const { data: history } = await admin
            .from('institute_payments')
            .select(`
                id, payment_type, amount, payment_mode, payment_reference, is_verified, paid_at, notes,
                students ( name, enrollment_number ),
                batches ( batch_name )
            `)
            .eq('institute_id', instituteId)
            .order('paid_at', { ascending: false });

        return NextResponse.json({
            admin_info: {
                name: instAdmin.name,
                email: instAdmin.email,
                phone: instAdmin.phone,
            },
            exam_fees: examFeeRows,
            delivery_charges: deliveryRows,
            history: (history ?? []).map((h: any) => ({
                id: h.id,
                payment_type: h.payment_type,
                amount: h.amount,
                payment_mode: h.payment_mode,
                payment_reference: h.payment_reference,
                is_verified: h.is_verified,
                paid_at: h.paid_at,
                notes: h.notes,
                student_name: h.students?.name ?? null,
                student_enrollment: h.students?.enrollment_number ?? null,
                batch_name: h.batches?.batch_name ?? null,
            })),
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — record a payment to super admin (exam_fee or delivery_charge)
export async function POST(req: NextRequest) {
    try {
        const instAdmin = await getAdminData();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const instituteId = instAdmin.institute_id;

        const body = await req.json();
        const { payment_type, student_id, batch_id, amount, payment_mode, payment_reference, notes } = body;

        if (!payment_type || !amount)
            return NextResponse.json({ error: 'payment_type and amount are required.' }, { status: 400 });
        if (payment_type === 'exam_fee' && !student_id)
            return NextResponse.json({ error: 'student_id is required for exam_fee payment.' }, { status: 400 });
        if (payment_type === 'delivery_charge' && !batch_id)
            return NextResponse.json({ error: 'batch_id is required for delivery_charge payment.' }, { status: 400 });

        const admin = getAdmin();

        // Prevent duplicate exam fee payments for same student
        if (payment_type === 'exam_fee') {
            const { data: dup } = await admin
                .from('institute_payments')
                .select('id')
                .eq('institute_id', instituteId)
                .eq('payment_type', 'exam_fee')
                .eq('student_id', student_id)
                .single();
            if (dup) return NextResponse.json({ error: 'Exam fee already paid for this student.' }, { status: 409 });
        }

        // Record the payment
        const { data: payment, error: payErr } = await admin
            .from('institute_payments')
            .insert({
                institute_id: instituteId,
                payment_type,
                student_id: student_id || null,
                batch_id: batch_id || null,
                amount: Number(amount),
                payment_mode: payment_mode || 'online',
                payment_reference: payment_reference || null,
                notes: notes || null,
                is_verified: false,
            })
            .select()
            .single();

        if (payErr) throw payErr;

        // ── Activate student after exam fee is paid ───────────────────────────
        if (payment_type === 'exam_fee' && student_id) {
            await admin
                .from('students')
                .update({ is_active: true, updated_at: new Date().toISOString() })
                .eq('id', student_id);

            // Also enable their auth account
            await admin.auth.admin.updateUserById(student_id, { ban_duration: 'none' });
        }

        // ── Mark batch delivery fee as paid ──────────────────────────────────
        if (payment_type === 'delivery_charge' && batch_id) {
            await admin
                .from('batches')
                .update({ delivery_fee_paid: true })
                .eq('id', batch_id);
        }

        return NextResponse.json({ payment }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
