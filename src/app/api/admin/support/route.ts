import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Super-admin only routes — uses service role to bypass RLS

function getServiceClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// GET — list all tickets with user info
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.user_metadata?.role !== 'super_admin')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const service = getServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    let query = service
        .from('support_tickets')
        .select(`
            *,
            institutes ( name )
        `)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch user emails from auth.users via service role
    const userIds = [...new Set((data ?? []).map((t: any) => t.user_id))];
    const { data: authUsers } = await service.auth.admin.listUsers();
    const userMap: Record<string, string> = {};
    (authUsers?.users ?? []).forEach(u => { userMap[u.id] = u.email ?? ''; });

    const tickets = (data ?? []).map((t: any) => ({
        ...t,
        user_email: userMap[t.user_id] ?? '—',
        institute_name: t.institutes?.name ?? '—',
    }));

    return NextResponse.json({ tickets });
}

// PATCH — update status / add admin reply
export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.user_metadata?.role !== 'super_admin')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { ticket_id, status, admin_reply } = await req.json();
    if (!ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 });

    const service = getServiceClient();
    const updates: any = {};
    if (status) updates.status = status;
    if (admin_reply !== undefined) updates.admin_reply = admin_reply;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await service
        .from('support_tickets')
        .update(updates)
        .eq('id', ticket_id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ticket: data });
}
