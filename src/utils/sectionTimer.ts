/**
 * Seconds left in an exam section, anchored to the first time the section was
 * opened on this browser — so a page refresh no longer restarts the clock.
 * ponytail: per-browser (localStorage); store section start on the server if
 * students switch machines mid-exam.
 */
export function sectionSecondsLeft(key: string | undefined, totalSecs: number): number {
    if (!key || typeof window === 'undefined') return totalSecs;
    const k = `exam-section-start:${key}`;
    let start = Number(localStorage.getItem(k));
    if (!start) { start = Date.now(); localStorage.setItem(k, String(start)); }
    return Math.max(0, totalSecs - Math.floor((Date.now() - start) / 1000));
}
