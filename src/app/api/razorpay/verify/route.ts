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

export async function POST(req: NextRequest) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            payment_type,
            student_id,
            batch_id,
            amount,
            notes
        } = await req.json();

        // 1. Verify Signature
        const signatureData = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(signatureData)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
        }

        // 2. Auth Check
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // 3. Get Institute ID
        const { data: instAdmin } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
        if (!instAdmin) return NextResponse.json({ error: 'Institute not found' }, { status: 403 });

        const instituteId = instAdmin.institute_id;

        // 4. Record Payment
        const { data: payment, error: payErr } = await admin
            .from('institute_payments')
            .insert({
                institute_id: instituteId,
                payment_type,
                student_id: student_id || null,
                batch_id: batch_id || null,
                amount: Number(amount),
                payment_mode: 'razorpay',
                payment_reference: razorpay_payment_id,
                razorpay_order_id: razorpay_order_id,
                razorpay_signature: razorpay_signature,
                notes: notes || `Razorpay Order: ${razorpay_order_id}`,
                is_verified: true, // Auto-verified for online payments
                paid_at: new Date().toISOString()
            })
            .select()
            .single();

        if (payErr) throw payErr;

        // 5. Apply Status Updates
        if (payment_type === 'exam_fee' && student_id) {
            await admin
                .from('students')
                .update({ is_active: true, updated_at: new Date().toISOString() })
                .eq('id', student_id);

            // Enable auth account
            await admin.auth.admin.updateUserById(student_id, { ban_duration: 'none' });
        }

        if (payment_type === 'delivery_charge' && batch_id) {
            await admin
                .from('batches')
                .update({ delivery_fee_paid: true })
                .eq('id', batch_id);
        }

        return NextResponse.json({ success: true, payment });
    } catch (err: any) {
        console.error('Razorpay Verification Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
