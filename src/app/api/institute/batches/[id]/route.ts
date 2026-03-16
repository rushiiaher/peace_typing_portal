import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// PATCH — update a batch
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { batch_name, batch_code, course_id, start_date, end_date, is_active } = body;

        const admin = await getAdminClient();
        const { data, error } = await admin
            .from('batches')
            .update({ batch_name, batch_code, course_id, start_date, end_date: end_date || null, is_active })
            .eq('id', id)
            .select().single();

        if (error) throw error;
        return NextResponse.json({ batch: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — delete a batch
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getAdminClient();
        const { error } = await admin.from('batches').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ message: 'Batch deleted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
