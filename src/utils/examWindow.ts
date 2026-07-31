/**
 * Exam scheduling-window rules — the single source of truth for
 * "may this student see / start / resume this exam right now?".
 *
 * Every API route calls these with the SERVER clock (default `Date.now()`),
 * so a manipulated client clock cannot open a closed exam. The student pages
 * call them with a server-corrected clock purely to render the right label.
 *
 * Two distinct rules, deliberately different:
 *   - isExamExpired()  → day-level. Once the exam DATE is over, the exam is
 *     dead: hidden from Upcoming, not resumable, direct URL blocked.
 *   - examGate()       → slot-level. Starting requires now to be inside
 *     [start_time, end_time]. NOT applied to an already-running exam, because
 *     Section 3 has a dynamic timer and may legitimately run past end_time.
 */

export const EXPIRED_MESSAGE = 'This exam has expired.';

export type ExamGate = 'ok' | 'not_started' | 'expired';

export interface ExamWindowFields {
    exam_date?: string | null;   // DATE column, "YYYY-MM-DD" in IST
    start_time?: string | null;  // TIMESTAMPTZ ISO — scheduled start
    end_time?: string | null;    // TIMESTAMPTZ ISO — scheduled slot end
    status?: string | null;
}

/** Last millisecond of the exam's calendar day, in IST. Null if undated. */
export function endOfExamDayMs(exam: ExamWindowFields): number | null {
    const dateStr = exam.exam_date
        ?? (exam.start_time
            ? new Date(exam.start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            : null);
    if (!dateStr) return null;
    const ms = Date.parse(`${dateStr}T23:59:59.999+05:30`);
    return Number.isNaN(ms) ? null : ms;
}

/**
 * True once the exam day is over and the exam was never taken.
 * Completed/cancelled exams are history, not expired — they keep their status.
 */
export function isExamExpired(exam: ExamWindowFields, nowMs: number = Date.now()): boolean {
    if (exam.status === 'completed' || exam.status === 'cancelled') return false;
    const end = endOfExamDayMs(exam);
    return end !== null && nowMs > end;
}

/** Whether the student may START the exam right now. */
export function examGate(exam: ExamWindowFields, nowMs: number = Date.now()): ExamGate {
    if (isExamExpired(exam, nowMs)) return 'expired';

    const start = exam.start_time ? Date.parse(exam.start_time) : NaN;
    if (!Number.isNaN(start) && nowMs < start) return 'not_started';

    const end = exam.end_time ? Date.parse(exam.end_time) : NaN;
    if (!Number.isNaN(end) && nowMs > end) return 'expired';

    return 'ok';
}
