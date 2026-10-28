import type { SyntheticEvent } from 'react';

const stop = (e: SyntheticEvent) => e.preventDefault();

/**
 * Spread onto a student typing editor (or its wrapper — paste/drop bubble).
 * Blocks Ctrl/Cmd+V, context-menu paste and drag-and-drop text so metrics
 * reflect what the student actually typed. Typing, backspace, selection and
 * in-editor copy/cut stay untouched.
 */
export const blockPasteProps = { onPaste: stop, onDrop: stop };
