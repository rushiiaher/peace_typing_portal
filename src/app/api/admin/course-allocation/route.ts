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

async function assertSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return user;
}

// ─── GET /api/admin/course-allocation ─────────────────────────────────────────
// ?institute_id=  → filter by institute
export async function GET(req: NextRequest) {
    try {
        const user = await assertSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const institute_id = req.nextUrl.searchParams.get('institute_id');
        const admin = getAdmin();

        let q = admin
            .from('institute_courses')
            .select(`
                id, institute_course_fee, is_active, assigned_at,
                institutes ( id, name, code, city ),
                courses   ( id, name, code, base_course_fee, exam_fee )
            `)
            .order('assigned_at', { ascending: false });

        if (institute_id) q = q.eq('institute_id', institute_id);

        const { data, error } = await q;
        if (error) throw error;

        const rows = (data ?? []).map((r: any) => ({
            id: r.id,
            institute_id: r.institutes?.id ?? '',
            institute_name: r.institutes?.name ?? '—',
            institute_code: r.institutes?.code ?? '',
            institute_city: r.institutes?.city ?? '',
            course_id: r.courses?.id ?? '',
            course_name: r.courses?.name ?? '—',
            course_code: r.courses?.code ?? '',
            base_fee: r.courses?.base_course_fee ?? 0,
            exam_fee: r.courses?.exam_fee ?? 0,
            institute_course_fee: r.institute_course_fee,
            is_active: r.is_active,
            assigned_at: r.assigned_at,
        }));

        return NextResponse.json({ allocations: rows });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── POST /api/admin/course-allocation ────────────────────────────────────────
// Body: { institute_id, course_id }
export async function POST(req: NextRequest) {
    try {
        const user = await assertSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { institute_id, course_id } = await req.json();
        if (!institute_id || !course_id)
            return NextResponse.json({ error: 'institute_id and course_id are required.' }, { status: 400 });

        const admin = getAdmin();

        // Check not already assigned
        const { data: existing } = await admin
            .from('institute_courses')
            .select('id')
            .eq('institute_id', institute_id)
            .eq('course_id', course_id)
            .single();

        if (existing)
            return NextResponse.json({ error: 'This course is already assigned to that institute.' }, { status: 409 });

        // Auto-fetch the course fee — no need for the caller to supply it
        const { data: course, error: cErr } = await admin
            .from('courses')
            .select('base_course_fee')
            .eq('id', course_id)
            .single();
        if (cErr || !course)
            return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

        const { data, error } = await admin
            .from('institute_courses')
            .insert({
                institute_id,
                course_id,
                institute_course_fee: course.base_course_fee,
                is_active: true,
            })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ allocation: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── PATCH /api/admin/course-allocation?id= ───────────────────────────────────
// Body: { is_active }  — fee is derived from the course, not editable here
export async function PATCH(req: NextRequest) {
    try {
        const user = await assertSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const id = req.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

        const body = await req.json();
        const patch: any = {};
        if (body.is_active !== undefined) patch.is_active = body.is_active;

        const admin = getAdmin();
        const { data, error } = await admin
            .from('institute_courses')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ allocation: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── DELETE /api/admin/course-allocation?id= ──────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const user = await assertSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const id = req.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });

        const admin = getAdmin();
        const { error } = await admin.from('institute_courses').delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ message: 'Course unallocated.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
