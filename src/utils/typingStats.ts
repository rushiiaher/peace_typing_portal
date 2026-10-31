/**
 * Word-based typing statistics.
 *
 * Mistakes are counted per WORD (standard for typing exams like GCC-TBC).
 * Typed words are ALIGNED to the passage with a word-level edit distance, so a
 * skipped, extra, split or merged word costs only the words involved — it does
 * not shift and fail every word after it.
 *
 * Words are compared in canonical form (see marathiText.ts): Kruti Dev and
 * Unicode Marathi, curly/straight quotes, Devanagari/ASCII digits and
 * zero-width characters all compare equal.
 *
 * Rules:
 * - Words are whitespace-separated tokens.
 * - mistakes = wrong words + extra typed words + passage words skipped in the
 *   typed range. Untyped passage remainder is NOT a mistake.
 * - While typing (live), the in-progress last word is only a mistake if it is
 *   not a prefix of its target (never, for Marathi: Kruti types ि and reph out
 *   of visual order, so a partial word is not comparable).
 * - Accuracy = correct / (correct + mistakes) × 100 (100 when nothing typed).
 */
import { canonicalWord, hasDevanagari } from './marathiText';

export interface WordStats {
    typedWordCount: number;
    correctWords: number;
    mistakes: number;
    accuracy: number; // 0–100
}

export type WordState = 'correct' | 'wrong' | 'current' | 'pending';

export interface TypingOpts {
    final?: boolean;
    /** Marathi course: enables Kruti Dev ⇄ Unicode equivalence. Auto-on if passage has Devanagari. */
    marathi?: boolean;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export function analyzeTyping(typed: string, passage: string, opts: TypingOpts = {}): { stats: WordStats; states: WordState[] } {
    const marathi = !!opts.marathi || hasDevanagari(passage);
    const canon = (w: string) => canonicalWord(w, marathi);
    const P = words(passage).map(canon);
    const typedRaw = words(typed);
    const T = typedRaw.map(canon);
    const partial = !opts.final && T.length > 0 && !/\s$/.test(typed) ? T.pop()! : null;

    // Edit distance of T against a passage prefix. A student can't be further
    // than (typed words + 50 skipped) into the passage, so cap the columns.
    // ponytail: O(n·m) per call (~200k cells for a 400-word passage); band it if passages get much longer.
    const n = T.length, m = Math.min(P.length, n + 50), W = m + 1;
    const D = new Uint32Array((n + 1) * W);
    for (let j = 0; j <= m; j++) D[j] = j;
    for (let i = 1; i <= n; i++) {
        D[i * W] = i;
        for (let j = 1; j <= m; j++) {
            D[i * W + j] = Math.min(
                D[(i - 1) * W + j - 1] + (T[i - 1] === P[j - 1] ? 0 : 1), // match / wrong word
                D[i * W + j - 1] + 1,                                       // passage word skipped
                D[(i - 1) * W + j] + 1,                                     // extra typed word
            );
        }
    }
    // Free trailing passage words: best end column (ties → furthest).
    let end = 0;
    for (let j = 1; j <= m; j++) if (D[n * W + j] <= D[n * W + end]) end = j;

    const states: WordState[] = P.map(() => 'pending');
    let correctWords = 0, mistakes = 0;
    for (let i = n, j = end; i > 0 || j > 0;) {
        const cur = D[i * W + j];
        if (i > 0 && j > 0 && cur === D[(i - 1) * W + j - 1] + (T[i - 1] === P[j - 1] ? 0 : 1)) {
            if (T[i - 1] === P[j - 1]) { states[j - 1] = 'correct'; correctWords++; }
            else { states[j - 1] = 'wrong'; mistakes++; }
            i--; j--;
        } else if (j > 0 && cur === D[i * W + j - 1] + 1) {
            states[j - 1] = 'wrong'; mistakes++; j--;   // skipped
        } else {
            mistakes++; i--;                             // extra
        }
    }

    if (partial !== null) {
        const target = P[end];
        const ok = target != null && (marathi || target.startsWith(partial));
        if (!ok) mistakes++;
        if (target != null) states[end] = ok ? 'current' : 'wrong';
    } else if (end < P.length) {
        states[end] = 'current';
    }

    const judged = correctWords + mistakes;
    const accuracy = judged > 0 ? Math.round((correctWords / judged) * 100) : 100;
    return { stats: { typedWordCount: typedRaw.length, correctWords, mistakes, accuracy }, states };
}

export function computeWordStats(typed: string, passage: string, opts?: TypingOpts): WordStats {
    return analyzeTyping(typed, passage, opts).stats;
}

/** Per-word states for rendering the reference passage overlay (index-aligned with whitespace-split passage words). */
export function getWordStates(typed: string, passage: string, opts?: TypingOpts): WordState[] {
    return analyzeTyping(typed, passage, opts).states;
}

/** Colour palette shared by exam + practice overlays */
export const WORD_STATE_STYLE: Record<WordState, { color: string; background: string }> = {
    correct: { color: '#16a34a', background: 'transparent' },
    wrong:   { color: '#dc2626', background: '#fee2e2' },
    current: { color: '#1d4ed8', background: '#dbeafe' },
    pending: { color: '#94a3b8', background: 'transparent' },
};
