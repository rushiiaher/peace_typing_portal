/**
 * Reset rescheduled-but-still-completed exams for retake.
 *
 * Scope (safe): exams with the given exam_date, status='completed', whose
 * exam_answers has NO speed data (speed_wpm null) — i.e. crash-era attempts
 * that were rescheduled before the retake-reset fix deployed.
 *
 * Resets: status='scheduled', result/marks/grade null, certificate off,
 * attendance 'pending'; deletes the old exam_answers row.
 *
 * Run: node scripts/reset-rescheduled.js 2026-07-14
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    const date = process.argv[2];
    if (!date) { console.error('Usage: node scripts/reset-rescheduled.js YYYY-MM-DD'); process.exit(1); }

    const { data: exams, error } = await supabase
        .from('exams')
        .select('id, exam_date, start_time, status, result, students(name, enrollment_number), exam_answers(id, speed_wpm)')
        .eq('exam_date', date)
        .eq('status', 'completed');
    if (error) { console.error(error.message); process.exit(1); }

    // Only crash-era attempts: no speed data recorded
    const targets = (exams ?? []).filter(e => {
        const a = Array.isArray(e.exam_answers) ? e.exam_answers[0] : e.exam_answers;
        return !a || a.speed_wpm == null;
    });

    if (!targets.length) { console.log('Nothing to reset.'); return; }

    console.log(`Resetting ${targets.length} exam(s) on ${date}:`);
    for (const e of targets) {
        console.log(`  - ${e.students?.name} (${e.students?.enrollment_number})`);
    }

    const ids = targets.map(e => e.id);

    const { error: delErr } = await supabase.from('exam_answers').delete().in('exam_id', ids);
    if (delErr) { console.error('answers delete failed:', delErr.message); process.exit(1); }

    const { error: updErr } = await supabase
        .from('exams')
        .update({
            status: 'scheduled',
            result: null,
            total_marks_obtained: null,
            grade: null,
            certificate_generated: false,
            attendance_status: 'pending',
        })
        .in('id', ids);
    if (updErr) { console.error('exams update failed:', updErr.message); process.exit(1); }

    console.log(`\nDone. ${ids.length} exam(s) reset to 'scheduled' with attendance 'pending'.`);
    console.log('Institute must mark students Present on exam day before they can start.');
}

main().catch(e => { console.error(e); process.exit(1); });
