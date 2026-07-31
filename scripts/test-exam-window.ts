/**
 * Run: node --experimental-strip-types scripts/test-exam-window.ts
 * Fails loudly if the exam scheduling-window rules regress.
 */
import assert from 'node:assert/strict';
import { examGate, isExamExpired } from '../src/utils/examWindow.ts';

// Exam on 25 Jul 2026, 10:00–10:50 IST
const exam = {
    exam_date: '2026-07-25',
    start_time: '2026-07-25T10:00:00+05:30',
    end_time: '2026-07-25T10:50:00+05:30',
    status: 'scheduled',
};
const at = (iso: string) => Date.parse(iso);

// ── the reported bug: next day, still startable ──────────────────────────────
assert.equal(isExamExpired(exam, at('2026-07-26T09:00:00+05:30')), true, 'day after = expired');
assert.equal(examGate(exam, at('2026-07-26T09:00:00+05:30')), 'expired');

// ── inside / outside the slot on the exam day ────────────────────────────────
assert.equal(examGate(exam, at('2026-07-25T09:59:59+05:30')), 'not_started');
assert.equal(examGate(exam, at('2026-07-25T10:00:00+05:30')), 'ok', 'exactly at start');
assert.equal(examGate(exam, at('2026-07-25T10:50:00+05:30')), 'ok', 'exactly at end');
assert.equal(examGate(exam, at('2026-07-25T10:50:01+05:30')), 'expired', 'past slot end');

// ── day-level expiry boundary is IST midnight, not UTC ───────────────────────
assert.equal(isExamExpired(exam, at('2026-07-25T23:59:59+05:30')), false, 'last second of IST day');
assert.equal(isExamExpired(exam, at('2026-07-26T00:00:01+05:30')), true, 'first second of next IST day');
// 25 Jul 20:00 UTC = 26 Jul 01:30 IST → expired even though the UTC day matches
assert.equal(isExamExpired(exam, at('2026-07-25T20:00:00Z')), true, 'UTC-day trap');
// 25 Jul 02:00 UTC = 25 Jul 07:30 IST → NOT expired even though 24 Jul in US zones
assert.equal(isExamExpired(exam, at('2026-07-25T02:00:00Z')), false, 'early IST morning');

// ── an in-progress exam survives past end_time (Section 3 has no fixed timer) ─
const running = { ...exam, status: 'in_progress' };
assert.equal(isExamExpired(running, at('2026-07-25T11:40:00+05:30')), false, 'still same day');
assert.equal(isExamExpired(running, at('2026-07-26T11:40:00+05:30')), true, 'next day kills it');

// ── finished exams are history, never "expired" ──────────────────────────────
assert.equal(isExamExpired({ ...exam, status: 'completed' }, at('2027-01-01T00:00:00Z')), false);
assert.equal(isExamExpired({ ...exam, status: 'cancelled' }, at('2027-01-01T00:00:00Z')), false);

// ── missing columns must not silently expire everything ──────────────────────
assert.equal(isExamExpired({ status: 'scheduled' }, at('2026-07-26T09:00:00+05:30')), false, 'no date = no expiry');
assert.equal(examGate({ exam_date: '2026-07-25', status: 'scheduled' }, at('2026-07-25T03:00:00+05:30')), 'ok',
    'no start/end times = open all day');

console.log('exam-window rules OK');
