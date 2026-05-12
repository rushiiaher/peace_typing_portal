import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ allowed: false, reason: 'unauthorized' }, { status: 401 });
        }

        if (user.user_metadata?.role !== 'student') {
            return NextResponse.json({ allowed: false, reason: 'not_student' });
        }

        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: studentRow } = await admin
            .from('students')
            .select('id, is_active')
            .eq('id', user.id)
            .single();

        if (!studentRow) {
            return NextResponse.json({ allowed: false, reason: 'not_found' });
        }

        if (!studentRow.is_active) {
            return NextResponse.json({ allowed: false, reason: 'inactive' });
        }

        return NextResponse.json({ allowed: true });
    } catch (err: any) {
        console.error('[student/verify-login]', err);
        return NextResponse.json({ allowed: false, reason: err.message }, { status: 500 });
    }
}
