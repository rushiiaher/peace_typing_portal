import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const admin = getAdmin();
        const { data, error } = await admin
            .from('courses')
            .update({
                language_id: body.language_id,
                name: body.name,
                code: body.code?.toUpperCase(),
                description: body.description || null,
                duration_months: Number(body.duration_months),
                base_course_fee: Number(body.base_course_fee),
                exam_fee: Number(body.exam_fee),
                delivery_fee: Number(body.delivery_fee),
                passing_criteria_wpm: Number(body.passing_criteria_wpm),
                is_active: body.is_active,
            })
            .eq('id', id)
            .select().single();

        if (error) throw error;
        return NextResponse.json({ course: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { error } = await admin.from('courses').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ message: 'Course deleted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
