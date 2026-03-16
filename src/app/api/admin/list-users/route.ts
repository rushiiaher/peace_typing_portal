import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
        }

        // Verify caller is logged in
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── Fetch Institute Admins ──
        // institute_admins table joined with institutes for the institute name
        const { data: adminRows, error: adminErr } = await supabaseAdmin
            .from('institute_admins')
            .select(`
                id,
                name,
                email,
                phone,
                is_active,
                created_at,
                institutes ( id, name )
            `)
            .order('name');

        if (adminErr) {
            console.error('[list-users] institute_admins error:', adminErr.message);
        }

        // ── Fetch Students ──
        // students table joined with institutes and batches
        const { data: studentRows, error: studentErr } = await supabaseAdmin
            .from('students')
            .select(`
                id,
                name,
                email,
                phone,
                enrollment_number,
                is_active,
                created_at,
                institutes ( id, name ),
                batches ( id, batch_name )
            `)
            .order('name');

        if (studentErr) {
            console.error('[list-users] students error:', studentErr.message);
        }

        // ── Normalise to a common shape ──
        const admins = (adminRows ?? []).map((r: any) => ({
            id: r.id,
            full_name: r.name ?? '',
            email: r.email ?? '',
            phone: r.phone ?? '',
            role: 'institute_admin',
            institute_id: r.institutes?.id ?? '',
            institute_name: r.institutes?.name ?? '',
            enrollment_number: '',
            batch_name: '',
            is_active: r.is_active ?? true,
            created_at: r.created_at,
        }));

        const students = (studentRows ?? []).map((r: any) => ({
            id: r.id,
            full_name: r.name ?? '',
            email: r.email ?? '',
            phone: r.phone ?? '',
            role: 'student',
            institute_id: r.institutes?.id ?? '',
            institute_name: r.institutes?.name ?? '',
            enrollment_number: r.enrollment_number ?? '',
            batch_name: r.batches?.batch_name ?? '',
            is_active: r.is_active ?? true,
            created_at: r.created_at,
        }));

        return NextResponse.json({ users: [...admins, ...students] }, { status: 200 });

    } catch (err: any) {
        console.error('[list-users] unexpected error:', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
