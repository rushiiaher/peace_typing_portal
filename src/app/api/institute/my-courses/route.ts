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

async function getInstituteId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getAdmin();
    const { data } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
    return data?.institute_id ?? null;
}

// GET — all courses allocated to this institute (with super-admin-fixed fees)
export async function GET() {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data, error } = await admin
            .from('institute_courses')
            .select(`
                id, institute_course_fee, is_active, assigned_at,
                courses ( id, name, code, exam_fee, delivery_fee, duration_months, is_active )
            `)
            .eq('institute_id', instituteId)
            .eq('is_active', true);

        if (error) throw error;

        const courses = (data ?? []).map((r: any) => ({
            id: r.id,                          // institute_courses.id
            course_id: r.courses?.id ?? '',
            course_name: r.courses?.name ?? '—',
            course_code: r.courses?.code ?? '',
            duration_months: r.courses?.duration_months ?? 0,
            // Institute sets this:
            institute_course_fee: r.institute_course_fee,
            // Super admin fixed (read-only for institute):
            exam_fee: r.courses?.exam_fee ?? 0,
            delivery_fee: r.courses?.delivery_fee ?? 0,
            // Total a student pays:
            student_total: r.institute_course_fee + (r.courses?.exam_fee ?? 0),
            is_active: r.is_active,
            assigned_at: r.assigned_at,
        }));

        return NextResponse.json({ courses });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH — update institute's custom course fee (only institute_course_fee, not exam_fee/delivery_fee)
export async function PATCH(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, institute_course_fee } = await req.json();
        if (!id || institute_course_fee === undefined)
            return NextResponse.json({ error: 'id and institute_course_fee are required.' }, { status: 400 });

        const admin = getAdmin();

        // Ensure this record belongs to this institute
        const { data: check } = await admin
            .from('institute_courses')
            .select('id')
            .eq('id', id)
            .eq('institute_id', instituteId)
            .single();
        if (!check) return NextResponse.json({ error: 'Not found or access denied.' }, { status: 404 });

        const { data, error } = await admin
            .from('institute_courses')
            .update({ institute_course_fee: Number(institute_course_fee) })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ course: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
