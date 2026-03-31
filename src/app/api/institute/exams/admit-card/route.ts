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

// GET /api/institute/exams/admit-card?examId=uuid
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const examId = req.nextUrl.searchParams.get('examId');
        if (!examId) return NextResponse.json({ error: 'examId is required' }, { status: 400 });

        const admin = getAdmin();

        // 1. Verify caller is an institute admin & get institute details
        const { data: instAdmin } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: institute } = await admin
            .from('institutes')
            .select('name, address, city, state, phone, email, code')
            .eq('id', instAdmin.institute_id)
            .single();

        // 2. Fetch exam — note FK is exam_pattern_id (not exam_patterns)
        //    and batch_id (added in migration 015)
        const { data: exam, error: examErr } = await admin
            .from('exams')
            .select(`
                id,
                exam_date,
                start_time,
                end_time,
                student_id,
                course_id,
                batch_id,
                courses ( name, code, duration_months, passing_criteria_wpm ),
                exam_pattern_id,
                exam_patterns ( pattern_name, duration_minutes, section_1_duration, section_2_duration ),
                system_id,
                institute_systems ( system_name )
            `)
            .eq('id', examId)
            .single();

        if (examErr || !exam) {
            return NextResponse.json({ error: examErr?.message || 'Exam not found' }, { status: 404 });
        }

        // 3. Fetch batch name (via exam.batch_id)
        let batchName = '—';
        if ((exam as any).batch_id) {
            const { data: batch } = await admin
                .from('batches')
                .select('batch_name, batch_code')
                .eq('id', (exam as any).batch_id)
                .single();
            if (batch) batchName = batch.batch_name;
        }

        // 4. Fetch full student details (mother_name, aadhar, photo, dob)
        const { data: student, error: stuErr } = await admin
            .from('students')
            .select('id, name, enrollment_number, mother_name, aadhar_card_no, photo_url, date_of_birth, blood_group, phone, batch_id')
            .eq('id', (exam as any).student_id)
            .single();

        if (stuErr || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // If exam has no batch_id yet (old data), fall back to student's batch_id
        if (batchName === '—' && student.batch_id) {
            const { data: stu_batch } = await admin
                .from('batches')
                .select('batch_name')
                .eq('id', student.batch_id)
                .single();
            if (stu_batch) batchName = stu_batch.batch_name;
        }

        // 5. Compute times
        const startTime = (exam as any).start_time ? new Date((exam as any).start_time) : null;
        const reportingTime = startTime ? new Date(startTime.getTime() - 30 * 60 * 1000) : null;
        const gateClosingTime = startTime ? new Date(startTime.getTime() - 5 * 60 * 1000) : null;

        const fmt12 = (d: Date | null) => {
            if (!d) return '—';
            return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        const fmtDate = (s: string | null) => {
            if (!s) return '—';
            const d = new Date(s);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                .replace(/ /g, '-');
        };

        const examObj = exam as any;
        const system = examObj.institute_systems;
        const systemLabel = system
            ? system.system_name
            : '—';

        const inst = (institute as any) ?? {};

        return NextResponse.json({
            admit: {
                examId: exam.id,
                examDate: fmtDate((exam as any).exam_date),
                reportingTime: fmt12(reportingTime),
                gateClosingTime: fmt12(gateClosingTime),
                examStartTime: fmt12(startTime),
                examDuration: examObj.exam_patterns?.duration_minutes
                    ? `${examObj.exam_patterns.duration_minutes} Minutes`
                    : '75 Minutes',
                patternName: examObj.exam_patterns?.pattern_name ?? '—',
                systemName: systemLabel,
                // Student
                rollNo: student.enrollment_number,
                studentName: (student.name ?? '—').toUpperCase(),
                motherName: (student.mother_name ?? '—').toUpperCase(),
                aadhaarNo: student.aadhar_card_no ?? '—',
                photoUrl: student.photo_url ?? null,
                // Course
                courseName: (examObj.courses?.name ?? '—').toUpperCase(),
                // Batch
                batchName,
                // Institute
                instituteName: inst.name ?? 'PEACEXPERTS ACADEMY, NASHIK',
                instituteAddress: [inst.address, inst.city, inst.state]
                    .filter(Boolean)
                    .join(', ') || 'Exam Centre Address will be provided by Institute.',
                institutePhone: inst.phone ?? '',
                instituteEmail: inst.email ?? '',
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
