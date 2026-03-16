import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function getAdminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getInstituteId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = await getAdminClient();
    const { data } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
    return data?.institute_id ?? null;
}

// GET /api/institute/batch-students?batch_id=xxx
// Returns: { enrolled: [...], available: [...] }
export async function GET(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const batchId = req.nextUrl.searchParams.get('batch_id');
        if (!batchId) return NextResponse.json({ error: 'batch_id is required.' }, { status: 400 });

        const admin = await getAdminClient();

        // Verify batch belongs to this institute
        const { data: batch } = await admin.from('batches').select('id').eq('id', batchId).eq('institute_id', instituteId).single();
        if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });

        // All students in this institute
        const { data: allStudents, error: sErr } = await admin
            .from('students')
            .select('id, name, enrollment_number, batch_id')
            .eq('institute_id', instituteId)
            .order('name');
        if (sErr) throw sErr;

        const enrolled = (allStudents ?? []).filter(s => s.batch_id === batchId);
        const available = (allStudents ?? []).filter(s => s.batch_id !== batchId);

        return NextResponse.json({ enrolled, available });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST /api/institute/batch-students
// Body: { batch_id, student_id }  → assigns student to batch
export async function POST(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { batch_id, student_id } = await req.json();
        if (!batch_id || !student_id) return NextResponse.json({ error: 'batch_id and student_id are required.' }, { status: 400 });

        const admin = await getAdminClient();

        // Verify batch belongs to this institute
        const { data: batch } = await admin.from('batches').select('id').eq('id', batch_id).eq('institute_id', instituteId).single();
        if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });

        // Verify student belongs to this institute
        const { data: student } = await admin.from('students').select('id').eq('id', student_id).eq('institute_id', instituteId).single();
        if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

        const { error } = await admin.from('students').update({ batch_id }).eq('id', student_id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE /api/institute/batch-students?student_id=xxx
// Removes student from any batch (sets batch_id = null)
export async function DELETE(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const studentId = req.nextUrl.searchParams.get('student_id');
        if (!studentId) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });

        const admin = await getAdminClient();

        // Verify student belongs to this institute
        const { data: student } = await admin.from('students').select('id').eq('id', studentId).eq('institute_id', instituteId).single();
        if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

        const { error } = await admin.from('students').update({ batch_id: null }).eq('id', studentId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
