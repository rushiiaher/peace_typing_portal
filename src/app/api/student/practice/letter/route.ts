import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ templates: [] });

        const admin = getAdmin();
        const { data: templates, error } = await admin
            .from('letter_templates')
            .select('id, title, category, template_content, sample_content, is_active, created_at')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.letter)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);
        const best: Record<string, { accuracy: number; wpm: number }> = {};
        for (const h of history) {
            if (!best[h.content_id] || h.accuracy > best[h.content_id].accuracy)
                best[h.content_id] = { accuracy: h.accuracy, wpm: h.wpm };
        }

        const result = (templates ?? []).map((t: any) => ({
            ...t,
            best_accuracy: best[t.id]?.accuracy ?? null,
            best_wpm: best[t.id]?.wpm ?? null,
            attempted: !!best[t.id],
        }));

        return NextResponse.json({ templates: result, is_marathi: student.is_marathi });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { template_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        if (!template_id) return NextResponse.json({ error: 'template_id is required.' }, { status: 400 });

        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.letter,
            content_id: template_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

