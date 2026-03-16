import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ passages: [] });

        const admin = getAdmin();
        const { data: passages, error } = await admin
            .from('speed_passages')
            .select('id, title, difficulty_level, passage_text, word_count, is_active, created_at')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.speed)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);
        const best: Record<string, { accuracy: number; wpm: number }> = {};
        for (const h of history) {
            if (!best[h.content_id] || h.wpm > best[h.content_id].wpm)
                best[h.content_id] = { accuracy: h.accuracy, wpm: h.wpm };
        }

        const result = (passages ?? []).map((p: any) => ({
            ...p,
            best_accuracy: best[p.id]?.accuracy ?? null,
            best_wpm: best[p.id]?.wpm ?? null,
            attempted: !!best[p.id],
        }));

        return NextResponse.json({ passages: result, is_marathi: student.is_marathi });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { passage_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.speed,
            content_id: passage_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

