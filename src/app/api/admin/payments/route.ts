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

// GET /api/admin/payments
// Returns all institute_payments with joined institute, student, batch, course info
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // ── All payments ─────────────────────────────────────────────────────
        const { data: payments, error: payErr } = await admin
            .from('institute_payments')
            .select(`
                id, payment_type, amount, payment_mode, payment_reference,
                is_verified, paid_at, notes, created_at,
                institute_id,
                student_id,
                batch_id,
                institutes ( id, name, code ),
                students ( id, name, enrollment_number, batch_id, batches ( id, batch_name, batch_code, course_id, courses ( id, name ) ) ),
                batches ( id, batch_name, batch_code, course_id, courses ( id, name ) )
            `)
            .order('paid_at', { ascending: false });

        if (payErr) throw payErr;

        const rows = (payments ?? []).map((p: any) => {
            // For delivery_charge: course comes from the payment's batch
            // For exam_fee: batch_id may be null on payment, so fall back to student's batch
            const paymentBatch = p.batches;
            const studentBatch = p.students?.batches;
            const resolvedBatch = paymentBatch ?? studentBatch;

            return {
                id: p.id,
                payment_type: p.payment_type,
                amount: p.amount,
                payment_mode: p.payment_mode,
                payment_reference: p.payment_reference,
                is_verified: p.is_verified,
                paid_at: p.paid_at,
                notes: p.notes,
                created_at: p.created_at,
                // institute
                institute_id: p.institute_id,
                institute_name: p.institutes?.name ?? '—',
                institute_code: p.institutes?.code ?? '',
                // student (exam_fee payments)
                student_id: p.student_id,
                student_name: p.students?.name ?? null,
                student_enrollment: p.students?.enrollment_number ?? null,
                // batch
                batch_id: p.batch_id ?? p.students?.batch_id ?? null,
                batch_name: resolvedBatch?.batch_name ?? null,
                batch_code: resolvedBatch?.batch_code ?? null,
                // course (resolved from batch or student's batch)
                course_id: resolvedBatch?.course_id ?? null,
                course_name: resolvedBatch?.courses?.name ?? null,
            };
        });

        // ── Summary stats ────────────────────────────────────────────────────
        const totalReceived = rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
        const totalVerified = rows.filter((r: any) => r.is_verified).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
        const totalPending = rows.filter((r: any) => !r.is_verified).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
        const thisMonth = rows
            .filter((r: any) => {
                const d = new Date(r.paid_at ?? r.created_at ?? '');
                const now = new Date();
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            })
            .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

        // ── Filter options ────────────────────────────────────────────────────
        const { data: institutes } = await admin.from('institutes').select('id, name, code').order('name');
        const { data: courses } = await admin.from('courses').select('id, name').order('name');
        const { data: batches } = await admin.from('batches').select('id, batch_name, batch_code').order('batch_name');

        return NextResponse.json({
            payments: rows,
            stats: { totalReceived, totalVerified, totalPending, thisMonth },
            filters: {
                institutes: institutes ?? [],
                courses: courses ?? [],
                batches: batches ?? [],
            },
        });
    } catch (err: any) {
        console.error('[admin/payments]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH /api/admin/payments?id=uuid  — toggle is_verified
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const id = req.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const body = await req.json();
        const admin = getAdmin();

        const { data, error } = await admin
            .from('institute_payments')
            .update({ is_verified: body.is_verified })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ payment: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
