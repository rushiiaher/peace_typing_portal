import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in .env.local' }, { status: 500 });
        }

        // Verify caller is logged in
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { full_name, email, password, phone, institute_id } = body;

        if (!email || !password || !full_name || !institute_id) {
            return NextResponse.json({ error: 'full_name, email, password, and institute_id are required.' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── Step 1: Create auth user with role in metadata ──
        // The DB trigger (handle_new_user) will auto-insert into profiles table
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name,
                role: 'institute_admin',   // ← trigger reads this to set profiles.role
                phone: phone || null,
            },
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const newUserId = authData.user.id;

        // ── Step 2: Insert into institute_admins table ──
        const { error: adminError } = await supabaseAdmin
            .from('institute_admins')
            .insert({
                id: newUserId,
                institute_id,
                name: full_name,
                email,
                phone: phone || null,
                is_active: true,
            });

        if (adminError) {
            // Roll back auth user to avoid orphans
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            return NextResponse.json({ error: `institute_admins insert failed: ${adminError.message}` }, { status: 500 });
        }

        // ── Step 3: Also update profiles.institute_id if profiles row exists ──
        // (the trigger creates the row, we just set the extra fields)
        await supabaseAdmin
            .from('profiles')
            .update({ institute_id, phone: phone || null })
            .eq('id', newUserId);
        // Non-fatal — profiles may not have institute_id column depending on migration state

        return NextResponse.json({ userId: newUserId, message: 'Institute Admin created successfully.' }, { status: 201 });

    } catch (err: any) {
        console.error('[create-user]', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
