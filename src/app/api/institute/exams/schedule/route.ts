import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { addMinutes, isBefore, format, parseISO, startOfDay, addDays, getDay } from 'date-fns';

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

/**
 * Advance a date to the next working day.
 * Skips Sundays by default. If workingDays array is configured,
 * skips any day NOT in that array.
 */
function nextWorkingDay(date: Date, workingDays: string[]): Date {
    let d = addDays(startOfDay(date), 1);
    // Safety: max 14-day lookahead to prevent infinite loops
    for (let i = 0; i < 14; i++) {
        const dayName = format(d, 'EEEE');
        if (workingDays.length > 0) {
            if (workingDays.includes(dayName)) return d;
        } else {
            // Default: skip only Sunday (day 0)
            if (getDay(d) !== 0) return d;
        }
        d = addDays(d, 1);
    }
    return d;
}

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
        const workingDays = (institute.working_days as string[]) || [];
        const dayName = format(proposedDate, 'EEEE');
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

        // 4. Operational hours — validate the first slot's START time only
        const openTime = institute.opening_time || '09:00:00';
        const closeTime = institute.closing_time || '18:00:00';

        const startStr = `${startTime}:00`;
        if (startStr < openTime) {
            return NextResponse.json({
                error: `Start time (${startTime}) is before operational hours (${openTime} – ${closeTime}).`
            }, { status: 400 });
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

        // ── PHASE 3: BATCH ALLOCATION WITH AUTO MULTI-DAY OVERFLOW ─────────────
        // If more students than available systems, split into sequential time-slots.
        // If a slot exceeds operational hours, auto-advance to the NEXT WORKING DAY
        // (skipping Sundays / non-working days) and continue scheduling.

        /** Fetch exams already scheduled on a given date */
        async function fetchExistingExams(dateStr: string) {
            const { data } = await admin
                .from('exams')
                .select('id, system_id, start_time, end_time')
                .eq('status', 'scheduled')
                .filter('start_time', 'gte', `${dateStr}T00:00:00Z`)
                .filter('start_time', 'lte', `${dateStr}T23:59:59Z`);
            return data ?? [];
        }

        /** Check which systems are busy at a proposed slot */
        function bookedAtSlot(
            slotStart: Date, slotEnd: Date,
            existingExams: any[]
        ): Set<string> {
            const busy = new Set<string>();
            const slotEndWithCooldown = addMinutes(slotEnd, COOLDOWN_MINUTES);
            for (const ex of existingExams) {
                const exStart = new Date(ex.start_time);
                const exEndWithCooldown = addMinutes(new Date(ex.end_time), COOLDOWN_MINUTES);
                if (slotStart < exEndWithCooldown && slotEndWithCooldown > exStart) {
                    if (ex.system_id) busy.add(ex.system_id);
                }
            }
            return busy;
        }

        const finalExams: any[] = [];
        const timeSlotSummary: { date: string; time: string; count: number }[] = [];
        let remaining = [...studentIds];
        let currentDate = proposedDate;
        let slotStart = parseISO(`${examDate}T${startTime}:00+05:30`);
        let existingExamsForDay = await fetchExistingExams(examDate);
        let dayChangeCount = 0;
        const MAX_DAY_ADVANCE = 30; // safety cap

        while (remaining.length > 0 && dayChangeCount <= MAX_DAY_ADVANCE) {
            const currentDateStr = format(currentDate, 'yyyy-MM-dd');
            const slotEnd = addMinutes(slotStart, totalDuration);
            const slotStartStr = format(slotStart, 'HH:mm:ss');
            const slotEndStr = format(slotEnd, 'HH:mm:ss');

            // Check if this slot exceeds operational hours → move to next working day
            if (slotStartStr < openTime || slotEndStr > closeTime) {
                // Advance to next working day and reset to opening_time
                currentDate = nextWorkingDay(currentDate, workingDays);
                const newDateStr = format(currentDate, 'yyyy-MM-dd');
                const [oh, om] = openTime.split(':');
                slotStart = parseISO(`${newDateStr}T${oh}:${om}:00+05:30`);
                existingExamsForDay = await fetchExistingExams(newDateStr);
                dayChangeCount++;
                continue;
            }

            // Find available systems for this slot
            const busyFromExisting = bookedAtSlot(slotStart, slotEnd, existingExamsForDay);
            const availableAtSlot = systems.filter(
                (s: any) => !busyFromExisting.has(s.id)
            );

            if (availableAtSlot.length === 0) {
                // All systems busy by existing exams at this slot — try next time slot
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
                    exam_date: currentDateStr,
                    start_time: slotStart.toISOString(),
                    end_time: slotEnd.toISOString(),
                    reporting_time: reportingTime.toISOString(),
                    gate_closing_time: gateClosingTime.toISOString(),
                    system_id: availableAtSlot[i].id,
                    exam_center_code: examCenter,
                });
            });

            // Also add to existing exams cache so next iteration sees them as busy
            batch.forEach((_: string, i: number) => {
                existingExamsForDay.push({
                    id: `pending-${finalExams.length}-${i}`,
                    system_id: availableAtSlot[i].id,
                    start_time: slotStart.toISOString(),
                    end_time: slotEnd.toISOString(),
                });
            });

            timeSlotSummary.push({
                date: format(currentDate, 'dd MMM yyyy (EEEE)'),
                time: format(slotStart, 'hh:mm a'),
                count: batch.length,
            });

            // Move to next time slot on the same day
            slotStart = addMinutes(slotStart, totalDuration + COOLDOWN_MINUTES);
        }

        if (remaining.length > 0) {
            return NextResponse.json({
                error: `Could not schedule ${remaining.length} student(s) even after advancing ${MAX_DAY_ADVANCE} days. Please add more systems or contact support.`
            }, { status: 400 });
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
        // Group by date for clear messaging
        const uniqueDates = [...new Set(timeSlotSummary.map(s => s.date))];
        let slotMsg: string;
        if (uniqueDates.length === 1 && timeSlotSummary.length === 1) {
            slotMsg = `Successfully scheduled ${createdExams.length} exam(s) on ${timeSlotSummary[0].date} at ${timeSlotSummary[0].time}.`;
        } else {
            const dateSummaries = uniqueDates.map(date => {
                const slots = timeSlotSummary.filter(s => s.date === date);
                const totalForDate = slots.reduce((sum, s) => sum + s.count, 0);
                const slotDetails = slots.map(s => `${s.count} at ${s.time}`).join(', ');
                return `${date}: ${totalForDate} student(s) [${slotDetails}]`;
            });
            slotMsg = `Scheduled ${createdExams.length} exam(s) across ${uniqueDates.length} day(s):\n` +
                dateSummaries.join('\n') +
                (uniqueDates.length > 1 ? '\n(Auto-split across days due to limited systems / operational hours. Sundays & non-working days skipped.)' : '\n(Auto-split into time slots — 20-min cooldown applied.)');
        }

        return NextResponse.json({ success: true, message: slotMsg, exams: createdExams });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
