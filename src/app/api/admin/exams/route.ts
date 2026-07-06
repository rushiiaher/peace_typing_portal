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

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();

        const { data: rawExams, error: examErr } = await admin
            .from('exams')
            .select(`
                id, student_id, course_id, batch_id, system_id, exam_date, start_time, end_time, reporting_time, status, attendance_status, exam_center_code, result,
                exam_answers ( mcq_marks_obtained, speed_wpm, speed_accuracy, speed_passed, overall_result, result_breakdown )
            `)
            .order('exam_date', { ascending: true })
            .order('start_time', { ascending: true });
        if (examErr) throw examErr;
        if (!rawExams?.length) return NextResponse.json({ exams: [] });

        const studentIds = [...new Set(rawExams.map((e: any) => e.student_id).filter(Boolean))];
        const courseIds  = [...new Set(rawExams.map((e: any) => e.course_id).filter(Boolean))];
        const batchIds   = [...new Set(rawExams.map((e: any) => e.batch_id).filter(Boolean))];
        const systemIds  = [...new Set(rawExams.map((e: any) => e.system_id).filter(Boolean))];

        const [stuRes, crsRes, batRes, sysRes] = await Promise.all([
            studentIds.length > 0
                ? admin.from('students').select('id, name, enrollment_number, photo_url').in('id', studentIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length > 0
                ? admin.from('courses').select('id, name, code').in('id', courseIds)
                : Promise.resolve({ data: [], error: null }),
            batchIds.length > 0
                ? admin.from('batches').select('id, batch_name, batch_code, institute_id').in('id', batchIds)
                : Promise.resolve({ data: [], error: null }),
            systemIds.length > 0
                ? admin.from('institute_systems').select('id, system_name').in('id', systemIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        // Fetch institute names for batches
        const instituteIds = [...new Set((batRes.data ?? []).map((b: any) => b.institute_id).filter(Boolean))];
        const { data: instRows } = instituteIds.length > 0
            ? await admin.from('institutes').select('id, name, code').in('id', instituteIds)
            : { data: [] };

        const stuMap  = Object.fromEntries((stuRes.data ?? []).map((s: any) => [s.id, s]));
        const crsMap  = Object.fromEntries((crsRes.data ?? []).map((c: any) => [c.id, c]));
        const batMap  = Object.fromEntries((batRes.data ?? []).map((b: any) => [b.id, b]));
        const sysMap  = Object.fromEntries((sysRes.data ?? []).map((s: any) => [s.id, s]));
        const instMap = Object.fromEntries((instRows ?? []).map((i: any) => [i.id, i]));

        const exams = rawExams.map((e: any) => {
            const bat = batMap[e.batch_id];
            const inst = bat ? instMap[bat.institute_id] : null;
            return {
                id: e.id,
                student: stuMap[e.student_id]?.name ?? '—',
                enrollment: stuMap[e.student_id]?.enrollment_number ?? '—',
                photoUrl: stuMap[e.student_id]?.photo_url ?? null,
                institute: inst?.name ?? '—',
                instituteCode: inst?.code ?? '',
                instituteId: bat?.institute_id ?? '',
                course: crsMap[e.course_id]?.name ?? '—',
                courseCode: crsMap[e.course_id]?.code ?? '',
                batch: bat?.batch_name ?? '—',
                batchCode: bat?.batch_code ?? '',
                batchId: e.batch_id ?? '',
                systemName: sysMap[e.system_id]?.system_name ?? '—',
                examDate: e.exam_date ?? '—',
                startTime: e.start_time ?? null,
                endTime: e.end_time ?? null,
                reportingTime: e.reporting_time ?? null,
                status: e.status ?? '—',
                attendance: e.attendance_status ?? 'pending',
                centerCode: e.exam_center_code ?? '—',
                result: e.result ?? null,
                examAnswers: e.exam_answers?.[0] ?? null,
            };
        });

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── PATCH — Super Admin reschedule ─────────────────────────────────────────
// Body: { ids: string[], newExamDate: "YYYY-MM-DD", newStartTime: "HH:mm", newSystemId?: string }
//
// Two modes:
//  A) Manual single assign — exactly one id + newSystemId: place that student
//     on that exact system/slot after verifying the system is free
//     (existing bookings + 20-min cooldown).
//  B) Bulk distribute — multiple ids (or one id without newSystemId): students
//     are packed into slots across the institute's active systems. Each slot
//     takes at most one student per system; when systems run out the next
//     batch moves to the following slot (duration + cooldown later). Systems
//     are REASSIGNED — never two students on the same system in one slot.

const COOLDOWN_MINUTES = 20;
const DEFAULT_DURATION_MINUTES = 50;

const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60 * 1000);

/** Overlap test matching the institute scheduler:
 *  busy if slotStart < exEnd+cooldown AND slotEnd+cooldown > exStart */
function overlapsWithCooldown(slotStart: Date, slotEnd: Date, exStart: Date, exEnd: Date) {
    return slotStart < addMin(exEnd, COOLDOWN_MINUTES) && addMin(slotEnd, COOLDOWN_MINUTES) > exStart;
}

const toIST12h = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { ids, newExamDate, newStartTime, newSystemId } = body;

        if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
        if (!newExamDate || !newStartTime) {
            return NextResponse.json({ error: 'newExamDate and newStartTime are required' }, { status: 400 });
        }
        if (newSystemId && ids.length !== 1) {
            return NextResponse.json({ error: 'Manual system assignment works for one exam at a time.' }, { status: 400 });
        }

        const admin = getAdmin();

        // ── Load the exams being moved (need batch → institute, pattern duration)
        const { data: examRows, error: examRowsErr } = await admin
            .from('exams')
            .select('id, system_id, batch_id, batches ( institute_id ), exam_patterns ( duration_minutes )')
            .in('id', ids);
        if (examRowsErr) throw examRowsErr;
        if (!examRows?.length) return NextResponse.json({ error: 'Exams not found' }, { status: 404 });

        const getInst = (e: any) => Array.isArray(e.batches) ? e.batches[0]?.institute_id : e.batches?.institute_id;
        const instituteIds = [...new Set(examRows.map(getInst).filter(Boolean))];
        if (instituteIds.length !== 1) {
            return NextResponse.json({ error: 'All selected exams must belong to the same institute.' }, { status: 400 });
        }
        const instituteId = instituteIds[0];

        const pat: any = (examRows[0] as any)?.exam_patterns;
        const duration = (Array.isArray(pat) ? pat[0]?.duration_minutes : pat?.duration_minutes) || DEFAULT_DURATION_MINUTES;

        // ── Institute's active systems
        const { data: systems, error: sysErr } = await admin
            .from('institute_systems')
            .select('id, system_name')
            .eq('institute_id', instituteId)
            .eq('is_active', true)
            .order('system_name');
        if (sysErr) throw sysErr;
        if (!systems?.length) {
            return NextResponse.json({ error: 'No active exam systems found for this institute. Add systems first.' }, { status: 400 });
        }
        const systemIds = systems.map((s: any) => s.id);
        const sysNameMap = Object.fromEntries(systems.map((s: any) => [s.id, s.system_name]));

        // ── Existing bookings on these systems around the target date (other exams only)
        const dayStart = new Date(`${newExamDate}T00:00:00+05:30`);
        const windowStart = addMin(dayStart, -24 * 60);
        const windowEnd = addMin(dayStart, 48 * 60);
        const { data: existing, error: exErr } = await admin
            .from('exams')
            .select('id, system_id, start_time, end_time')
            .in('system_id', systemIds)
            .neq('status', 'cancelled')
            .not('start_time', 'is', null)
            .gte('start_time', windowStart.toISOString())
            .lte('start_time', windowEnd.toISOString());
        if (exErr) throw exErr;

        const idSet = new Set(ids);
        const otherBookings = (existing ?? []).filter((e: any) => !idSet.has(e.id) && e.end_time);

        const busySystemsAt = (slotStart: Date, slotEnd: Date, extra: { system_id: string; start: Date; end: Date }[]) => {
            const busy = new Set<string>();
            for (const b of otherBookings) {
                if (overlapsWithCooldown(slotStart, slotEnd, new Date(b.start_time), new Date(b.end_time))) {
                    busy.add(b.system_id);
                }
            }
            for (const b of extra) {
                if (overlapsWithCooldown(slotStart, slotEnd, b.start, b.end)) busy.add(b.system_id);
            }
            return busy;
        };

        const applyUpdate = async (examId: string, sysId: string, slotStart: Date, slotEnd: Date) => {
            const { error } = await admin
                .from('exams')
                .update({
                    exam_date: newExamDate,
                    start_time: slotStart.toISOString(),
                    end_time: slotEnd.toISOString(),
                    reporting_time: addMin(slotStart, -30).toISOString(),
                    gate_closing_time: addMin(slotStart, -5).toISOString(),
                    system_id: sysId,
                })
                .eq('id', examId);
            if (error) throw error;
        };

        const requestedStart = new Date(`${newExamDate}T${newStartTime}:00+05:30`);

        // ── Mode A: manual single assignment to a specific system ──────────────
        if (newSystemId) {
            if (!systemIds.includes(newSystemId)) {
                return NextResponse.json({ error: 'Selected system does not belong to this institute or is inactive.' }, { status: 400 });
            }
            const slotEnd = addMin(requestedStart, duration);
            const busy = busySystemsAt(requestedStart, slotEnd, []);
            if (busy.has(newSystemId)) {
                return NextResponse.json({
                    error: `${sysNameMap[newSystemId]} is not available at ${newStartTime} on ${newExamDate} (existing booking within the ${COOLDOWN_MINUTES}-min cooldown window). Pick another system or time.`
                }, { status: 409 });
            }
            await applyUpdate(ids[0], newSystemId, requestedStart, slotEnd);
            return NextResponse.json({
                success: true,
                message: `Exam set: ${newExamDate} at ${newStartTime} (IST) on ${sysNameMap[newSystemId]}.`,
            });
        }

        // ── Mode B: bulk distribute across systems + slots ─────────────────────
        const dayEnd = new Date(`${newExamDate}T23:59:59+05:30`);
        const placed: { system_id: string; start: Date; end: Date }[] = [];
        const slotSummary: { time: string; count: number }[] = [];
        let slotStart = requestedStart;
        let remaining: string[] = [...ids];
        let guard = 0;

        while (remaining.length > 0 && guard++ < 100) {
            const slotEnd = addMin(slotStart, duration);
            if (slotEnd > dayEnd) {
                return NextResponse.json({
                    error: `Not enough system capacity on ${newExamDate}: placed ${ids.length - remaining.length} of ${ids.length} exams before running out of day. Reduce the group or start earlier.`
                }, { status: 409 });
            }

            const busy = busySystemsAt(slotStart, slotEnd, placed);
            const free = systems.filter((s: any) => !busy.has(s.id));

            if (free.length === 0) {
                slotStart = addMin(slotStart, duration + COOLDOWN_MINUTES);
                continue;
            }

            const batch = remaining.slice(0, free.length);
            remaining = remaining.slice(free.length);

            for (let i = 0; i < batch.length; i++) {
                await applyUpdate(batch[i], free[i].id, slotStart, slotEnd);
                placed.push({ system_id: free[i].id, start: slotStart, end: slotEnd });
            }
            slotSummary.push({ time: toIST12h(slotStart), count: batch.length });

            slotStart = addMin(slotStart, duration + COOLDOWN_MINUTES);
        }

        if (remaining.length > 0) {
            return NextResponse.json({ error: 'Could not place all exams (scheduling loop limit reached).' }, { status: 500 });
        }

        const detail = slotSummary.map(s => `${s.count} at ${s.time}`).join(', ');
        return NextResponse.json({
            success: true,
            message: `Rescheduled ${ids.length} exam(s) on ${newExamDate}: ${detail}. One student per system per slot, ${COOLDOWN_MINUTES}-min cooldown between slots.`,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
