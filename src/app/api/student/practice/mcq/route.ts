import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession } from '../_helpers';

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ sets: [], questions: [] });

        const admin = getAdmin();
        const { data: questions, error } = await admin
            .from('mcq_question_bank')
            .select('*')
            .eq('course_id', student.course_id)
            .eq('is_active', true);
        if (error) throw error;

        const sets = [{
            id: 'general',
            title: 'GENERAL PRACTICE',
            category: null,
            question_count: questions?.length ?? 0,
        }];

        const { data: history } = await admin
            .from('practice_sessions')
            .select('content_id, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.mcq)
            .order('completed_at', { ascending: false });

        const best: Record<string, number> = {};
        for (const h of (history ?? [])) {
            const score = Number(h.accuracy ?? 0);
            if (h.content_id && (!best[h.content_id] || score > best[h.content_id]))
                best[h.content_id] = score;
        }

        const result = sets.map(s => ({
            ...s,
            best_score: best[s.id] ?? null,
            attempted: !!best[s.id],
        }));

        return NextResponse.json({ sets: result, questions: questions ?? [], is_marathi: student.is_marathi });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { set_id, score_percent } = await req.json();
        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.mcq,
            content_id: set_id,
            accuracy: score_percent,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

