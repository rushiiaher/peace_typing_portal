import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET  — list this user's tickets
// POST — create a new ticket
export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tickets: data });
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.user_metadata?.role;
    if (!['institute_admin', 'student'].includes(role)) {
        return NextResponse.json({ error: 'Only institute admins and students can raise tickets.' }, { status: 403 });
    }

    const body = await req.json();
    const { subject, description, category, priority, institute_id } = body;

    if (!subject?.trim() || !description?.trim() || !category) {
        return NextResponse.json({ error: 'Subject, description and category are required.' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            user_id: user.id,
            user_role: role,
            institute_id: institute_id ?? null,
            subject: subject.trim(),
            description: description.trim(),
            category,
            priority: priority ?? 'medium',
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ticket: data }, { status: 201 });
}
