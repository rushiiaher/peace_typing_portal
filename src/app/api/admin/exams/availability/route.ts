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

const COOLDOWN_MINUTES = 20;
const DEFAULT_DURATION_MINUTES = 50;
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60 * 1000);

// GET /api/admin/exams/availability?exam_id=&date=YYYY-MM-DD&time=HH:mm
// Returns the exam's institute systems with per-system availability for the
// requested slot (existing bookings + 20-min cooldown; the exam itself excluded).
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const examId = req.nextUrl.searchParams.get('exam_id');
        const date = req.nextUrl.searchParams.get('date');
        const time = req.nextUrl.searchParams.get('time');
        if (!examId || !date || !time) {
            return NextResponse.json({ error: 'exam_id, date and time are required' }, { status: 400 });
        }

        const admin = getAdmin();

        const { data: exam, error: examErr } = await admin
            .from('exams')
            .select('id, system_id, batches ( institute_id ), exam_patterns ( duration_minutes )')
            .eq('id', examId)
            .single();
        if (examErr || !exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

        const bat: any = exam.batches;
        const instituteId = Array.isArray(bat) ? bat[0]?.institute_id : bat?.institute_id;
        if (!instituteId) return NextResponse.json({ error: 'Exam has no institute (missing batch).' }, { status: 400 });

        const patn: any = exam.exam_patterns;
        const duration = (Array.isArray(patn) ? patn[0]?.duration_minutes : patn?.duration_minutes) || DEFAULT_DURATION_MINUTES;
        const slotStart = new Date(`${date}T${time}:00+05:30`);
        const slotEnd = addMin(slotStart, duration);

        const { data: systems, error: sysErr } = await admin
            .from('institute_systems')
            .select('id, system_name')
            .eq('institute_id', instituteId)
            .eq('is_active', true)
            .order('system_name');
        if (sysErr) throw sysErr;

        const systemIds = (systems ?? []).map((s: any) => s.id);
        if (systemIds.length === 0) return NextResponse.json({ systems: [], duration });

        // Bookings on these systems around the slot (this exam excluded)
        const windowStart = addMin(slotStart, -24 * 60);
        const windowEnd = addMin(slotStart, 24 * 60);
        const { data: bookings, error: bErr } = await admin
            .from('exams')
            .select('id, system_id, start_time, end_time')
            .in('system_id', systemIds)
            .neq('id', examId)
            .neq('status', 'cancelled')
            .not('start_time', 'is', null)
            .gte('start_time', windowStart.toISOString())
            .lte('start_time', windowEnd.toISOString());
        if (bErr) throw bErr;

        const busyUntil = new Map<string, string>();
        for (const b of bookings ?? []) {
            if (!b.end_time) continue;
            const exStart = new Date(b.start_time);
            const exEnd = new Date(b.end_time);
            // busy if slot overlaps booking (cooldown applied on both sides)
            if (slotStart < addMin(exEnd, COOLDOWN_MINUTES) && addMin(slotEnd, COOLDOWN_MINUTES) > exStart) {
                const freeAt = addMin(exEnd, COOLDOWN_MINUTES);
                const prev = busyUntil.get(b.system_id);
                if (!prev || new Date(prev) < freeAt) busyUntil.set(b.system_id, freeAt.toISOString());
            }
        }

        const result = (systems ?? []).map((s: any) => ({
            id: s.id,
            system_name: s.system_name,
            available: !busyUntil.has(s.id),
            busy_until: busyUntil.get(s.id) ?? null,
            is_current: s.id === exam.system_id,
        }));

        return NextResponse.json({ systems: result, duration, cooldown: COOLDOWN_MINUTES });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
