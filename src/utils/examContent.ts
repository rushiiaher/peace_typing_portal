import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Content for an exam section whose assigned content_id is missing/orphaned:
 * the oldest active row of the SAME course (never another course — a Marathi
 * exam must not get English content). Deterministic so the exam page and the
 * submit-section scorer resolve the same row.
 */
export async function courseFallbackContent(admin: SupabaseClient, table: string, courseId: string) {
    const { data } = await admin.from(table).select('*')
        .eq('is_active', true).eq('course_id', courseId)
        .order('created_at', { ascending: true }).limit(1);
    return data?.[0] ?? null;
}
