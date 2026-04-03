'use client';

import { useState, useEffect, useRef, useCallback, MutableRefObject } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Alert, Button, IconButton, Divider, Select, MenuItem } from '@mui/material';
import {
    ArrowBack, Replay, CheckCircle,
    FormatBold, FormatItalic, FormatUnderlined,
    FormatAlignLeft, FormatAlignCenter, FormatAlignRight, FormatAlignJustify,
    Undo, Redo,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterParts {
    letterhead?: string;
    sender_address?: string;
    ref_number?: string;
    date?: string;
    receiver_address?: string;
    subject?: string;
    reference_line?: string;
    salutation?: string;
    body_para_1?: string;
    body_para_2?: string;
    body_para_3?: string;
    complimentary_close?: string;
    subscription?: string;
    designation?: string;
    enclosure?: string;
}

interface Template {
    id: string;
    title: string;
    category: string | null;
    template_content: string;
    sample_content: string | null;
    attempted: boolean;
    best_accuracy: number | null;
    best_wpm: number | null;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

/** Build flat expected text from letter parts in correct postal order */
function buildExpectedText(p: LetterParts): string {
    const lines: string[] = [];
    if (p.letterhead) lines.push(p.letterhead, '');
    if (p.sender_address) lines.push(p.sender_address, '');
    if (p.ref_number || p.date) {
        const left = p.ref_number ? `Ref. No : ${p.ref_number}` : '';
        const right = p.date ? `Date : ${p.date}` : '';
        if (left && right) lines.push(`${left}                    ${right}`);
        else lines.push(left || right);
        lines.push('');
    }
    lines.push('To,');
    if (p.receiver_address) lines.push(p.receiver_address, '');
    if (p.subject) lines.push(`Subject : ${p.subject}`);
    if (p.reference_line) lines.push(`Reference : ${p.reference_line}`);
    if (p.subject || p.reference_line) lines.push('');
    if (p.salutation) lines.push(p.salutation, '');
    if (p.body_para_1) lines.push(p.body_para_1, '');
    if (p.body_para_2) lines.push(p.body_para_2, '');
    if (p.body_para_3) lines.push(p.body_para_3, '');
    if (p.complimentary_close) lines.push(p.complimentary_close, '');
    if (p.subscription) lines.push(p.subscription);
    if (p.designation) lines.push(p.designation, '');
    if (p.enclosure) lines.push(`Encl. : ${p.enclosure}`);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Left pane: formatted letter renderer ─────────────────────────────────────

function LetterPage({ p, isMarathi }: { p: LetterParts; isMarathi: boolean }) {
    const ff = isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Calibri, "Segoe UI", sans-serif';
    const fs = isMarathi ? '16pt' : '11pt';
    return (
        <div style={{ fontFamily: ff, fontSize: fs, lineHeight: 1.6, color: '#111' }}>
            {p.letterhead && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    {p.letterhead.split('\n').map((line, i) => (
                        <div key={i} style={{
                            fontWeight: 'bold', textDecoration: i === 0 ? 'underline' : 'none',
                            textTransform: 'uppercase', fontSize: '14pt',
                        }}>{line}</div>
                    ))}
                </div>
            )}
            {p.sender_address && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    {p.sender_address.split('\n').map((line, i) => (
                        <div key={i} style={{ fontSize: '11pt' }}>{line}</div>
                    ))}
                </div>
            )}
            {(p.ref_number || p.date) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    {p.ref_number && <span style={{ fontWeight: 'bold' }}>Ref. No : {p.ref_number}</span>}
                    {p.date && <span style={{ fontWeight: 'bold' }}>Date : {p.date}</span>}
                </div>
            )}
            <div style={{ marginBottom: 4, fontWeight: 'bold' }}>To,</div>
            {p.receiver_address && (
                <div style={{ marginBottom: 20 }}>
                    {p.receiver_address.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}
            {p.subject && (
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: 4, textAlign: 'center' }}>
                    Subject : {p.subject}
                </div>
            )}
            {p.reference_line && (
                <div style={{ fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                    Reference : {p.reference_line}
                </div>
            )}
            {p.salutation && <div style={{ marginBottom: 12 }}>{p.salutation}</div>}
            {[p.body_para_1, p.body_para_2, p.body_para_3].map((para, i) =>
                para ? (
                    <div key={i} style={{
                        textAlign: 'justify', marginBottom: 16,
                        textIndent: '40px',
                    }}>{para}</div>
                ) : null
            )}
            {p.complimentary_close && (
                <div style={{ marginBottom: 8 }}>{p.complimentary_close}</div>
            )}
            {(p.subscription || p.designation) && (
                <Box sx={{ mt: 4, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {p.subscription && <div style={{ fontWeight: 'bold' }}>{p.subscription}</div>}
                    <div style={{ height: 40 }} />
                    {p.designation && <div style={{ fontWeight: 'bold' }}>{p.designation}</div>}
                </Box>
            )}
            {p.enclosure && (
                <div style={{ marginTop: 20, fontWeight: 'bold' }}>Encl. : {p.enclosure}</div>
            )}
        </div>
    );
}

// ─── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <IconButton
            size="small"
            title={title}
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            sx={{
                borderRadius: 1, width: 28, height: 28, color: '#333',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
            }}
        >
            {children}
        </IconButton>
    );
}

// ─── Word-like editor (no TinyMCE, no API key needed) ────────────────────────

function WordEditor({
    isMarathi,
    onChange,
    disabled,
    editorRef,
}: {
    isMarathi: boolean;
    onChange: (html: string) => void;
    disabled: boolean;
    editorRef: MutableRefObject<HTMLDivElement | null>;
}) {
    const [fontFamily, setFontFamily] = useState(isMarathi ? '"Kruti Dev 010"' : 'Calibri');
    const [fontSize, setFontSize] = useState(isMarathi ? '4' : '3'); // execCommand fontSize 1-7

    const exec = (cmd: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, value);
        // notify parent of html change
        onChange(editorRef.current?.innerHTML ?? '');
    };

    const fonts = isMarathi
        ? ['"Kruti Dev 010"', '"Shivaji01"', 'Arial']
        : ['Calibri', 'Times New Roman', 'Arial', 'Georgia', 'Courier New'];

    const sizes = [
        { label: '8pt', val: '1' },
        { label: '10pt', val: '2' },
        { label: '11pt', val: '3' },
        { label: '12pt', val: '4' },
        { label: '14pt', val: '5' },
        { label: '18pt', val: '6' },
        { label: '24pt', val: '7' },
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'white' }}>
            {/* ── Toolbar ── */}
            <Box sx={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.3,
                px: 1, py: 0.5, borderBottom: '1px solid #d1d5db',
                bgcolor: '#f3f4f6', minHeight: 40, flexShrink: 0,
            }}>
                {/* Undo / Redo */}
                <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => exec('undo')}><Undo sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => exec('redo')}><Redo sx={{ fontSize: 16 }} /></ToolbarBtn>

                <Box sx={{ width: 1, bgcolor: '#d1d5db', height: 20, mx: 0.3 }} />

                {/* Font family */}
                <Select
                    size="small"
                    value={fontFamily}
                    onChange={e => { setFontFamily(e.target.value); exec('fontName', e.target.value); }}
                    sx={{ height: 26, fontSize: 12, minWidth: 120, '.MuiSelect-select': { py: 0.3, px: 1 } }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {fonts.map(f => <MenuItem key={f} value={f} sx={{ fontSize: 12, fontFamily: f }}>{f.replace(/"/g, '')}</MenuItem>)}
                </Select>

                {/* Font size */}
                <Select
                    size="small"
                    value={fontSize}
                    onChange={e => { setFontSize(e.target.value); exec('fontSize', e.target.value); }}
                    sx={{ height: 26, fontSize: 12, minWidth: 60, '.MuiSelect-select': { py: 0.3, px: 1 } }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {sizes.map(s => <MenuItem key={s.val} value={s.val} sx={{ fontSize: 12 }}>{s.label}</MenuItem>)}
                </Select>

                <Box sx={{ width: 1, bgcolor: '#d1d5db', height: 20, mx: 0.3 }} />

                {/* Format */}
                <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => exec('bold')}><FormatBold sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => exec('italic')}><FormatItalic sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => exec('underline')}><FormatUnderlined sx={{ fontSize: 16 }} /></ToolbarBtn>

                <Box sx={{ width: 1, bgcolor: '#d1d5db', height: 20, mx: 0.3 }} />

                {/* Align */}
                <ToolbarBtn title="Align Left" onClick={() => exec('justifyLeft')}><FormatAlignLeft sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Align Center" onClick={() => exec('justifyCenter')}><FormatAlignCenter sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Align Right" onClick={() => exec('justifyRight')}><FormatAlignRight sx={{ fontSize: 16 }} /></ToolbarBtn>
                <ToolbarBtn title="Justify" onClick={() => exec('justifyFull')}><FormatAlignJustify sx={{ fontSize: 16 }} /></ToolbarBtn>
            </Box>

            {/* ── Page Canvas ── */}
            <Box sx={{
                flex: 1, overflow: 'auto', bgcolor: '#808080',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                py: 4,
            }}>
                <Box
                    ref={editorRef}
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
                    spellCheck={false}
                    data-placeholder="Start typing your letter here…"
                    sx={{
                        width: '100%',
                        maxWidth: '560px',
                        minHeight: '794px',
                        bgcolor: 'white',
                        p: '60px',
                        boxShadow: '0 15px 50px rgba(0,0,0,0.6)',
                        outline: 'none',
                        fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Calibri, "Segoe UI", sans-serif',
                        fontSize: isMarathi ? '16pt' : '11pt',
                        lineHeight: 1.5,
                        color: '#111',
                        cursor: disabled ? 'not-allowed' : 'text',
                        opacity: disabled ? 0.7 : 1,
                        '&:empty:before': {
                            content: 'attr(data-placeholder)',
                            color: '#9ca3af',
                            pointerEvents: 'none',
                        },
                    }}
                />
            </Box>
        </Box>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LetterPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [template, setTemplate] = useState<Template | null>(null);
    const [isMarathi, setIsMarathi] = useState(false);
    const [parts, setParts] = useState<LetterParts>({});
    const [expectedText, setExpectedText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Typing state
    const [content, setContent] = useState('');
    const [sessionState, setSessionState] = useState<'idle' | 'active' | 'finished'>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [finalWpm, setFinalWpm] = useState(0);
    const [finalAccuracy, setFinalAccuracy] = useState(0);
    const [finalMistakes, setFinalMistakes] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const editorRef = useRef<HTMLDivElement | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/student/practice/letter');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.templates ?? []).find((t: Template) => t.id === id);
                if (!found) throw new Error('Template not found.');
                setTemplate(found);
                setIsMarathi(!!json.is_marathi);
                let parsed: LetterParts = {};
                try { parsed = JSON.parse(found.template_content); } catch { }
                setParts(parsed);
                setExpectedText(buildExpectedText(parsed));
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    // ── Finish ─────────────────────────────────────────────────────────────────

    const finishSession = useCallback(async (currentContent: string, secs: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('finished');

        const normalize = (t: string) => t.replace(/\s+/g, ' ').trim();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentContent;
        const typedPlain = normalize(tempDiv.innerText || tempDiv.textContent || '');
        const expectedPlain = normalize(expectedText);

        let mistakes = 0;
        const typedLen = typedPlain.length;
        const compareLen = Math.min(typedLen, expectedPlain.length);

        for (let i = 0; i < compareLen; i++) {
            if (typedPlain[i] !== expectedPlain[i]) mistakes++;
        }

        const words = typedPlain.split(' ').filter(Boolean).length;
        const wpm = Math.round(words / (secs / 60 || 0.001));
        const accuracy = typedLen > 0
            ? Math.max(0, Math.round(((typedLen - mistakes) / typedLen) * 100))
            : 100;

        setFinalWpm(wpm);
        setFinalAccuracy(accuracy);
        setFinalMistakes(mistakes);

        setSaving(true);
        try {
            await fetch('/api/student/practice/letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: id, wpm, accuracy, mistakes, duration_seconds: secs }),
            });
        } catch { } finally { setSaving(false); }
    }, [id, expectedText]);

    // ── Editor change handler ──────────────────────────────────────────────────

    const handleEditorChange = (newContent: string) => {
        if (sessionState === 'finished') return;

        if (sessionState === 'idle' && newContent.replace(/<[^>]*>/g, '').length > 0) {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        }

        setContent(newContent);
    };

    // ── Reset ──────────────────────────────────────────────────────────────────

    const reset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('idle');
        setContent('');
        setElapsed(0);
        setFinalWpm(0); setFinalAccuracy(0); setFinalMistakes(0);
        if (editorRef.current) editorRef.current.innerHTML = '';
    };

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!template) return null;

    const timeStr = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

    // Live Word Count
    const tempDivForCount = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (tempDivForCount) tempDivForCount.innerHTML = content;
    const livePlain = tempDivForCount ? (tempDivForCount.innerText || tempDivForCount.textContent || '').trim() : '';
    const liveWords = livePlain.split(/\s+/).filter(Boolean).length;
    const liveWpm = elapsed > 0 ? Math.round(liveWords / (elapsed / 60)) : 0;

    // ── Result screen ──────────────────────────────────────────────────────────

    const isFinished: boolean = sessionState === 'finished';

    if (isFinished) {
        const passed = finalAccuracy >= 80;
        return (
            <Box sx={{
                minHeight: '100vh', bgcolor: '#1e3a5f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Box sx={{
                    bgcolor: 'white', borderRadius: 3, p: 5, maxWidth: 520, width: '100%', mx: 2,
                    textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}>
                    <CheckCircle sx={{ fontSize: 72, color: passed ? '#16a34a' : '#f59e0b', mb: 2 }} />
                    <Typography variant="h4" fontWeight={800} gutterBottom>
                        {passed ? '🎉 Practice Completed!' : '💪 Keep Practising!'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 22 : 16 }}>{template.title}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 3 }}>
                        {[
                            { label: 'WPM', value: String(finalWpm), color: '#2563eb' },
                            { label: 'Accuracy', value: `${finalAccuracy}%`, color: passed ? '#16a34a' : '#f59e0b' },
                            { label: 'Mistakes', value: String(finalMistakes), color: '#dc2626' },
                            { label: 'Time', value: timeStr, color: '#475569' },
                        ].map(s => (
                            <Box key={s.label} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h5" fontWeight={800} color={s.color}>{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</Typography>
                            </Box>
                        ))}
                    </Box>
                    <Alert severity="info" sx={{ mb: 2, textAlign: 'left', fontSize: 13 }}>
                        {passed ? 'Great job! Your drafting skills are excellent.' : 'Drafting requires attention to detail. Ensure your content matches the reference precisely.'}
                    </Alert>
                    {saving && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Saving…</Typography>}
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/letter')}>
                            Exit
                        </Button>
                        <Button variant="contained" startIcon={<Replay />} onClick={reset}>
                            Restart
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            position: 'fixed', inset: 0, zIndex: 1400,
            display: 'flex', flexDirection: 'column',
            bgcolor: '#f3f2f1',
            fontFamily: '"Segoe UI", Tahoma, sans-serif',
        }}>
            {/* ── Main Workspace ── */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', bgcolor: '#808080' }}>
                {/* Left: Reference Question (50% Width) */}
                <Box sx={{
                    width: '50%',
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRight: '2px solid #333',
                    p: 4,
                    bgcolor: '#666'
                }}>
                    <Typography textAlign="center" sx={{ color: 'white', fontSize: 11, fontWeight: 700, mb: 3, letterSpacing: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        REFERENCE DOCUMENT
                    </Typography>
                    <Box sx={{
                        bgcolor: 'white',
                        width: '100%',
                        maxWidth: '560px',
                        minHeight: '794px',
                        p: '60px',
                        boxShadow: '0 15px 50px rgba(0,0,0,0.6)',
                        position: 'relative',
                        mb: 6
                    }}>
                        <LetterPage p={parts} isMarathi={isMarathi} />
                    </Box>
                </Box>

                {/* Right: Word-like Editor (50% Width) */}
                <Box sx={{
                    width: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <WordEditor
                        isMarathi={isMarathi}
                        onChange={handleEditorChange}
                        disabled={isFinished}
                        editorRef={editorRef as MutableRefObject<HTMLDivElement | null>}
                    />
                </Box>
            </Box>

            {/* ── Status Bar ── */}
            <Box sx={{ bgcolor: '#2b579a', height: 32, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>WORD COUNT: {liveWords}</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>WPM: {liveWpm}</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>TIME: {timeStr}</Typography>
                    {sessionState === 'idle' && (
                        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                            ⌨️ Start typing to begin the timer
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => finishSession(content, elapsed || 1)}
                        sx={{ bgcolor: '#ffffff', color: '#2b579a', '&:hover': { bgcolor: '#f0f0f0' }, textTransform: 'none', fontWeight: 700, fontSize: 11, height: 22 }}
                    >
                        Submit Work
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)', my: 1 }} />
                    <IconButton size="small" sx={{ color: 'white' }} onClick={() => router.push('/student/practice/letter')}><ArrowBack sx={{ fontSize: 16 }} /></IconButton>
                </Box>
            </Box>
        </Box>
    );
}
