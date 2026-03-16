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

// Maps tab index → table name
const TABLE_MAP: Record<string, string> = {
    keyboard_lessons: 'keyboard_lessons',
    speed_passages: 'speed_passages',
    letter_templates: 'letter_templates',
    statement_templates: 'statement_templates',
    email_templates: 'email_templates',
    mcq_question_bank: 'mcq_question_bank',
};

// GET /api/admin/content?type=keyboard_lessons&course_id=uuid
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type') ?? 'keyboard_lessons';
        const courseId = req.nextUrl.searchParams.get('course_id') ?? '';
        const table = TABLE_MAP[type];
        if (!table) return NextResponse.json({ error: 'Invalid content type.' }, { status: 400 });

        const admin = getAdmin();
        let query = admin
            .from(table)
            .select('*, courses(name, code)')
            .order('created_at', { ascending: false });

        // Filter by course if provided
        if (courseId) {
            query = query.eq('course_id', courseId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const rows = (data ?? []).map((r: any) => ({
            ...r,
            course_name: r.courses?.name ?? '—',
            course_code: r.courses?.code ?? '',
            courses: undefined,
            // normalise title for MCQ (which uses 'question' not 'title')
            title: r.title ?? r.question ?? '(no title)',
        }));

        return NextResponse.json({ items: rows });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/admin/content?type=keyboard_lessons
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type') ?? '';
        const table = TABLE_MAP[type];
        if (!table) return NextResponse.json({ error: 'Invalid content type.' }, { status: 400 });

        const body = await req.json();
        if (!body.course_id) return NextResponse.json({ error: 'course_id is required.' }, { status: 400 });

        const admin = getAdmin();

        // Build the insert payload based on type
        let payload: Record<string, any> = { course_id: body.course_id, is_active: true };

        switch (type) {
            case 'keyboard_lessons':
                if (!body.title || !body.content_text || !body.lesson_number)
                    return NextResponse.json({ error: 'lesson_number, title and content_text are required.' }, { status: 400 });
                payload = { ...payload, lesson_number: Number(body.lesson_number), title: body.title, description: body.description || null, content_text: body.content_text, difficulty_level: body.difficulty_level || null, target_keys: body.target_keys ? body.target_keys.split(',').map((k: string) => k.trim()) : null };
                break;
            case 'speed_passages':
                if (!body.title || !body.passage_text)
                    return NextResponse.json({ error: 'title and passage_text are required.' }, { status: 400 });
                const wordCount = body.word_count ? Number(body.word_count) : body.passage_text.trim().split(/\s+/).length;
                payload = { ...payload, title: body.title, passage_text: body.passage_text, word_count: wordCount, difficulty_level: body.difficulty_level || null };
                break;
            case 'letter_templates':
                if (!body.title || !body.template_content)
                    return NextResponse.json({ error: 'title and template_content are required.' }, { status: 400 });
                payload = { ...payload, category: body.category || null, title: body.title, template_content: body.template_content, sample_content: body.sample_content || null };
                break;
            case 'statement_templates':
                if (!body.title || !body.template_content)
                    return NextResponse.json({ error: 'title and template_content are required.' }, { status: 400 });
                payload = { ...payload, title: body.title, template_content: body.template_content, sample_content: body.sample_content || null };
                break;
            case 'email_templates':
                if (!body.title || !body.template_content)
                    return NextResponse.json({ error: 'title and template_content are required.' }, { status: 400 });
                payload = { ...payload, category: body.category || null, title: body.title, template_content: body.template_content, sample_content: body.sample_content || null };
                break;
            case 'mcq_question_bank':
                if (!body.question || !body.option_a || !body.option_b || !body.option_c || !body.option_d || !body.correct_answer)
                    return NextResponse.json({ error: 'question, all options and correct_answer are required.' }, { status: 400 });
                payload = { ...payload, question: body.question, option_a: body.option_a, option_b: body.option_b, option_c: body.option_c, option_d: body.option_d, correct_answer: body.correct_answer, explanation: body.explanation || null };
                break;
        }

        const { data, error } = await admin.from(table).insert(payload).select().single();
        if (error) throw error;
        return NextResponse.json({ item: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH /api/admin/content?type=keyboard_lessons&id=uuid
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type') ?? '';
        const id = req.nextUrl.searchParams.get('id') ?? '';
        const table = TABLE_MAP[type];
        if (!table || !id) return NextResponse.json({ error: 'type and id are required.' }, { status: 400 });

        const body = await req.json();
        const admin = getAdmin();

        let patch: Record<string, any> = {
            course_id: body.course_id,
            is_active: body.is_active ?? true,
        };

        switch (type) {
            case 'keyboard_lessons':
                Object.assign(patch, { lesson_number: Number(body.lesson_number), title: body.title, content_text: body.content_text, difficulty_level: body.difficulty_level || null, target_keys: body.target_keys ? body.target_keys.split(',').map((k: string) => k.trim()) : null });
                break;
            case 'speed_passages':
                const wc = body.word_count ? Number(body.word_count) : (body.passage_text ?? '').trim().split(/\s+/).length;
                Object.assign(patch, { title: body.title, passage_text: body.passage_text, word_count: wc, difficulty_level: body.difficulty_level || null });
                break;
            case 'letter_templates':
            case 'statement_templates':
                Object.assign(patch, { title: body.title, category: body.category || null, template_content: body.template_content, sample_content: body.sample_content || null });
                break;
            case 'email_templates':
                Object.assign(patch, { title: body.title, category: body.category || null, template_content: body.template_content, sample_content: body.sample_content || null });
                break;
            case 'mcq_question_bank':
                Object.assign(patch, { question: body.question, option_a: body.option_a, option_b: body.option_b, option_c: body.option_c, option_d: body.option_d, correct_answer: body.correct_answer, explanation: body.explanation || null });
                break;
        }

        const { data, error } = await admin.from(table).update(patch).eq('id', id).select().single();
        if (error) throw error;
        return NextResponse.json({ item: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/admin/content?type=keyboard_lessons&id=uuid
export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type') ?? '';
        const id = req.nextUrl.searchParams.get('id') ?? '';
        const table = TABLE_MAP[type];
        if (!table || !id) return NextResponse.json({ error: 'type and id are required.' }, { status: 400 });

        const admin = getAdmin();
        const { error } = await admin.from(table).delete().eq('id', id);
        if (error) throw error;
        return NextResponse.json({ message: 'Deleted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
