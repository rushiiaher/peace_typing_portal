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

        // Run all queries in parallel for speed
        const [
            institutesRes,
            studentsRes,
            coursesRes,
            batchesRes,
            paymentsRes,
            supportRes,
            recentInstitutesRes,
            recentPaymentsRes,
            instituteBreakdownRes,
        ] = await Promise.all([
            // Total & active institutes
            admin.from('institutes').select('id, is_active', { count: 'exact' }),

            // Total & active students
            admin.from('students').select('id, is_active', { count: 'exact' }),

            // Total active courses
            admin.from('courses').select('id', { count: 'exact' }).eq('is_active', true),

            // Total batches
            admin.from('batches').select('id', { count: 'exact' }).eq('is_active', true),

            // All payment transactions (verified & unverified)
            admin.from('student_fee_collection')
                .select('amount, is_verified, paid_at')
                .not('paid_at', 'is', null),

            // Open support tickets
            admin.from('support_tickets')
                .select('id', { count: 'exact' })
                .eq('status', 'open'),

            // Recent 5 institutes
            admin.from('institutes')
                .select('id, name, code, city, state, created_at, is_active')
                .order('created_at', { ascending: false })
                .limit(5),

            // Recent 5 payments with institute name
            admin.from('student_fee_collection')
                .select(`
                    id, amount, payment_type, is_verified, paid_at,
                    institutes ( name, code )
                `)
                .not('paid_at', 'is', null)
                .order('paid_at', { ascending: false })
                .limit(5),

            // Institute breakdown: student count + batch count + revenue
            admin.from('institutes')
                .select(`
                    id, name, code,
                    students ( id ),
                    batches ( id ),
                    student_fee_collection ( amount, is_verified )
                `)
                .eq('is_active', true)
                .order('name')
                .limit(20),
        ]);

        // ── Compute Stats ─────────────────────────────────────────────────────
        const institutes = institutesRes.data ?? [];
        const active_institutes = institutes.filter((i: any) => i.is_active).length;
        const total_institutes = institutes.length;

        const students = studentsRes.data ?? [];
        const active_students = students.filter((s: any) => s.is_active).length;
        const total_students = students.length;

        const total_courses = coursesRes.count ?? 0;
        const total_batches = batchesRes.count ?? 0;

        const payments = paymentsRes.data ?? [];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        let total_revenue = 0;
        let total_verified = 0;
        let total_pending = 0;
        let this_month_revenue = 0;
        for (const p of payments) {
            const amt = Number(p.amount ?? 0);
            total_revenue += amt;
            if (p.is_verified) {
                total_verified += amt;
                if (p.paid_at && p.paid_at >= monthStart) this_month_revenue += amt;
            } else {
                total_pending += amt;
            }
        }

        const open_support_tickets = supportRes.count ?? 0;

        // ── Recent institutes ─────────────────────────────────────────────────
        const recent_institutes = (recentInstitutesRes.data ?? []).map((i: any) => ({
            id: i.id,
            name: i.name,
            code: i.code,
            city: i.city ?? '',
            state: i.state ?? '',
            created_at: i.created_at,
            is_active: i.is_active,
        }));

        // ── Recent payments ───────────────────────────────────────────────────
        const recent_payments = (recentPaymentsRes.data ?? []).map((p: any) => ({
            id: p.id,
            institute_name: (p as any).institutes?.name ?? '—',
            institute_code: (p as any).institutes?.code ?? '',
            amount: Number(p.amount ?? 0),
            payment_type: p.payment_type,
            paid_at: p.paid_at,
            is_verified: p.is_verified,
        }));

        // ── Institute breakdown ───────────────────────────────────────────────
        const institute_breakdown = (instituteBreakdownRes.data ?? []).map((i: any) => {
            const revenue = (i.student_fee_collection ?? [])
                .filter((p: any) => p.is_verified)
                .reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
            return {
                id: i.id,
                name: i.name,
                code: i.code,
                student_count: (i.students ?? []).length,
                batch_count: (i.batches ?? []).length,
                revenue,
            };
        });

        return NextResponse.json({
            stats: {
                total_institutes,
                active_institutes,
                total_students,
                active_students,
                total_courses,
                total_batches,
                total_revenue,
                total_verified,
                total_pending,
                this_month_revenue,
                open_support_tickets,
            },
            recent_institutes,
            recent_payments,
            institute_breakdown,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
