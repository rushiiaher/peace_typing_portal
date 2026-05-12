import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Resolve institute for this admin
        const { data: instAdmin } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only return courses allocated to this institute by super admin
        const { data, error } = await admin
            .from('institute_courses')
            .select('courses ( id, name, code, duration_months, passing_criteria_wpm )')
            .eq('institute_id', instAdmin.institute_id)
            .eq('is_active', true);

        if (error) throw error;

        const courses = (data ?? [])
            .map((r: any) => r.courses)
            .filter(Boolean);

        return NextResponse.json({ courses });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
