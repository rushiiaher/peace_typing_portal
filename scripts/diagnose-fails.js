/**
 * Diagnose why recent exams failed.
 * Dumps exam_answers speed/mcq stats + result_breakdown for completed exams
 * on a given date (default: 2026-07-13).
 *
 * Run: node scripts/diagnose-fails.js [YYYY-MM-DD]
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
    const date = process.argv[2] || '2026-07-13';
    console.log(`Exams on ${date} (completed):\n`);

    const { data: exams, error } = await supabase
        .from('exams')
        .select(`
            id, exam_date, result, total_marks_obtained, grade, status,
            students ( name, enrollment_number ),
            courses ( name, passing_criteria_wpm ),
            exam_answers ( mcq_marks_obtained, mcq_correct_count, mcq_total_count,
                           speed_wpm, speed_accuracy, speed_mistakes, speed_time_spent,
                           speed_required_wpm, speed_passed, overall_result, result_breakdown )
        `)
        .eq('exam_date', date)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

    if (error) { console.error('Error:', error.message); process.exit(1); }
    if (!exams?.length) { console.log('No completed exams found on this date.'); return; }

    for (const e of exams) {
        const a = Array.isArray(e.exam_answers) ? e.exam_answers[0] : e.exam_answers;
        const s = e.students;
        console.log('─'.repeat(72));
        console.log(`${s?.name ?? '?'} (${s?.enrollment_number ?? '?'})  course=${e.courses?.name} reqWPM=${e.courses?.passing_criteria_wpm}`);
        console.log(`  exams.result=${e.result}  marks=${e.total_marks_obtained}  grade=${e.grade}`);
        if (!a) { console.log('  !! NO exam_answers row'); continue; }
        console.log(`  MCQ: ${a.mcq_correct_count}/${a.mcq_total_count} → marks=${a.mcq_marks_obtained}`);
        console.log(`  SPEED: wpm=${a.speed_wpm} acc=${a.speed_accuracy}% mistakes=${a.speed_mistakes} timeSpent=${a.speed_time_spent}s reqWpm=${a.speed_required_wpm} passed=${a.speed_passed}`);
        console.log(`  overall=${a.overall_result} breakdown=${JSON.stringify(a.result_breakdown)}`);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
