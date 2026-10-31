/**
 * Marathi text canonicalisation for typing comparison.
 *
 * Marathi content in this portal exists in two encodings:
 *  - Kruti Dev 010 (legacy): plain ASCII/Latin-1 keystrokes drawn as Devanagari by the font
 *  - Unicode Devanagari
 * and students may type with either. Comparing raw strings therefore fails on
 * every word. canonicalWord() maps both forms to the same Unicode string so
 * scoring is encoding-independent. It is for COMPARISON only — never store its output.
 */

// Kruti Dev 010 → Unicode. Matched longest-key-first in ONE pass, so ASCII
// outputs ("," "." "?") are never re-mapped by a later rule.
// Half-forms + "k" (e.g. "Dk", "'k") are not listed: half-letter "्" followed
// by "ा" is collapsed to the full letter afterwards.
const KRUTI_MAP: Record<string, string> = {
    // independent vowels
    'v‚': 'ऑ', 'vks': 'ओ', 'vkS': 'औ', 'vk': 'आ', 'v': 'अ',
    'bZ': 'ई', 'b': 'इ', 'm': 'उ', 'Å': 'ऊ', ',s': 'ऐ', ',': 'ए', '_': 'ऋ',
    // conjuncts / special glyphs
    '{': 'क्ष्', '=': 'त्र', '«': 'त्र्', 'K': 'ज्ञ', 'J': 'श्र',
    'Ø': 'क्र', 'ç': 'प्र', 'Ý': 'फ्र', 'æ': 'द्र', '#': 'रु', ':': 'रू',
    '|': 'द्य', '}': 'द्व', 'í': 'द्द', ')': 'द्ध', 'Ù': 'त्त्', 'ä': 'क्त',
    '–': 'दृ', '—': 'कृ', 'é': 'न्न', '™': 'न्न्',
    'à': 'ह्न', 'á': 'ह्य', 'â': 'हृ', 'ã': 'ह्म', 'º': 'ह्',
    'ê': 'ट्ट', 'ë': 'ट्ठ', 'ì': 'ड्ड', 'ï': 'ड्ढ', 'î': '्य', 'ª': '्र',
    // consonants (lower = full, upper = half where Kruti has one)
    'd': 'क', 'D': 'क्', '[': 'ख्', 'x': 'ग', 'X': 'ग्', '?': 'घ्', '³': 'ङ',
    'p': 'च', 'P': 'च्', 'N': 'छ', 't': 'ज', 'T': 'ज्', '>': 'झ', '÷': 'झ्', '¥': 'ञ',
    'V': 'ट', 'B': 'ठ', 'M': 'ड', '<': 'ढ', '.': 'ण्',
    'r': 'त', 'R': 'त्', 'F': 'थ्', 'n': 'द', '/': 'ध्', 'è': 'ध्',
    'u': 'न', 'U': 'न्', 'i': 'प', 'I': 'प्', 'Q': 'फ', '¶': 'फ्',
    'c': 'ब', 'C': 'ब्', 'H': 'भ्', 'e': 'म', 'E': 'म्', ';': 'य', '¸': 'य्',
    'j': 'र', 'y': 'ल', 'Y': 'ल्', 'G': 'ळ', 'o': 'व', 'O': 'व्',
    "'": 'श्', '"': 'ष्', 'l': 'स', 'L': 'स्', 'g': 'ह',
    // vowel signs & marks
    'ks': 'ो', 'kS': 'ौ', '‚': 'ॉ', 'k': 'ा', 'h': 'ी', 'q': 'ु', 'w': 'ू', '`': 'ृ',
    's': 'े', 'S': 'ै', 'a': 'ं', '¡': 'ँ', '%': 'ः', 'W': 'ॅ', '~': '्', 'z': '्र',
    '+': '़', '±': 'Zं', // Z = reph, resolved below
    // digits
    'å': '०', 'ƒ': '१', '„': '२', '…': '३', '†': '४', '‡': '५', 'ˆ': '६', '‰': '७', 'Š': '८', '‹': '९',
    // punctuation
    'A': '।', '-': '.', ']': ',', '&': '-', '\\': '?', '(': ';', '¼': '(', '½': ')',
    '¿': '{', 'À': '}', '¾': '=', '@': '/', '^': '‘', '*': '’', 'Þ': '“', 'ß': '”', 'Œ': '॰',
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KRUTI_RE = new RegExp(
    Object.keys(KRUTI_MAP).sort((a, b) => b.length - a.length).map(esc).join('|'), 'g');

const CONS = '[\\u0915-\\u0939\\u0958-\\u095F\\u0933]';
const SIGNS = '[\\u093E-\\u094C\\u0901-\\u0903\\u093C\\u0945\\u0949]'; // matras, ं ँ ः ़ ॅ ॉ
// f + consonant cluster (C(़)?(्C(़)?)*) → cluster + ि
const F_RE = new RegExp(`f(${CONS}\\u093C?(?:\\u094D${CONS}\\u093C?)*)`, 'g');
// cluster + signs + Z → र् + cluster + signs
const REPH_RE = new RegExp(`(${CONS}\\u093C?(?:\\u094D${CONS}\\u093C?)*)(${SIGNS}*)Z`, 'g');

export function krutiToUnicode(s: string): string {
    return s
        .replace(KRUTI_RE, m => KRUTI_MAP[m])
        .replace(/्ा/g, '')              // half + ा  → full letter  (Dk → क)
        .replace(/्([ोौॉ])/g, '$1') // half + ो/ौ/ॉ → full + sign
        .replace(F_RE, '$1ि')                  // pre-base ि
        .replace(REPH_RE, 'र्$1$2')                  // reph
        .replace(/[fZ]/g, '');                      // stray markers
}

const DEVANAGARI = /[ऀ-ॿ]/;
const HAS_LETTER = /[A-Za-z\u0080-ÿ–—‘-„†-‰ŒŠˆ™ƒ]/;
// Unambiguous Kruti punctuation for punctuation-only tokens
const KRUTI_PUNCT: Record<string, string> = { ']': ',', '\\': '?', '¼': '(', '½': ')', 'A': '।' };

const straighten = (s: string) => s.replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"');

/** Canonical form of ONE whitespace-delimited token, for comparison only. */
export function canonicalWord(word: string, marathi: boolean): string {
    let w = straighten(word.replace(/[​-‍⁠﻿­]/g, ''));
    if (marathi && !DEVANAGARI.test(w)) {
        w = HAS_LETTER.test(w) ? krutiToUnicode(w) : w.replace(/[\]\\¼½]/g, c => KRUTI_PUNCT[c]);
    }
    w = straighten(w).normalize('NFC');
    if (marathi) {
        w = w
            .replace(/[०-९]/g, d => String(d.charCodeAt(0) - 0x0966)) // ० → 0
            .replace(/।/g, '.')   // । → .
            .replace(/ऱ/g, 'र');  // ऱ (eyelash ra) → र
    }
    return w;
}

export const hasDevanagari = (s: string) => DEVANAGARI.test(s);
