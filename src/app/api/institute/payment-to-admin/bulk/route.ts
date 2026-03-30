import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
    const { data } = await admin
        .from('institute_admins')
        .select('institute_id, name, email, phone')
        .eq('id', user.id)
        .single();
    return data;
}

// POST — bulk exam fee payment for multiple students
// Body: { student_ids: string[], amount_per_student: Record<string, number>, payment_mode, payment_reference, notes }
export async function POST(req: NextRequest) {
    try {
        const instAdmin = await getAdminData();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const instituteId = instAdmin.institute_id;

        const body = await req.json();
        const {
            student_ids,
            amount_per_student,
            payment_mode,
            payment_reference,
            notes,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
        } = body;

        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return NextResponse.json({ error: 'student_ids array is required and must not be empty.' }, { status: 400 });
        }
        if (!amount_per_student || typeof amount_per_student !== 'object') {
            return NextResponse.json({ error: 'amount_per_student map is required.' }, { status: 400 });
        }

        const admin = getAdmin();

        // 0. If this is a Razorpay payment, verify the signature before doing anything
        if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
            const signatureData = `${razorpay_order_id}|${razorpay_payment_id}`;
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
                .update(signatureData)
                .digest('hex');
            if (expectedSignature !== razorpay_signature) {
                return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
            }
        }

        // 1. Verify all students belong to this institute (security check)
        const { data: students, error: stuErr } = await admin
            .from('students')
            .select('id, name, is_active')
            .eq('institute_id', instituteId)
            .in('id', student_ids);

        if (stuErr) throw stuErr;

        const foundIds = new Set((students ?? []).map((s: any) => s.id));
        const unauthorized = student_ids.filter((id: string) => !foundIds.has(id));
        if (unauthorized.length > 0) {
            return NextResponse.json({
                error: `Some student IDs do not belong to your institute: ${unauthorized.join(', ')}`
            }, { status: 403 });
        }

        // 2. Check for duplicate exam fee payments
        const { data: existing } = await admin
            .from('institute_payments')
            .select('student_id')
            .eq('institute_id', instituteId)
            .eq('payment_type', 'exam_fee')
            .in('student_id', student_ids);

        const alreadyPaid = new Set((existing ?? []).map((p: any) => p.student_id));
        const duplicates = student_ids.filter((id: string) => alreadyPaid.has(id));
        if (duplicates.length > 0) {
            const dupNames = (students ?? [])
                .filter((s: any) => duplicates.includes(s.id))
                .map((s: any) => s.name)
                .join(', ');
            return NextResponse.json({
                error: `Exam fee already paid for: ${dupNames}`
            }, { status: 409 });
        }

        // 3. Build insert rows
        const now = new Date().toISOString();
        const insertRows = student_ids.map((sid: string) => ({
            institute_id: instituteId,
            payment_type: 'exam_fee',
            student_id: sid,
            batch_id: null,
            amount: Number(amount_per_student[sid] ?? 0),
            payment_mode: payment_mode || 'online',
            payment_reference: payment_reference || null,
            razorpay_order_id: razorpay_order_id || null,
            razorpay_signature: razorpay_signature || null,
            notes: notes || null,
            // Auto-verified for Razorpay payments; false for cash/manual
            is_verified: !!razorpay_payment_id,
            paid_at: now,
        }));

        const { data: payments, error: insErr } = await admin
            .from('institute_payments')
            .insert(insertRows)
            .select();

        if (insErr) throw insErr;

        // 4. Activate all students (update DB + unban auth accounts)
        await admin
            .from('students')
            .update({ is_active: true, updated_at: now })
            .in('id', student_ids);

        // Unban auth accounts in parallel
        await Promise.all(
            student_ids.map((sid: string) =>
                admin.auth.admin.updateUserById(sid, { ban_duration: 'none' })
            )
        );

        return NextResponse.json({
            success: true,
            processed: student_ids.length,
            payments,
        }, { status: 201 });

    } catch (err: any) {
        console.error('Bulk payment error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
