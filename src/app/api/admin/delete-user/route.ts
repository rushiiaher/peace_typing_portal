import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
        }

        // Verify caller is logged in
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId } = await request.json();
        if (!userId) {
            return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── Step 1: Delete from institute_admins (custom table) ──
        await supabaseAdmin.from('institute_admins').delete().eq('id', userId);

        // ── Step 2: Delete from students (if somehow a student id is passed) ──
        await supabaseAdmin.from('students').delete().eq('id', userId);

        // ── Step 3: Delete from profiles ──
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        // ── Step 4: Delete from auth.users (this is the critical step) ──
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'User deleted successfully.' }, { status: 200 });

    } catch (err: any) {
        console.error('[delete-user]', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
