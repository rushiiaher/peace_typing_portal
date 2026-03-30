import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { addMinutes, isBefore, format, parseISO, startOfDay, addDays } from 'date-fns';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            courseId,
            batchId,
            examDate, // "YYYY-MM-DD"
            startTime, // "HH:mm"
            studentIds // string[]
        } = body;

        if (!courseId || !batchId || !examDate || !startTime || !studentIds?.length) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const { data: instAdminData, error: instErr } = await admin
            .from('institute_admins')
            .select(`
                institute_id,
                institutes (
                    opening_time, closing_time, working_days, center_code, code
                )
            `)
            .eq('id', user.id)
            .single();

        if (instErr || !instAdminData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const instituteId = instAdminData.institute_id;
        const institute = instAdminData.institutes as any;

        // --- PHASE 1: PRE-VALIDATION ---

        // 1. Lead Time Check (6 days)
        const proposedDate = startOfDay(parseISO(examDate));
        const minAllowedDate = startOfDay(addDays(new Date(), 6));
        if (isBefore(proposedDate, minAllowedDate)) {
            return NextResponse.json({ error: 'Exams must be scheduled at least 6 days in advance.' }, { status: 400 });
        }

        // 2. Working Day Check
        const dayName = format(proposedDate, 'EEEE');
        const workingDays = (institute.working_days as string[]) || [];
        if (!workingDays.includes(dayName)) {
            return NextResponse.json({ error: `The selected date (${dayName}) is a non-working day for this institute.` }, { status: 400 });
        }

        // 3. Auto-Resolve Exam Pattern for this Course
        // The exam pattern is fixed — one pattern per course. Fetch it automatically.
        const { data: patternData, error: patternErr } = await admin
            .from('exam_patterns')
            .select('*')
            .eq('course_id', courseId)
            .eq('is_active', true)
            .single();

        if (patternErr || !patternData) {
            return NextResponse.json({
                error: 'No active exam pattern configured for this course. Please contact the super admin.'
            }, { status: 400 });
        }

        const pattern = patternData as any;
        const totalDuration = pattern.duration_minutes;
        const bufferMinutes = 30;
        const windowDuration = totalDuration + bufferMinutes;

        // 4. Operational Hours Check
        const startDateTime = parseISO(`${examDate}T${startTime}`);
        const endDateTime = addMinutes(startDateTime, totalDuration);
        const windowEndDateTime = addMinutes(startDateTime, windowDuration);

        const startStr = format(startDateTime, 'HH:mm:ss');
        const endStr = format(endDateTime, 'HH:mm:ss');

        if (startStr < institute.opening_time || endStr > institute.closing_time) {
            return NextResponse.json({ error: `Exam time (${startStr} - ${endStr}) must be within operational hours (${institute.opening_time} - ${institute.closing_time}).` }, { status: 400 });
        }

        // --- PHASE 2: HARDWARE CONFLICT CHECK ---

        const { data: systemsData } = await admin.from('institute_systems').select('*').eq('institute_id', instituteId);
        const systems = systemsData as any[] || [];
        if (systems.length === 0) {
            return NextResponse.json({ error: 'No exam systems/terminals configured for this institute.' }, { status: 400 });
        }

        const { data: existingExams } = await admin
            .from('exams')
            .select('id, system_id, start_time, end_time')
            .eq('status', 'scheduled')
            .not('status', 'eq', 'cancelled')
            .filter('start_time', 'gte', `${examDate}T00:00:00Z`)
            .filter('start_time', 'lte', `${examDate}T23:59:59Z`);

        const bookedSystemIds = new Set();
        (existingExams ?? []).forEach(ex => {
            const exStart = new Date(ex.start_time);
            const exEndWithBuffer = addMinutes(new Date(ex.end_time), bufferMinutes);
            if (startDateTime < exEndWithBuffer && windowEndDateTime > exStart) {
                if (ex.system_id) bookedSystemIds.add(ex.system_id);
            }
        });

        const availableSystems = systems.filter(s => !bookedSystemIds.has(s.id));
        if (studentIds.length > availableSystems.length) {
            return NextResponse.json({
                error: `Not enough systems available. Requested: ${studentIds.length}, Available: ${availableSystems.length} in this time slot.`
            }, { status: 400 });
        }

        // --- PHASE 3: FINALIZATION & ALLOCATION ---

        const finalExams = [];
        const reportingTime = addMinutes(startDateTime, -30);
        const gateClosingTime = addMinutes(startDateTime, -5);

        for (let i = 0; i < studentIds.length; i++) {
            const studentId = studentIds[i];
            const system = availableSystems[i];

            finalExams.push({
                student_id: studentId,
                course_id: courseId,
                batch_id: batchId,
                exam_pattern_id: pattern.id,
                status: 'scheduled',
                exam_date: examDate,
                start_time: startDateTime.toISOString(),
                end_time: endDateTime.toISOString(),
                reporting_time: reportingTime.toISOString(),
                gate_closing_time: gateClosingTime.toISOString(),
                system_id: system.id,
                exam_center_code: institute.center_code || `${institute.code}-${courseId.slice(0, 4)}`.toUpperCase(),
            });
        }

        const { data: createdExams, error: createErr } = await admin
            .from('exams')
            .insert(finalExams)
            .select();

        if (createErr) throw createErr;

        // --- PHASE 4: QUESTION BANK SNAPSHOT ---
        // Fixed pattern: Section 1 = 25 MCQs + 1 Email, Section 2 = 1 Letter + 1 Statement, Section 3 = 1 Speed Passage
        for (const ex of createdExams) {
            const assignments: any[] = [];

            if (pattern.mcq_count > 0) {
                const { data: mcqs } = await admin.from('mcq_question_bank').select('id').eq('course_id', courseId).limit(pattern.mcq_count);
                (mcqs as any[])?.forEach(q => assignments.push({ exam_id: ex.id, question_type: 'mcq', content_id: q.id }));
            }

            if (pattern.speed_passage_count > 0) {
                const { data: speed } = await admin.from('speed_passages').select('id').eq('course_id', courseId).limit(pattern.speed_passage_count);
                (speed as any[])?.forEach(q => assignments.push({ exam_id: ex.id, question_type: 'speed', content_id: q.id }));
            }

            if (pattern.letter_count > 0) {
                const { data: letters } = await admin.from('letter_templates').select('id').eq('course_id', courseId).limit(pattern.letter_count);
                (letters as any[])?.forEach(q => assignments.push({ exam_id: ex.id, question_type: 'letter', content_id: q.id }));
            }

            if (pattern.statement_count > 0) {
                const { data: statements } = await admin.from('statement_templates').select('id').eq('course_id', courseId).limit(pattern.statement_count);
                (statements as any[])?.forEach(q => assignments.push({ exam_id: ex.id, question_type: 'statement', content_id: q.id }));
            }

            if (pattern.email_count > 0) {
                const { data: emails } = await admin.from('email_templates').select('id').eq('course_id', courseId).limit(pattern.email_count);
                (emails as any[])?.forEach(q => assignments.push({ exam_id: ex.id, question_type: 'email', content_id: q.id }));
            }

            if (assignments.length > 0) {
                await admin.from('exam_question_assignments').insert(assignments);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully scheduled ${createdExams.length} exams.`,
            exams: createdExams
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
