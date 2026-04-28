import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function PATCH(request: NextRequest) {
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

        const body = await request.json();
        const { userId, full_name, phone, institute_id, password } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ── Step 1: Fetch existing user to preserve user_metadata fields (e.g. role) ──
        // updateUserById REPLACES user_metadata entirely, so we must merge existing fields.
        const { data: existingUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (getUserError) {
            return NextResponse.json({ error: getUserError.message }, { status: 400 });
        }
        const existingMeta = existingUserData.user.user_metadata ?? {};

        // ── Step 2: Update auth user (email stays the same; optionally update password & metadata) ──
        // Spread existing metadata first so that role, and any other fields, are preserved.
        const authUpdatePayload: Record<string, any> = {
            user_metadata: { ...existingMeta, full_name, phone: phone || null },
        };
        if (password && password.length >= 8) {
            authUpdatePayload.password = password;
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            authUpdatePayload
        );

        if (authUpdateError) {
            return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
        }

        // ── Step 3: Update institute_admins table ──
        const updatePayload: Record<string, any> = {
            name: full_name,
            phone: phone || null,
        };
        if (institute_id) updatePayload.institute_id = institute_id;

        const { error: tableError } = await supabaseAdmin
            .from('institute_admins')
            .update(updatePayload)
            .eq('id', userId);

        if (tableError) {
            return NextResponse.json({ error: tableError.message }, { status: 500 });
        }

        // ── Step 3: Update profiles table if it exists ──
        await supabaseAdmin
            .from('profiles')
            .update({ full_name, phone: phone || null, institute_id: institute_id || null })
            .eq('id', userId);
        // Non-fatal

        return NextResponse.json({ message: 'User updated successfully.' }, { status: 200 });

    } catch (err: any) {
        console.error('[update-user]', err);
        return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 });
    }
}
