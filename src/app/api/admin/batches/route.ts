import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = req.nextUrl;
        const institute_id = searchParams.get('institute_id');
        const course_id = searchParams.get('course_id');

        const admin = getAdmin();
        let query = admin
            .from('batches')
            .select('id, batch_name, batch_code, start_date, end_date, course_id, institute_id')
            .order('batch_name');

        if (institute_id) query = query.eq('institute_id', institute_id);
        if (course_id) query = query.eq('course_id', course_id);

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ batches: data ?? [] });
    } catch (err: any) {
        console.error('[admin/batches GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
