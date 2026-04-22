import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = req.nextUrl;
        const institute_id = searchParams.get('institute_id');
        const course_id = searchParams.get('course_id');
        const batch_id = searchParams.get('batch_id');
        const date_from = searchParams.get('date_from');
        const date_to = searchParams.get('date_to');
        const search = searchParams.get('search');

        const admin = getAdmin();

        // If institute_id provided, pre-fetch batch IDs for that institute to filter exams
        let batchIdFilter: string[] | null = null;
        if (institute_id) {
            let bq = admin.from('batches').select('id').eq('institute_id', institute_id);
            if (batch_id) bq = bq.eq('id', batch_id);
            const { data: batchData, error: batchErr } = await bq;
            if (batchErr) throw batchErr;
            batchIdFilter = (batchData ?? []).map((b: any) => b.id);
            if (batchIdFilter.length === 0) {
                return NextResponse.json({ results: [], total: 0 });
            }
        }

        let query = admin
            .from('exams')
            .select(`
                id,
                exam_date,
                total_marks_obtained,
                grade,
                result,
                certificate_generated,
                batch_id,
                course_id,
                student_id,
                students ( id, name, email, enrollment_number, mother_name ),
                batches ( id, batch_name, batch_code, institute_id, institutes ( id, name, code ) ),
                courses ( id, name, code ),
                exam_patterns ( total_marks, passing_marks )
            `)
            .eq('status', 'completed')
            .order('exam_date', { ascending: false });

        if (batchIdFilter) {
            query = query.in('batch_id', batchIdFilter);
        } else if (batch_id) {
            query = query.eq('batch_id', batch_id);
        }

        if (course_id) query = query.eq('course_id', course_id);
        if (date_from) query = query.gte('exam_date', date_from);
        if (date_to) query = query.lte('exam_date', date_to);

        const { data, error } = await query;
        if (error) throw error;

        let rows = (data ?? []).map((r: any) => {
            const total_marks = r.exam_patterns?.total_marks ?? 100;
            const marks = r.total_marks_obtained;
            const percentage = marks != null
                ? Math.round((marks / total_marks) * 1000) / 10
                : null;
            return {
                id: r.id,
                student_id: r.student_id,
                student_name: r.students?.name ?? '—',
                email: r.students?.email ?? '',
                enrollment_number: r.students?.enrollment_number ?? '',
                mother_name: r.students?.mother_name ?? '',
                institute_id: r.batches?.institutes?.id ?? '',
                institute_name: r.batches?.institutes?.name ?? '—',
                course_id: r.course_id,
                course_name: r.courses?.name ?? '—',
                course_code: r.courses?.code ?? '',
                batch_id: r.batch_id,
                batch_name: r.batches?.batch_name ?? '—',
                batch_code: r.batches?.batch_code ?? '',
                marks_obtained: marks,
                total_marks,
                percentage,
                grade: r.grade,
                result: r.result,
                exam_date: r.exam_date,
                certificate_generated: r.certificate_generated ?? false,
            };
        });

        if (search) {
            const q = search.toLowerCase();
            rows = rows.filter(r =>
                r.student_name.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q) ||
                r.enrollment_number.toLowerCase().includes(q)
            );
        }

        return NextResponse.json({ results: rows, total: rows.length });
    } catch (err: any) {
        console.error('[admin/final-results GET]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
