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

// Cooldown between consecutive exams on the same system (minutes)
const COOLDOWN_MINUTES = 20;

// Fixed exam pattern fallback (used when DB row not yet seeded via migration 017)
const FIXED_PATTERN = {
    id: null,
    mcq_count: 25,
    email_count: 1,
    letter_count: 1,
    statement_count: 1,
    speed_passage_count: 1,
    keyboard_lesson_count: 0,
    duration_minutes: 50, // Section 1 (25 min) + Section 2 (25 min); Section 3 is dynamic
    section_1_duration: 25,
    section_2_duration: 25,
    total_marks: 100,
    passing_marks: 40,
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            courseId,
            batchId,
            examDate,   // "YYYY-MM-DD"
            startTime,  // "HH:mm"
            studentIds  // string[]
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

        // ── PHASE 1: PRE-VALIDATION ────────────────────────────────────────────

        // 1. Lead time (6 days)
        const proposedDate = startOfDay(parseISO(examDate));
        const minAllowedDate = startOfDay(addDays(new Date(), 6));
        if (isBefore(proposedDate, minAllowedDate)) {
            return NextResponse.json({ error: 'Exams must be scheduled at least 6 days in advance.' }, { status: 400 });
        }

        // 2. Working day — skip when working_days not configured
        const dayName = format(proposedDate, 'EEEE');
        const workingDays = (institute.working_days as string[]) || [];
        if (workingDays.length > 0 && !workingDays.includes(dayName)) {
            return NextResponse.json({ error: `The selected date (${dayName}) is a non-working day for this institute.` }, { status: 400 });
        }

        // 3. Auto-resolve exam pattern
        const { data: patternData } = await admin
            .from('exam_patterns')
            .select('*')
            .eq('course_id', courseId)
            .eq('is_active', true)
            .single();

        const pattern = { ...FIXED_PATTERN, ...(patternData ?? {}) } as any;
        const totalDuration = pattern.duration_minutes as number;

        // 4. Operational hours — skip when not configured
        const startDateTime = parseISO(`${examDate}T${startTime}`);
        const endDateTime = addMinutes(startDateTime, totalDuration);
        const startStr = format(startDateTime, 'HH:mm:ss');
        const endStr = format(endDateTime, 'HH:mm:ss');

        if (institute.opening_time && institute.closing_time) {
            if (startStr < institute.opening_time || endStr > institute.closing_time) {
                return NextResponse.json({
                    error: `Exam time (${startStr} – ${endStr}) must be within operational hours (${institute.opening_time} – ${institute.closing_time}).`
                }, { status: 400 });
            }
        }

        // ── PHASE 2: SYSTEM CHECK ──────────────────────────────────────────────

        const { data: systemsData } = await admin
            .from('institute_systems')
            .select('*')
            .eq('institute_id', instituteId);

        const systems = (systemsData as any[]) || [];

        // Systems are required — exam cannot be scheduled without them
        if (systems.length === 0) {
            return NextResponse.json({
                error: 'NO_SYSTEMS',
                message: 'No exam systems/computers have been added for this institute. Please go to Settings → Systems and add your exam computers before scheduling.'
            }, { status: 400 });
        }

        // Find which systems are already booked on this date (with 20-min cooldown)
        const { data: existingExams } = await admin
            .from('exams')
            .select('id, system_id, start_time, end_time')
            .eq('status', 'scheduled')
            .filter('start_time', 'gte', `${examDate}T00:00:00Z`)
            .filter('start_time', 'lte', `${examDate}T23:59:59Z`);

        // A system is "busy" for a proposed slot if:
        //   proposedStart < existingEnd + COOLDOWN  AND  proposedEnd + COOLDOWN > existingStart
        function bookedAtSlot(slotStart: Date, slotEnd: Date, excludeAlreadyScheduled: Set<any> = new Set()): Set<string> {
            const busy = new Set<string>();
            const slotEndWithCooldown = addMinutes(slotEnd, COOLDOWN_MINUTES);
            for (const ex of existingExams ?? []) {
                if (excludeAlreadyScheduled.has(ex.id)) continue;
                const exStart = new Date(ex.start_time);
                const exEndWithCooldown = addMinutes(new Date(ex.end_time), COOLDOWN_MINUTES);
                if (slotStart < exEndWithCooldown && slotEndWithCooldown > exStart) {
                    if (ex.system_id) busy.add(ex.system_id);
                }
            }
            return busy;
        }

        // ── PHASE 3: BATCH ALLOCATION WITH AUTO TIME-SLOT SHIFTING ────────────
        // If more students than available systems, split into sequential batches.
        // Each batch starts after: previous_slot_end + COOLDOWN_MINUTES.

        const finalExams: any[] = [];
        const timeSlotSummary: { time: string; count: number }[] = [];
        let remaining = [...studentIds];
        let slotStart = startDateTime;
        let batchIndex = 0;

        while (remaining.length > 0) {
            const slotEnd = addMinutes(slotStart, totalDuration);
            const slotStartStr = format(slotStart, 'HH:mm:ss');
            const slotEndStr2 = format(slotEnd, 'HH:mm:ss');

            // Operational hours check for this slot
            if (institute.opening_time && institute.closing_time) {
                if (slotStartStr < institute.opening_time || slotEndStr2 > institute.closing_time) {
                    return NextResponse.json({
                        error: `Cannot schedule all students within operational hours. ${remaining.length} student(s) could not be slotted after ${format(slotStart, 'HH:mm')}. Either reduce the student count or add more systems.`
                    }, { status: 400 });
                }
            }

            // For batch 0: only newly-freed systems (not already booked by existing exams).
            // For batch 1+: the systems used in earlier batches are free again (cooldown expired).
            const busyFromExisting = bookedAtSlot(slotStart, slotEnd);

            // Mark systems used by our own earlier batches as busy for THIS slot if cooldown hasn't expired
            const busyFromOurBatches = new Set<string>();
            if (batchIndex > 0) {
                // Each of our previous batches ends at: startDateTime + n * (totalDuration + COOLDOWN_MINUTES)
                // They are free for the current slot as long as slotStart >= prevBatchEnd + COOLDOWN
                // Since we advance by exactly (totalDuration + COOLDOWN), they are always free by design
            }

            const availableAtSlot = systems.filter(
                (s: any) => !busyFromExisting.has(s.id) && !busyFromOurBatches.has(s.id)
            );

            if (availableAtSlot.length === 0) {
                // All systems busy by existing external exams at this slot — try next slot
                slotStart = addMinutes(slotStart, totalDuration + COOLDOWN_MINUTES);
                continue;
            }

            const batch = remaining.splice(0, availableAtSlot.length);
            const reportingTime = addMinutes(slotStart, -30);
            const gateClosingTime = addMinutes(slotStart, -5);
            const examCenter = institute.center_code || (institute.code ? `${institute.code}-${courseId.slice(0, 4)}`.toUpperCase() : null);

            batch.forEach((studentId: string, i: number) => {
                finalExams.push({
                    student_id: studentId,
                    course_id: courseId,
                    batch_id: batchId,
                    exam_pattern_id: pattern.id,
                    status: 'scheduled',
                    exam_date: examDate,
                    start_time: slotStart.toISOString(),
                    end_time: slotEnd.toISOString(),
                    reporting_time: reportingTime.toISOString(),
                    gate_closing_time: gateClosingTime.toISOString(),
                    system_id: availableAtSlot[i].id,
                    exam_center_code: examCenter,
                });
            });

            timeSlotSummary.push({ time: format(slotStart, 'hh:mm a'), count: batch.length });
            slotStart = addMinutes(slotStart, totalDuration + COOLDOWN_MINUTES);
            batchIndex++;
        }

        // ── PHASE 4: PERSIST ──────────────────────────────────────────────────

        const { data: createdExams, error: createErr } = await admin
            .from('exams')
            .insert(finalExams)
            .select();

        if (createErr) throw createErr;

        // ── PHASE 5: QUESTION BANK SNAPSHOT ──────────────────────────────────

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

        // Build human-readable summary
        const slotMsg = timeSlotSummary.length === 1
            ? `Successfully scheduled ${createdExams.length} exam(s) at ${timeSlotSummary[0].time}.`
            : `Scheduled ${createdExams.length} exam(s) across ${timeSlotSummary.length} time slots: ` +
              timeSlotSummary.map(s => `${s.count} at ${s.time}`).join(', ') +
              `. (Auto-split due to limited systems — 20-min cooldown applied.)`;

        return NextResponse.json({ success: true, message: slotMsg, exams: createdExams });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
