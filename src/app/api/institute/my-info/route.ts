import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
        }

        // Get the logged-in user
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Fetch admin record with institute joined
        const { data: adminRecord, error: adminErr } = await supabaseAdmin
            .from('institute_admins')
            .select(`
                id,
                name,
                email,
                phone,
                is_active,
                created_at,
                institutes (
                    id,
                    name,
                    code,
                    address,
                    city,
                    state,
                    pincode,
                    contact_person,
                    phone,
                    email,
                    is_active,
                    created_at
                )
            `)
            .eq('id', user.id)
            .single();

        if (adminErr || !adminRecord) {
            return NextResponse.json({ error: 'Institute Admin record not found.' }, { status: 404 });
        }

        // Fetch quick stats for the institute
        const instituteId = (adminRecord.institutes as any)?.id;
        let stats = { studentCount: 0, batchCount: 0, activeBatchCount: 0 };

        if (instituteId) {
            const [{ count: studentCount }, { count: batchCount }, { count: activeBatchCount }] = await Promise.all([
                supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId),
                supabaseAdmin.from('batches').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId),
                supabaseAdmin.from('batches').select('*', { count: 'exact', head: true }).eq('institute_id', instituteId).eq('is_active', true),
            ]);
            stats = {
                studentCount: studentCount ?? 0,
                batchCount: batchCount ?? 0,
                activeBatchCount: activeBatchCount ?? 0,
            };
        }

        return NextResponse.json({ admin: adminRecord, stats }, { status: 200 });

    } catch (err: any) {
        console.error('[my-info]', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
