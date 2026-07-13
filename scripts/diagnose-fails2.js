/** Deep dump: timestamps + which sections actually saved. */
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
    const date = process.argv[2] || '2026-07-13';
    const { data: exams, error } = await supabase
        .from('exams')
        .select('id, exam_date, start_time, end_time, status, result, attendance_status, students(name)')
        .eq('exam_date', date)
        .eq('status', 'completed');
    if (error) { console.error(error.message); process.exit(1); }

    for (const e of exams ?? []) {
        const { data: a } = await supabase
            .from('exam_answers')
            .select('*')
            .eq('exam_id', e.id)
            .maybeSingle();

        console.log('─'.repeat(70));
        console.log(`${e.students?.name}  att=${e.attendance_status}  result=${e.result}`);
        console.log(`  exams: start=${e.start_time} end=${e.end_time}`);
        if (!a) { console.log('  NO exam_answers row'); continue; }
        console.log(`  answers: created=${a.created_at} updated=${a.updated_at} submitted=${a.submitted_at}`);
        console.log(`  s1: mcq_answers=${a.mcq_answers ? 'YES(' + Object.keys(a.mcq_answers).length + ')' : 'null'} email=${a.email_content ? 'YES' : 'null'}`);
        console.log(`  s2: letter=${a.letter_html != null ? `YES(len=${String(a.letter_html).length})` : 'null'} stmt=${a.statement_grid != null ? 'YES' : 'null'}`);
        console.log(`  s3: wpm=${a.speed_wpm} acc=${a.speed_accuracy} req=${a.speed_required_wpm} passed=${a.speed_passed} overall=${a.overall_result}`);
        const cols = Object.keys(a).filter(k => k.startsWith('speed_'));
        console.log(`  speed cols present in row: ${cols.join(', ')}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
