/**
 * IST-explicit date/time formatters.
 * All functions are timezone-safe — no dependency on browser/server locale.
 */

const TZ = 'Asia/Kolkata';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_LONG    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Format a DATE column string ("YYYY-MM-DD") — no timezone conversion needed.
 * Returns e.g. "21 May 2026"
 */
export function fmtDateIST(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parts[0];
    return `${d} ${MONTHS_SHORT[m]} ${y}`;
}

/**
 * Format a DATE column string with full month and day name.
 * Returns e.g. "21 May 2026 (Thursday)"
 */
export function fmtDateLongIST(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[0], 10);
    // Build a local-midnight Date to get day-of-week (avoids UTC vs local shift)
    const dt = new Date(y, m, d);
    const dayName = DAYS_LONG[dt.getDay()];
    return `${d} ${MONTHS_LONG[m]} ${y} (${dayName})`;
}

/**
 * Format a TIMESTAMPTZ ISO string as time in IST.
 * Returns e.g. "10:00 AM"
 */
export function fmtTimeIST(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ,
    });
}

/**
 * Format a TIMESTAMPTZ ISO string as date in IST.
 * Useful when only a timestamp is available (no separate exam_date column).
 * Returns e.g. "21 May 2026"
 */
export function fmtDateFromTsIST(isoStr: string | null | undefined): string {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ,
    });
}

/**
 * Today's date as "YYYY-MM-DD" in IST — for filtering exam_date columns.
 */
export function todayIST(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // en-CA gives YYYY-MM-DD
}
