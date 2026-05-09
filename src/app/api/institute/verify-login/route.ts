import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ allowed: false, reason: 'Unauthorized' }, { status: 401 });
        }

        // Primary check: user_metadata.role
        if (user.user_metadata?.role === 'institute_admin') {
            return NextResponse.json({ allowed: true });
        }

        // Fallback: check institute_admins table (catches accounts created before metadata was set)
        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: adminRow } = await admin
            .from('institute_admins')
            .select('id, is_active')
            .eq('id', user.id)
            .single();

        if (!adminRow) {
            return NextResponse.json({ allowed: false, reason: 'not_institute_admin' });
        }

        if (!adminRow.is_active) {
            return NextResponse.json({ allowed: false, reason: 'account_inactive' });
        }

        // Self-heal: patch user_metadata so future logins pass the primary check
        const existingMeta = user.user_metadata ?? {};
        await admin.auth.admin.updateUserById(user.id, {
            user_metadata: { ...existingMeta, role: 'institute_admin' },
        });

        return NextResponse.json({ allowed: true });
    } catch (err: any) {
        console.error('[verify-login]', err);
        return NextResponse.json({ allowed: false, reason: err.message }, { status: 500 });
    }
}
