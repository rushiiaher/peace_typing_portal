import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
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
        // Verify student exists and is active; grab profile fields for the header
        const { data: studentRow } = await admin
            .from('students')
            .select('id, is_active, name, photo_url, enrollment_number, institute_id, batch_id')
            .eq('id', user.id)
            .single();
        if (!studentRow || !studentRow.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Course (via batch) + institute names — flat lookups (no FK ambiguity)
        const [batchRes, instRes] = await Promise.all([
            studentRow.batch_id
                ? admin.from('batches').select('course_id, courses ( name )').eq('id', studentRow.batch_id).single()
                : Promise.resolve({ data: null }),
            studentRow.institute_id
                ? admin.from('institutes').select('name, city').eq('id', studentRow.institute_id).single()
                : Promise.resolve({ data: null }),
        ]);

        const profile = {
            name: studentRow.name ?? '',
            photo_url: studentRow.photo_url ?? null,
            enrollment_number: studentRow.enrollment_number ?? '',
            course_name: (batchRes.data as any)?.courses?.name ?? '—',
            institute_name: (instRes.data as any)?.name ?? '—',
            institute_city: (instRes.data as any)?.city ?? '',
        };

        // DB columns: accuracy_percentage, time_spent_seconds, mistakes_count
        // practice_type values: 'keyboard', 'speed', 'letter', 'statement', 'email', 'mcq'
        const { data: sessions, error } = await admin
            .from('student_practice_sessions')
            .select('id, practice_type, wpm, accuracy_percentage, completed_at')
            .eq('student_id', user.id)
            .order('completed_at', { ascending: false });
        if (error) throw error;

        // Calculate stats — speed & keyboard types have WPM
        const speedSessions = (sessions ?? []).filter(
            s => s.practice_type === 'speed' || s.practice_type === 'keyboard'
        );
        const avgWpm = speedSessions.length > 0
            ? Math.round(speedSessions.reduce((acc, s) => acc + (s.wpm || 0), 0) / speedSessions.length)
            : 0;
        const avgAcc = (sessions ?? []).length > 0
            ? Math.round((sessions ?? []).reduce((acc, s) => acc + Number(s.accuracy_percentage || 0), 0) / (sessions ?? []).length)
            : 0;

        // Normalise for the dashboard UI (maps DB column names → frontend field names)
        const normalisedSessions = (sessions ?? []).slice(0, 5).map(s => ({
            id: s.id,
            practice_type: s.practice_type,
            wpm: s.wpm ?? 0,
            accuracy: Number(s.accuracy_percentage ?? 0),
            score_percent: Number(s.accuracy_percentage ?? 0),
            completed_at: s.completed_at,
        }));

        return NextResponse.json({
            profile,
            sessions: normalisedSessions,
            stats: { avgWpm, avgAcc, totalSessions: (sessions ?? []).length },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
