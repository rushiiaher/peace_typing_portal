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

/**
 * GET /api/final-results
 * Query params:
 *   batch_id  — filter by batch (required for inventory use)
 *   institute_id — filter by institute
 *   result    — 'pass' | 'fail'
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = req.nextUrl;
        const batch_id = searchParams.get('batch_id');
        const institute_id = searchParams.get('institute_id');
        const result_filter = searchParams.get('result');

        const admin = getAdmin();

        let query = admin
            .from('final_results')
            .select(`
                *,
                students (
                    id, name, email, enrollment_number, phone,
                    mother_name, aadhar_card_no, photo_url, date_of_birth, gender
                ),
                batches ( id, batch_name, batch_code ),
                courses ( id, name, code ),
                institutes ( id, name, code )
            `)
            .order('created_at', { ascending: false });

        if (batch_id) query = query.eq('batch_id', batch_id);
        if (institute_id) query = query.eq('institute_id', institute_id);
        if (result_filter) query = query.eq('result', result_filter);

        const { data, error } = await query;
        if (error) throw error;

        // Flatten for frontend convenience
        const rows = (data ?? []).map((r: any) => ({
            id: r.id,
            student_id: r.student_id,
            student_name: r.students?.name ?? '—',
            email: r.students?.email ?? '',
            enrollment_number: r.students?.enrollment_number ?? '',
            roll_no: r.roll_no ?? '',
            mother_name: r.students?.mother_name ?? '',
            aadhar_card_no: r.students?.aadhar_card_no ?? '',
            photo_url: r.students?.photo_url ?? null,
            batch_id: r.batch_id,
            batch_name: r.batches?.batch_name ?? '—',
            batch_code: r.batches?.batch_code ?? '',
            course_name: r.courses?.name ?? '—',
            course_code: r.courses?.code ?? '',
            institute_name: r.institutes?.name ?? '—',
            wpm_obtained: r.wpm_obtained,
            accuracy_percentage: r.accuracy_percentage,
            result: r.result,
            exam_date: r.exam_date,
            certificate_generated: r.certificate_generated,
            certificate_dispatched: r.certificate_dispatched,
            dispatched_at: r.dispatched_at,
            dispatch_remarks: r.dispatch_remarks,
        }));

        return NextResponse.json({ results: rows, total: rows.length });
    } catch (err: any) {
        console.error('[final-results GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * GET /api/final-results/batches  — list batches that have final results
 * handled separately; here we also expose a batches helper
 */

/**
 * PATCH /api/final-results
 * Body: { ids: string[], certificate_dispatched: boolean, dispatch_remarks?: string }
 * Marks one or more results as dispatched
 */
export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { ids, certificate_dispatched, dispatch_remarks } = body;
        if (!ids || !Array.isArray(ids) || ids.length === 0)
            return NextResponse.json({ error: 'ids array is required.' }, { status: 400 });

        const admin = getAdmin();
        const patch: any = { certificate_dispatched: !!certificate_dispatched };
        if (certificate_dispatched) patch.dispatched_at = new Date().toISOString();
        if (dispatch_remarks !== undefined) patch.dispatch_remarks = dispatch_remarks;

        const { error } = await admin.from('final_results').update(patch).in('id', ids);
        if (error) throw error;
        return NextResponse.json({ message: 'Updated.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
