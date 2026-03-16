import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function makeAdmin() {
    return createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function getInstituteId(): Promise<{ instituteId: string } | { error: string; status: number }> {
    // Step 1 — get supabase session user
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
        console.error('[systems] No user session:', userErr?.message);
        return { error: 'Not authenticated. Please log in again.', status: 401 };
    }

    // Step 2 — look up institute_admins
    const admin = makeAdmin();
    const { data, error: dbErr } = await admin
        .from('institute_admins')
        .select('institute_id')
        .eq('id', user.id)
        .single();

    if (dbErr || !data?.institute_id) {
        console.error('[systems] institute_admins lookup failed for user', user.id, ':', dbErr?.message);
        return { error: 'Access denied: not an institute admin.', status: 403 };
    }

    return { instituteId: data.institute_id };
}

// GET — list all systems for this institute
export async function GET() {
    try {
        const result = await getInstituteId();
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
        const { instituteId } = result;

        const { data, error } = await makeAdmin()
            .from('institute_systems')
            .select('id, system_name, created_at')
            .eq('institute_id', instituteId)
            .order('created_at');

        if (error) throw error;
        return NextResponse.json({ systems: data ?? [] });
    } catch (err: any) {
        console.error('[systems GET]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — add a system { system_name }
export async function POST(req: NextRequest) {
    try {
        const result = await getInstituteId();
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
        const { instituteId } = result;

        const { system_name } = await req.json();
        if (!system_name?.trim())
            return NextResponse.json({ error: 'system_name is required.' }, { status: 400 });

        const { data, error } = await makeAdmin()
            .from('institute_systems')
            .insert({ institute_id: instituteId, system_name: system_name.trim() })
            .select()
            .single();

        if (error) {
            if (error.code === '23505')
                return NextResponse.json({ error: `"${system_name.trim()}" already exists.` }, { status: 409 });
            throw error;
        }
        return NextResponse.json({ system: data }, { status: 201 });
    } catch (err: any) {
        console.error('[systems POST]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — remove a system ?id=
export async function DELETE(req: NextRequest) {
    try {
        const result = await getInstituteId();
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
        const { instituteId } = result;

        const id = req.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

        const { error } = await makeAdmin()
            .from('institute_systems')
            .delete()
            .eq('id', id)
            .eq('institute_id', instituteId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[systems DELETE]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
