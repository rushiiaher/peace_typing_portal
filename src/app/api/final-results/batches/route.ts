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

// GET /api/final-results/batches — batches that have any final_results row
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        // Get all batches (with institute + course) that have at least one final_result
        const { data, error } = await admin
            .from('batches')
            .select('id, batch_name, batch_code, institutes(name), courses(name, code)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const batches = (data ?? []).map((b: any) => ({
            id: b.id,
            batch_name: b.batch_name,
            batch_code: b.batch_code,
            institute_name: b.institutes?.name ?? '—',
            course_name: b.courses?.name ?? '—',
        }));

        return NextResponse.json({ batches });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
