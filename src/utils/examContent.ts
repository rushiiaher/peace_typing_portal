import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Content for an exam section whose assigned content_id is missing/orphaned:
 * the oldest active row of the SAME course, else of a course in the same
 * LANGUAGE (e.g. English 40 has no statement → English 30's). Never another
 * language — a Marathi exam must not get English content. Deterministic so the
 * exam page and the submit-section scorer resolve the same row.
 */
export async function courseFallbackContent(admin: SupabaseClient, table: string, courseId: string, languageId?: string | null) {
    const pick = async (courseIds: string[]) => {
        if (!courseIds.length) return null;
        const { data } = await admin.from(table).select('*')
            .eq('is_active', true).in('course_id', courseIds)
            .order('created_at', { ascending: true }).limit(1);
        return data?.[0] ?? null;
    };
    const own = await pick([courseId]);
    if (own || !languageId) return own;
    const { data: siblings } = await admin.from('courses').select('id').eq('language_id', languageId).neq('id', courseId);
    return pick((siblings ?? []).map(c => c.id));
}

/** Stable per-exam shuffle key (FNV-1a) so a refresh shows the same questions. */
function hash(s: string) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
}

/**
 * Top up an exam's MCQs from the course question bank when assigned questions
 * are missing (deleted/orphaned, or the bank was short at scheduling time).
 */
export async function topUpMcqs(admin: SupabaseClient, examId: string, courseId: string, have: { id: string }[], want: number) {
    if (have.length >= want) return have;
    const { data: pool } = await admin.from('mcq_question_bank').select('*')
        .eq('course_id', courseId).eq('is_active', true);
    const taken = new Set(have.map(q => q.id));
    const extra = (pool ?? [])
        .filter(q => !taken.has(q.id))
        .sort((a, b) => hash(examId + a.id) - hash(examId + b.id))
        .slice(0, want - have.length);
    return [...have, ...extra];
}
