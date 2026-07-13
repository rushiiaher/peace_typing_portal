/**
 * Word-based typing statistics.
 *
 * Mistakes are counted per WORD (standard for typing exams like GCC-TBC),
 * not per character index. A single skipped/extra character therefore costs
 * one word — it no longer misaligns the rest of the passage and crater the
 * accuracy score.
 *
 * Rules:
 * - Words are whitespace-separated tokens.
 * - Word i of the typed text is compared to word i of the passage.
 * - While typing (live), the in-progress last word is only a mistake if it
 *   is not a prefix of the target word.
 * - On final submission every typed word is compared as complete.
 * - Extra words typed beyond the passage each count as one mistake.
 * - Accuracy = correct words / typed words × 100 (100 when nothing typed).
 */

export interface WordStats {
    typedWordCount: number;
    correctWords: number;
    mistakes: number;
    accuracy: number; // 0–100
}

export function computeWordStats(typed: string, passage: string, opts?: { final?: boolean }): WordStats {
    const passageWords = passage.trim().split(/\s+/).filter(Boolean);
    const typedWords = typed.trim().split(/\s+/).filter(Boolean);
    const endsWithSpace = /\s$/.test(typed);
    const finalMode = opts?.final ?? false;

    let mistakes = 0;
    let correctWords = 0;

    typedWords.forEach((w, i) => {
        const target = passageWords[i];
        if (target == null) { mistakes++; return; } // typed beyond the passage
        const isLastPartial = !finalMode && i === typedWords.length - 1 && !endsWithSpace;
        if (isLastPartial) {
            // In-progress word: wrong only if it can no longer match
            if (!target.startsWith(w)) mistakes++;
        } else {
            if (w === target) correctWords++;
            else mistakes++;
        }
    });

    const typedWordCount = typedWords.length;
    const accuracy = typedWordCount > 0
        ? Math.round(((typedWordCount - mistakes) / typedWordCount) * 100)
        : 100;

    return { typedWordCount, correctWords, mistakes, accuracy: Math.max(0, accuracy) };
}

export type WordState = 'correct' | 'wrong' | 'current' | 'pending';

/**
 * Per-word states for rendering the reference passage overlay.
 * Index-aligned with the passage's words (whitespace-split).
 */
export function getWordStates(typed: string, passage: string): WordState[] {
    const passageWords = passage.trim().split(/\s+/).filter(Boolean);
    const typedWords = typed.trim().split(/\s+/).filter(Boolean);
    const endsWithSpace = /\s$/.test(typed);

    return passageWords.map((target, i) => {
        if (typedWords.length === 0) return i === 0 ? 'current' : 'pending';
        const lastIdx = typedWords.length - 1;
        if (i < lastIdx || (i === lastIdx && endsWithSpace)) {
            return typedWords[i] === target ? 'correct' : 'wrong';
        }
        if (i === lastIdx) {
            // in-progress word
            return target.startsWith(typedWords[i]) ? 'current' : 'wrong';
        }
        if (i === typedWords.length && endsWithSpace) return 'current';
        return 'pending';
    });
}

/** Colour palette shared by exam + practice overlays */
export const WORD_STATE_STYLE: Record<WordState, { color: string; background: string }> = {
    correct: { color: '#16a34a', background: 'transparent' },
    wrong:   { color: '#dc2626', background: '#fee2e2' },
    current: { color: '#1d4ed8', background: '#dbeafe' },
    pending: { color: '#94a3b8', background: 'transparent' },
};
