import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getInstituteId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = await getAdminClient();
    const { data } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
    return data?.institute_id ?? null;
}

// GET — list batches for this admin's institute
export async function GET() {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getAdminClient();
        const { data, error } = await admin
            .from('batches')
            .select(`
                id, batch_name, batch_code, start_date, end_date, is_active, created_at,
                course_id,
                courses ( id, name, code, duration_months ),
                students ( id )
            `)
            .eq('institute_id', instituteId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const batches = (data ?? []).map((b: any) => ({
            id: b.id,
            batch_name: b.batch_name,
            batch_code: b.batch_code,
            start_date: b.start_date,
            end_date: b.end_date,
            is_active: b.is_active,
            created_at: b.created_at,
            course_id: b.course_id,           // ← exposed for cascade filtering
            course_name: b.courses?.name ?? '—',
            course_code: b.courses?.code ?? '—',
            student_count: Array.isArray(b.students) ? b.students.length : 0,
        }));

        return NextResponse.json({ batches });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — create a new batch
export async function POST(request: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { batch_name, batch_code, course_id, start_date, end_date } = body;
        if (!batch_name || !batch_code || !course_id || !start_date) {
            return NextResponse.json({ error: 'batch_name, batch_code, course_id and start_date are required.' }, { status: 400 });
        }

        const admin = await getAdminClient();
        const { data, error } = await admin.from('batches').insert({
            institute_id: instituteId,
            batch_name,
            batch_code,
            course_id,
            start_date,
            end_date: end_date || null,
            is_active: true,
        }).select().single();

        if (error) throw error;
        return NextResponse.json({ batch: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
