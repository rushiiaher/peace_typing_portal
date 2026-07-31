/**
 * Verify the exam-window helpers against REAL rows in the database.
 *
 * The unit check (test-exam-window.ts) proves the rules are correct for the
 * shape I assumed. This proves the DB actually has that shape — specifically
 * that exams.exam_date is a DATE column serialised as "YYYY-MM-DD". If it is
 * a timestamp instead, endOfExamDayMs() would return null and every exam
 * would silently stay un-expired.
 *
 * Run: node --experimental-strip-types scripts/verify-exam-expiry.ts
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { endOfExamDayMs, isExamExpired, examGate } from '../src/utils/examWindow.ts';

const envPath = path.join(import.meta.dirname, '..', '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const now = Date.now();
const istNow = new Date(now).toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' });

async function main() {
    const { data: exams, error } = await supabase
        .from('exams')
        .select('id, exam_date, start_time, end_time, status, attendance_status')
        .order('exam_date', { ascending: false })
        .limit(500);

    if (error) throw error;
    if (!exams?.length) { console.log('No exams in DB — nothing to verify.'); return; }

    console.log(`Server now: ${new Date(now).toISOString()}  (IST ${istNow})`);
    console.log(`Rows fetched: ${exams.length}\n`);

    // ── 1. Column shape ──────────────────────────────────────────────────────
    const sample = exams.find(e => e.exam_date) ?? exams[0];
    console.log('exam_date  typeof =', typeof sample.exam_date, '| raw =', JSON.stringify(sample.exam_date));
    console.log('start_time typeof =', typeof sample.start_time, '| raw =', JSON.stringify(sample.start_time));
    console.log('end_time   typeof =', typeof sample.end_time, '| raw =', JSON.stringify(sample.end_time));

    const dated = exams.filter(e => e.exam_date);
    const unparseable = dated.filter(e => endOfExamDayMs(e) === null);
    console.log(`\nRows with exam_date: ${dated.length} | endOfExamDayMs() null (BAD): ${unparseable.length}`);
    if (unparseable.length) {
        console.log('  !! FAIL — these would never expire:', unparseable.slice(0, 5).map(e => e.exam_date));
        process.exitCode = 1;
        return;
    }

    // ── 2. What the fix actually changes ─────────────────────────────────────
    const open = exams.filter(e => e.status === 'scheduled' || e.status === 'in_progress');
    const nowExpired = open.filter(e => isExamExpired(e, now));
    const stillLive = open.filter(e => !isExamExpired(e, now));

    console.log(`\nOpen exams (scheduled|in_progress): ${open.length}`);
    console.log(`  → newly treated as EXPIRED (were startable before this fix): ${nowExpired.length}`);
    console.log(`  → still live: ${stillLive.length}`);

    console.log('\nSample of newly-expired (should all be past dates):');
    for (const e of nowExpired.slice(0, 8)) {
        console.log(`  ${e.exam_date}  status=${e.status}  attendance=${e.attendance_status}  gate=${examGate(e, now)}`);
    }

    console.log('\nStill-live exams (should all be today or future):');
    for (const e of stillLive.slice(0, 8)) {
        console.log(`  ${e.exam_date}  status=${e.status}  gate=${examGate(e, now)}`);
    }

    // ── 3. Invariants ────────────────────────────────────────────────────────
    const todayIST = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const wrongExpired = nowExpired.filter(e => e.exam_date >= todayIST);
    const wrongLive = stillLive.filter(e => e.exam_date && e.exam_date < todayIST);
    const finished = exams.filter(e => e.status === 'completed' || e.status === 'cancelled');
    const wrongFinished = finished.filter(e => isExamExpired(e, now));

    console.log(`\nToday (IST): ${todayIST}`);
    console.log(`Expired but dated today/future (must be 0): ${wrongExpired.length}`);
    console.log(`Live but dated in the past    (must be 0): ${wrongLive.length}`);
    console.log(`completed/cancelled marked expired (must be 0): ${wrongFinished.length}`);

    const ok = !wrongExpired.length && !wrongLive.length && !wrongFinished.length;
    console.log(ok ? '\nPASS — helper matches real data.' : '\nFAIL — see counts above.');
    if (!ok) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
