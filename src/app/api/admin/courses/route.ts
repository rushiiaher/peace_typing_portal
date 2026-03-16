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

async function requireSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
}

// GET — list all courses with language name
export async function GET() {
    try {
        const user = await requireSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data, error } = await admin
            .from('courses')
            .select('*, languages(name, code)')
            .order('name');

        if (error) throw error;

        const courses = (data ?? []).map((c: any) => ({
            ...c,
            language_name: c.languages?.name ?? '—',
            language_code: c.languages?.code ?? '',
            languages: undefined,
        }));

        return NextResponse.json({ courses });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — create a new course
export async function POST(req: NextRequest) {
    try {
        const user = await requireSuperAdmin();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const {
            language_id, name, code, description,
            duration_months, base_course_fee, exam_fee, delivery_fee,
            passing_criteria_wpm, is_active,
        } = body;

        if (!language_id || !name || !code || !duration_months || !base_course_fee || !exam_fee || !delivery_fee || !passing_criteria_wpm) {
            return NextResponse.json({ error: 'All required fields must be filled.' }, { status: 400 });
        }

        const admin = getAdmin();
        const { data, error } = await admin.from('courses').insert({
            language_id, name, code: code.toUpperCase(), description: description || null,
            duration_months: Number(duration_months),
            base_course_fee: Number(base_course_fee),
            exam_fee: Number(exam_fee),
            delivery_fee: Number(delivery_fee),
            passing_criteria_wpm: Number(passing_criteria_wpm),
            is_active: is_active ?? true,
        }).select().single();

        if (error) throw error;
        return NextResponse.json({ course: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
