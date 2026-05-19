import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { addMinutes, addDays, parseISO } from 'date-fns';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

const EXAM_DURATION_MINUTES = 50; // Section 1 (25) + Section 2 (25); Section 3 is dynamic
const COOLDOWN_MINUTES = 20;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function toISTDateStr(d: Date): string {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(ist.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

/** Shared helper — returns institute_id + batch IDs for the logged-in admin */
async function getInstituteContext(admin: ReturnType<typeof getAdmin>, userId: string) {
    const { data: instAdmin } = await admin
        .from('institute_admins')
        .select('institute_id')
        .eq('id', userId)
        .single();
    if (!instAdmin) return null;

    const { data: batchRows } = await admin
        .from('batches')
        .select('id')
        .eq('institute_id', instAdmin.institute_id);

    return {
        instituteId: instAdmin.institute_id,
        batchIds: (batchRows ?? []).map((b: any) => b.id as string),
    };
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
        const ctx = await getInstituteContext(admin, user.id);
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        if (ctx.batchIds.length === 0) return NextResponse.json({ exams: [] });

        // Fetch raw exams — no embedded joins to avoid PostgREST FK ambiguity
        const { data: rawExams, error: examErr } = await admin
            .from('exams')
            .select('id, student_id, course_id, system_id, batch_id, exam_date, start_time, end_time, reporting_time, status, result, attendance_status, exam_center_code')
            .in('batch_id', ctx.batchIds)
            .order('start_time', { ascending: false, nullsFirst: false });
        if (examErr) throw examErr;
        if (!rawExams || rawExams.length === 0) return NextResponse.json({ exams: [] });

        const studentIds = [...new Set(rawExams.map((e: any) => e.student_id).filter(Boolean))];
        const courseIds  = [...new Set(rawExams.map((e: any) => e.course_id).filter(Boolean))];
        const systemIds  = [...new Set(rawExams.map((e: any) => e.system_id).filter(Boolean))];
        const batchIdSet = [...new Set(rawExams.map((e: any) => e.batch_id).filter(Boolean))];

        const [stuRes, crsRes, sysRes, batRes] = await Promise.all([
            studentIds.length > 0
                ? admin.from('students').select('id, name, enrollment_number').in('id', studentIds)
                : Promise.resolve({ data: [], error: null }),
            courseIds.length > 0
                ? admin.from('courses').select('id, name').in('id', courseIds)
                : Promise.resolve({ data: [], error: null }),
            systemIds.length > 0
                ? admin.from('institute_systems').select('id, system_name').in('id', systemIds)
                : Promise.resolve({ data: [], error: null }),
            batchIdSet.length > 0
                ? admin.from('batches').select('id, batch_name, batch_code').in('id', batchIdSet)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (stuRes.error) throw stuRes.error;
        if (crsRes.error) throw crsRes.error;
        if (sysRes.error) throw sysRes.error;
        if (batRes.error) throw batRes.error;

        const stuMap = Object.fromEntries((stuRes.data ?? []).map((s: any) => [s.id, s]));
        const crsMap = Object.fromEntries((crsRes.data ?? []).map((c: any) => [c.id, c]));
        const sysMap = Object.fromEntries((sysRes.data ?? []).map((s: any) => [s.id, s]));
        const batMap = Object.fromEntries((batRes.data ?? []).map((b: any) => [b.id, b]));

        const exams = rawExams.map((e: any) => ({
            id: e.id,
            student_name: stuMap[e.student_id]?.name ?? '—',
            enrollment: stuMap[e.student_id]?.enrollment_number ?? '—',
            course_name: crsMap[e.course_id]?.name ?? '—',
            batch_id: e.batch_id ?? '',
            batch_name: batMap[e.batch_id] ? `${batMap[e.batch_id].batch_name} (${batMap[e.batch_id].batch_code})` : '—',
            exam_date: e.exam_date,
            start_time: e.start_time,
            reporting_time: e.reporting_time ?? null,
            status: e.status,
            attendance: e.attendance_status,
            system_name: sysMap[e.system_id]?.system_name ?? '—',
            center_code: e.exam_center_code ?? '—',
        }));

        return NextResponse.json({ exams });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── PATCH (attendance update OR reschedule) ──────────────────────────────────

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const admin = getAdmin();

        // ── Reschedule ──────────────────────────────────────────────────────
        // Body: { ids: string[], newExamDate: "YYYY-MM-DD", newStartTime: "HH:mm" }
        if (body.newExamDate && body.newStartTime) {
            const { ids, newExamDate, newStartTime } = body;
            if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

            const ctx = await getInstituteContext(admin, user.id);
            if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

            // Server-side 6-day lead time check (IST-aware)
            const minAllowedIST = toISTDateStr(addDays(new Date(), 6));
            if (newExamDate < minAllowedIST) {
                return NextResponse.json({
                    error: `Exams must be rescheduled at least 6 days in advance. Earliest allowed date: ${minAllowedIST}.`
                }, { status: 400 });
            }

            // Append IST offset — user's wall-clock input must be treated as IST not UTC
            const startDT = parseISO(`${newExamDate}T${newStartTime}:00+05:30`);
            const endDT       = addMinutes(startDT, EXAM_DURATION_MINUTES);
            const reportingDT = addMinutes(startDT, -30);
            const gateDT      = addMinutes(startDT, -5);

            // ── Conflict detection ──────────────────────────────────────────
            // Fetch system assignments for the exams being rescheduled (ownership-guarded)
            const { data: examRows, error: examRowsErr } = await admin
                .from('exams')
                .select('id, system_id')
                .in('id', ids)
                .in('batch_id', ctx.batchIds);
            if (examRowsErr) throw examRowsErr;

            const systemIds = [...new Set((examRows ?? []).map((e: any) => e.system_id).filter(Boolean))];

            if (systemIds.length > 0) {
                const cooldownStart = addMinutes(startDT, -COOLDOWN_MINUTES);
                const cooldownEnd   = addMinutes(endDT, COOLDOWN_MINUTES);

                const { data: conflicting, error: cErr } = await admin
                    .from('exams')
                    .select('id, system_id, start_time, end_time')
                    .in('system_id', systemIds)
                    .not('id', 'in', `(${ids.join(',')})`)
                    .neq('status', 'cancelled')
                    .lt('start_time', cooldownEnd.toISOString())
                    .gt('end_time', cooldownStart.toISOString());
                if (cErr) throw cErr;

                if (conflicting && conflicting.length > 0) {
                    const conflictSysIds = [...new Set(conflicting.map((c: any) => c.system_id))];
                    const { data: sysNames } = await admin
                        .from('institute_systems')
                        .select('id, system_name')
                        .in('id', conflictSysIds);
                    const sysNameMap = Object.fromEntries((sysNames ?? []).map((s: any) => [s.id, s.system_name]));
                    const details = conflictSysIds.map((sid: string) => sysNameMap[sid] || `System ${sid.slice(0, 8)}`).join(', ');
                    return NextResponse.json({
                        error: `Scheduling conflict: ${conflicting.length} exam(s) already booked at this time slot (including ${COOLDOWN_MINUTES}-min cooldown). Systems busy: ${details}. Choose a different date or time.`
                    }, { status: 409 });
                }
            }

            const { error } = await admin
                .from('exams')
                .update({
                    exam_date:        newExamDate,
                    start_time:       startDT.toISOString(),
                    end_time:         endDT.toISOString(),
                    reporting_time:   reportingDT.toISOString(),
                    gate_closing_time: gateDT.toISOString(),
                })
                .in('id', ids)
                .in('batch_id', ctx.batchIds); // ownership guard

            if (error) throw error;
            return NextResponse.json({ success: true, message: `Rescheduled ${ids.length} exam(s) to ${newExamDate} at ${newStartTime} (IST).` });
        }

        // ── Attendance / status update (single exam) ────────────────────────
        const { id, attendance_status, status, result } = body;
        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const { data, error } = await admin
            .from('exams')
            .update({
                ...(attendance_status && { attendance_status }),
                ...(status && { status }),
                ...(result && { result }),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ exam: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
// Body: { ids: string[] }

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { ids } = await req.json();
        if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });

        const admin = getAdmin();
        const ctx = await getInstituteContext(admin, user.id);
        if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only delete exams that belong to this institute's batches (ownership guard)
        const { error } = await admin
            .from('exams')
            .delete()
            .in('id', ids)
            .in('batch_id', ctx.batchIds);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
