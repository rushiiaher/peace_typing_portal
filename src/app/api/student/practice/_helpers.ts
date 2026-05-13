/**
 * Shared helper for student practice API routes.
 *
 * Table: practice_sessions  (migration 008)
 *   practice_type CHECK ('keyboard_lesson','speed_passage','letter_template',
 *                         'statement_template','email_template','mcq')
 *   wpm               INTEGER
 *   accuracy          NUMERIC(5,2)
 *   mistakes          INTEGER
 *   duration_seconds  INTEGER
 *
 * students table has NO course_id column — course comes via batches FK.
 * Uses flat parallel lookups to avoid PostgREST FK ambiguity errors.
 */
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function getStudentInfo() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = getAdmin();

    // Flat lookup — no embedded joins to avoid PostgREST FK ambiguity
    const { data: student, error: stuErr } = await admin
        .from('students')
        .select('id, institute_id, batch_id, is_active')
        .eq('id', user.id)
        .single();

    if (stuErr || !student || !student.is_active) return null;

    let course_id: string | null = null;
    let is_marathi = false;

    if (student.batch_id) {
        const { data: batch } = await admin
            .from('batches')
            .select('course_id')
            .eq('id', student.batch_id)
            .single();

        if (batch?.course_id) {
            course_id = batch.course_id;
            const { data: course } = await admin
                .from('courses')
                .select('name')
                .eq('id', batch.course_id)
                .single();
            is_marathi = course?.name?.toLowerCase().includes('marathi') ?? false;
        }
    }

    return {
        student_id: student.id,
        institute_id: student.institute_id,
        batch_id: student.batch_id ?? null,
        course_id,
        is_marathi,
    };
}

/** Map route names → DB CHECK constraint values in practice_sessions */
export const PRACTICE_TYPE = {
    keyboard: 'keyboard_lesson',
    speed: 'speed_passage',
    letter: 'letter_template',
    statement: 'statement_template',
    email: 'email_template',
    mcq: 'mcq',
} as const;

/** Insert a practice session using the correct table & column names */
export async function insertSession(admin: ReturnType<typeof getAdmin>, payload: {
    student_id: string;
    institute_id: string;
    practice_type: string;
    content_id: string | null;
    wpm?: number;
    accuracy?: number;
    mistakes?: number;
    duration_seconds?: number;
    [key: string]: any;
}) {
    const { wpm, accuracy, mistakes, duration_seconds, ...rest } = payload;
    return admin.from('practice_sessions').insert({
        ...rest,
        wpm: wpm ?? 0,
        accuracy: accuracy ?? 0,
        mistakes: mistakes ?? 0,
        duration_seconds: duration_seconds ?? 0,
        completed_at: new Date().toISOString(),
    }).select().single();
}

/** Normalise practice_sessions rows for frontend consumption */
export function normaliseHistory(rows: any[]) {
    return (rows ?? []).map(h => ({
        content_id: h.content_id,
        wpm: h.wpm ?? 0,
        accuracy: Number(h.accuracy ?? 0),
        score_percent: Number(h.accuracy ?? 0),
        completed_at: h.completed_at,
    }));
}
