import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ lessons: [] });

        const admin = getAdmin();

        const { data: lessons, error } = await admin
            .from('keyboard_lessons')
            .select('id, lesson_number, title, content_text, difficulty_level, target_keys, is_active')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('lesson_number', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.keyboard)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);

        const bestByLesson: Record<string, { wpm: number; accuracy: number }> = {};
        for (const h of history) {
            if (!bestByLesson[h.content_id] || h.wpm > bestByLesson[h.content_id].wpm)
                bestByLesson[h.content_id] = { wpm: h.wpm, accuracy: h.accuracy };
        }

        const result = (lessons ?? []).map((l: any) => ({
            ...l,
            best_wpm: bestByLesson[l.id]?.wpm ?? null,
            best_accuracy: bestByLesson[l.id]?.accuracy ?? null,
            attempted: !!bestByLesson[l.id],
        }));

        return NextResponse.json({ lessons: result, is_marathi: student.is_marathi });
    } catch (err: any) {
        console.error('[keyboard GET]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { lesson_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        if (!lesson_id) return NextResponse.json({ error: 'lesson_id is required.' }, { status: 400 });

        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.keyboard,
            content_id: lesson_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        console.error('[keyboard POST]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

