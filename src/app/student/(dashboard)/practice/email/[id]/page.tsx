'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Stack, Button, CircularProgress, Alert,
    LinearProgress, Paper, Chip,
} from '@mui/material';
import {
    ArrowBack, Send, Replay, CheckCircle, Speed, GpsFixed,
    ErrorOutline, Timer, ArrowForward, AttachFile,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailParts {
    mail_to?: string; subject?: string; cc?: string; bcc?: string; body?: string;
    attachment_1?: string; attachment_2?: string; attachment_3?: string;
}
interface Template {
    id: string; title: string; difficulty_level: string | null;
    template_content: string;
    best_accuracy: number | null; best_wpm: number | null; attempted: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

/** Compare two strings character by character, return { correct, total } */
function compareStrings(typed: string, expected: string) {
    let correct = 0;
    const total = Math.max(typed.length, expected.length);
    for (let i = 0; i < Math.min(typed.length, expected.length); i++) {
        if (typed[i] === expected[i]) correct++;
    }
    return { correct, total };
}

/** Per-character coloring for reference-side fields */
function charHighlight(typed: string, expected: string): React.ReactNode[] {
    return expected.split('').map((ch, i) => {
        const t = typed[i];
        let color = '#374151'; // pending
        let bg = 'transparent';
        if (t !== undefined) {
            color = t === ch ? '#15803d' : '#dc2626';
            bg = t === ch ? 'transparent' : '#fee2e2';
        }
        return (
            <span key={i} style={{ color, background: bg, borderRadius: 2 }}>
                {ch === ' ' && t !== undefined && t !== ch ? '·' : ch}
            </span>
        );
    });
}

// ─── Email Panel component ─────────────────────────────────────────────────────

function EmailPanel({
    title, parts, isReference, values, onChange, onSend, disabled, submitted, isMarathi,
}: {
    title: string; parts: EmailParts; isReference: boolean;
    values?: Record<string, string>; onChange?: (field: string, val: string) => void;
    onSend?: () => void; disabled?: boolean; submitted?: boolean;
    isMarathi?: boolean;
}) {
    const fields: { key: keyof EmailParts; label: string }[] = [
        { key: 'mail_to', label: 'Mail to' },
        { key: 'subject', label: 'Subject' },
        { key: 'cc', label: 'CC' },
        { key: 'bcc', label: 'BCC' },
    ];

    const attachments = ([
        { key: 'attachment_1', label: 'Attachment1' },
        { key: 'attachment_2', label: 'Attachment2' },
        { key: 'attachment_3', label: 'Attachment3' },
    ] as { key: keyof EmailParts; label: string }[]).filter(a => parts[a.key]);

    const inputStyle: React.CSSProperties = {
        border: '1px solid #a0aec0', background: isReference ? '#f7f7f7' : 'white',
        borderRadius: 2, padding: '3px 8px', fontSize: isMarathi ? 18 : 13, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Arial, sans-serif',
        width: '100%', outline: 'none', color: isReference ? '#1a1a1a' : '#1a1a1a',
        boxSizing: 'border-box',
    };

    const focusStyle: React.CSSProperties = { border: '2px solid #4fa0e6' };

    return (
        <Box sx={{
            flex: 1, border: '2px solid #ccc', borderRadius: 1, overflow: 'hidden',
            bgcolor: 'white', display: 'flex', flexDirection: 'column',
            boxShadow: '2px 2px 6px rgba(0,0,0,0.15)',
        }}>
            {/* Title bar */}
            <Box sx={{
                background: 'linear-gradient(180deg, #f8d5e8 0%, #f0a8cd 100%)',
                borderBottom: '1px solid #d4a0c0',
                px: 1.5, py: 0.8,
            }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#5a0030', fontFamily: 'Arial, sans-serif' }}>
                    {title}
                </Typography>
            </Box>

            {/* Header fields */}
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                {fields.map(f => (
                    <Stack key={f.key} direction="row" alignItems="center" sx={{ mb: 0.8 }}>
                        <Typography sx={{
                            fontSize: 13, fontFamily: 'Arial, sans-serif', color: '#333',
                            minWidth: 70, textAlign: 'right', pr: 1, flexShrink: 0,
                        }}>
                            {f.label} :
                        </Typography>
                        {isReference
                            ? <Box sx={{
                                ...inputStyle, py: '4px',
                                display: 'block', fontFamily: 'Arial, sans-serif',
                            }}>
                                {parts[f.key] || <span style={{ color: '#999' }}>&nbsp;</span>}
                            </Box>
                            : <input
                                type="text"
                                value={values?.[f.key] ?? ''}
                                onChange={e => onChange?.(f.key, e.target.value)}
                                disabled={disabled}
                                style={inputStyle}
                                onFocus={e => Object.assign(e.target.style, focusStyle)}
                                onBlur={e => Object.assign(e.target.style, { border: '1px solid #a0aec0' })}
                            />
                        }
                    </Stack>
                ))}
            </Box>

            {/* Divider */}
            <Box sx={{ borderTop: '1px solid #ddd', mx: 1 }} />

            {/* Body */}
            <Box sx={{ px: 2, py: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {isReference
                    ? <Box sx={{
                        flex: 1, border: '1px solid #a0aec0', borderRadius: '2px',
                        minHeight: 180, p: '6px 8px', bgcolor: '#f7f7f7',
                        fontSize: isMarathi ? 18 : 13, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Arial, sans-serif', color: '#1a1a1a',
                        whiteSpace: 'pre-wrap', lineHeight: 1.7,
                    }}>
                        {parts.body || ''}
                    </Box>
                    : <textarea
                        value={values?.body ?? ''}
                        onChange={e => onChange?.('body', e.target.value)}
                        disabled={disabled}
                        style={{
                            ...inputStyle, flex: 1, minHeight: 180, resize: 'none',
                            lineHeight: '1.7', whiteSpace: 'pre-wrap',
                        }}
                        onFocus={e => Object.assign(e.target.style, focusStyle)}
                        onBlur={e => Object.assign(e.target.style, { border: '1px solid #a0aec0' })}
                    />
                }
            </Box>

            {/* Attachments */}
            {attachments.length > 0 && (() => {
                const allFiles = [parts.attachment_1, parts.attachment_2, parts.attachment_3]
                    .filter(Boolean) as string[];
                const options = [...allFiles].sort(() => Math.random() - 0.5);
                return (
                    <Box sx={{ px: 2, pb: 1 }}>
                        {attachments.map(a => (
                            <Stack key={a.key} direction="row" alignItems="center" sx={{ mb: 0.5 }}>
                                <Typography sx={{
                                    fontSize: 12, fontFamily: 'Arial, sans-serif', color: '#333',
                                    minWidth: 92, textAlign: 'right', pr: 1, flexShrink: 0,
                                }}>
                                    {a.label} :
                                </Typography>
                                {isReference
                                    ? <Box sx={{ ...inputStyle, display: 'block', position: 'relative', pr: '28px' }}>
                                        <span style={{ fontSize: 12 }}>{parts[a.key]}</span>
                                        <AttachFile sx={{ fontSize: 14, position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                                    </Box>
                                    : <Box sx={{ position: 'relative', flex: 1 }}>
                                        <select
                                            value={values?.[a.key] ?? ''}
                                            onChange={e => onChange?.(a.key, e.target.value)}
                                            disabled={disabled}
                                            style={{
                                                ...inputStyle, paddingRight: 28,
                                                appearance: 'none', cursor: 'pointer',
                                                color: values?.[a.key] ? '#1a1a1a' : '#9ca3af',
                                            }}
                                        >
                                            <option value="">— select file —</option>
                                            {options.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <AttachFile sx={{ fontSize: 14, position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                                    </Box>
                                }
                            </Stack>
                        ))}
                    </Box>
                );
            })()}

            {/* Spacer */}
            <Box sx={{ flex: 0, pb: 0.5 }} />

            {/* Send button */}
            <Box sx={{ px: 2, pb: 1.5, textAlign: 'center' }}>
                <Box
                    component={isReference ? 'div' : 'button'}
                    onClick={!isReference ? onSend : undefined}
                    disabled={isReference || disabled}
                    sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        px: 4, py: 0.8,
                        background: submitted ? 'linear-gradient(180deg, #80e080 0%, #50b050 100%)' : 'linear-gradient(180deg, #f8d5e8 0%, #e85fa0 100%)',
                        color: submitted ? 'white' : '#5a0030',
                        border: '2px outset #c06090', borderRadius: '3px',
                        fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 700,
                        cursor: isReference ? 'default' : 'pointer',
                        '&:hover': !isReference && !disabled ? { filter: 'brightness(1.05)' } : {},
                        '&:active': !isReference && !disabled ? { border: '2px inset #c06090' } : {},
                        transition: 'filter 0.1s',
                    }}
                >
                    <Send sx={{ fontSize: 14 }} />
                    {submitted ? 'Sent ✓' : 'Send'}
                </Box>
            </Box>
        </Box>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [template, setTemplate] = useState<Template | null>(null);
    const [parts, setParts] = useState<EmailParts>({});
    const [isMarathi, setIsMarathi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Student's typed values
    const [values, setValues] = useState<Record<string, string>>({
        mail_to: '', subject: '', cc: '', bcc: '', body: '',
        attachment_1: '', attachment_2: '', attachment_3: '',
    });

    // Session state
    const [sessionState, setSessionState] = useState<'idle' | 'active' | 'submitted' | 'finished'>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [results, setResults] = useState<{
        fieldBreakdown: { field: string; correct: number; total: number; pct: number }[];
        overall: number; mistakes: number; wpm: number;
    } | null>(null);

    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);
    useEffect(() => () => stopTimer(), [stopTimer]);

    const timeStr = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

    // ─── Fetch template ───────────────────────────────────────────────────────

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/student/practice/email');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.templates ?? []).find((t: Template) => t.id === id);
                if (!found) throw new Error('Email template not found.');
                setTemplate(found);
                setIsMarathi(!!json.is_marathi);

                let parsed: EmailParts = {};
                try { parsed = JSON.parse(found.template_content); } catch { }
                setParts(parsed);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    // ─── Track first keystroke → start timer ─────────────────────────────────

    const handleChange = (field: string, val: string) => {
        if (sessionState === 'idle') {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 500);
        }
        setValues(prev => ({ ...prev, [field]: val }));
    };

    // ─── Submit / Score ───────────────────────────────────────────────────────

    const handleSend = useCallback(async () => {
        if (sessionState === 'finished' || sessionState === 'submitted') return;
        stopTimer();
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
        setSessionState('submitted');

        // Score each field
        const fieldDefs = ([
            { key: 'mail_to', label: 'Mail To' }, { key: 'subject', label: 'Subject' },
            { key: 'cc', label: 'CC' }, { key: 'bcc', label: 'BCC' }, { key: 'body', label: 'Body' },
            { key: 'attachment_1', label: 'Attachment 1' }, { key: 'attachment_2', label: 'Attachment 2' },
            { key: 'attachment_3', label: 'Attachment 3' },
        ] as { key: keyof EmailParts; label: string }[]).filter(f => parts[f.key]); // only score fields that exist in the template

        let totalCorrect = 0, totalChars = 0, totalMistakes = 0;
        const fieldBreakdown = fieldDefs.map(f => {
            const expected = (parts[f.key] ?? '').trim();
            const typed = (values[f.key] ?? '').trim();
            const { correct, total } = compareStrings(typed, expected);
            const mistakes = Math.max(0, typed.length - correct) + Math.max(0, expected.length - typed.length);
            totalCorrect += correct; totalChars += total; totalMistakes += mistakes;
            const pct = total > 0 ? Math.round((correct / total) * 100) : 100;
            return { field: f.label, correct, total, pct };
        });

        const overall = totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 100;
        const totalTyped = Object.values(values).join('').length;
        const wpm = Math.round((totalTyped / 5) / (secs / 60));
        setResults({ fieldBreakdown, overall, mistakes: totalMistakes, wpm });

        // Save
        setSaving(true);
        try {
            await fetch('/api/student/practice/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: id, wpm, accuracy: overall,
                    mistakes: totalMistakes, duration_seconds: secs,
                }),
            });
        } catch { } finally { setSaving(false); setSessionState('finished'); }
    }, [sessionState, parts, values, id, stopTimer]);

    // ─── Reset ────────────────────────────────────────────────────────────────

    const reset = () => {
        stopTimer(); setElapsed(0); setSessionState('idle');
        setValues({ mail_to: '', subject: '', cc: '', bcc: '', body: '', attachment_1: '', attachment_2: '', attachment_3: '' });
        setResults(null);
    };

    // ─── Loading / Error ──────────────────────────────────────────────────────

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!template) return null;

    const isPassed = (results?.overall ?? 0) >= 80;

    return (
        <Box sx={{
            position: 'fixed', inset: 0, zIndex: 1400,
            display: 'flex', flexDirection: 'column',
            bgcolor: '#fff',
            overflow: 'hidden'
        }}>
            {/* ── IE-Style Title Bar ── */}
            <Box sx={{
                background: 'linear-gradient(180deg, #e0b4d4 0%, #d070a8 100%)',
                borderBottom: '2px solid #b05090',
                px: 2, py: 0.8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Button size="small" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/email')}
                        sx={{ color: '#5a0030', textTransform: 'none', fontSize: 12, fontWeight: 700 }}>
                        All Emails
                    </Button>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#5a0030', fontFamily: 'Arial, sans-serif' }}>
                        Internet Explorer — Email Practice
                    </Typography>
                    {template.difficulty_level && (
                        <Chip size="small" label={template.difficulty_level}
                            sx={{ height: 18, fontSize: 10, textTransform: 'capitalize', bgcolor: 'rgba(255,255,255,0.5)', color: '#5a0030', fontWeight: 700 }} />
                    )}
                </Stack>
                <Stack direction="row" alignItems="center" spacing={2}>
                    {/* Live stats */}
                    {sessionState !== 'finished' && sessionState !== 'submitted' && (
                        <>
                            {[
                                { label: 'Time', value: timeStr },
                                { label: 'Progress', value: `${Math.round((Object.values(values).join('').length / Math.max(1, Object.values(parts).join('').length)) * 100)}%` },
                            ].map(s => (
                                <Stack key={s.label} alignItems="center">
                                    <Typography sx={{ fontSize: 9, color: '#7a2050', textTransform: 'uppercase' }}>{s.label}</Typography>
                                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#5a0030', fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</Typography>
                                </Stack>
                            ))}
                        </>
                    )}
                    <Button size="small" startIcon={<Replay />} onClick={reset}
                        sx={{ color: '#5a0030', textTransform: 'none', fontSize: 12, fontWeight: 700 }}>
                        Reset
                    </Button>
                </Stack>
            </Box>

            {/* ── Sub-bar with title ── */}
            <Box sx={{ px: 2, py: 0.7, bgcolor: '#f9eaf4', borderBottom: '1px solid #dca8cc' }}>
                <Typography sx={{ fontSize: 13, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Arial, sans-serif', color: '#333' }}>
                    <strong>Task:</strong> {template.title}
                    {sessionState === 'idle' && (
                        <span style={{ color: '#888', marginLeft: 12, fontSize: 12, fontFamily: 'Arial, sans-serif' }}>
                            — Type in the right panel exactly matching the reference on the left. Click Send when done.
                        </span>
                    )}
                    {sessionState === 'active' && (
                        <span style={{ color: '#2563eb', marginLeft: 12, fontSize: 12, fontFamily: 'Arial, sans-serif' }}>
                            ⌨️ Typing…
                        </span>
                    )}
                    {sessionState === 'finished' && (
                        <span style={{ color: isPassed ? '#16a34a' : '#d97706', marginLeft: 12, fontSize: 12, fontWeight: 600, fontFamily: 'Arial, sans-serif' }}>
                            {isPassed ? '✅ Sent & Scored!' : '⚠️ Submitted — see results below'}
                        </span>
                    )}
                </Typography>
            </Box>

            {saving && <LinearProgress />}

            {/* ── Result Banner ── */}
            {sessionState === 'finished' && results && (
                <Box sx={{
                    px: 3, py: 1.5, bgcolor: isPassed ? '#f0fdf4' : '#fffbeb',
                    borderBottom: `2px solid ${isPassed ? '#86efac' : '#fcd34d'}`,
                    display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
                }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <CheckCircle sx={{ color: isPassed ? 'success.main' : 'warning.main', fontSize: 28 }} />
                        <Box>
                            <Typography fontWeight={800} color={isPassed ? 'success.dark' : 'warning.dark'}>
                                {isPassed ? '🎉 Excellent! Email Sent!' : '💪 Submitted — aim for 80%+ accuracy'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Overall accuracy: <strong>{results.overall}%</strong> &nbsp;|&nbsp;
                                WPM: <strong>{results.wpm}</strong> &nbsp;|&nbsp;
                                Mistakes: <strong>{results.mistakes}</strong> &nbsp;|&nbsp;
                                Time: <strong>{timeStr}</strong>
                            </Typography>
                        </Box>
                    </Stack>

                    {/* Field breakdown */}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {results.fieldBreakdown.map(fb => (
                            <Chip key={fb.field} size="small"
                                label={`${fb.field}: ${fb.pct}%`}
                                color={fb.pct >= 90 ? 'success' : fb.pct >= 70 ? 'warning' : 'error'}
                                variant="outlined"
                                sx={{ fontSize: 11, fontWeight: 600 }} />
                        ))}
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                        <Button size="small" variant="outlined" startIcon={<Replay />} onClick={reset}>Try Again</Button>
                        {isPassed && (
                            <Button size="small" variant="contained" endIcon={<ArrowForward />}
                                onClick={() => router.push('/student/practice/email')}>
                                Next Email
                            </Button>
                        )}
                    </Stack>
                </Box>
            )}

            {/* ── Main Email Panels ── */}
            <Box sx={{
                background: 'linear-gradient(135deg, #f8d5e8 0%, #f0c0df 50%, #e8b0d5 100%)',
                p: 2.5, minHeight: 'calc(100vh - 160px)',
                display: 'flex', gap: 2.5, alignItems: 'flex-start',
            }}>
                {/* Reference Panel */}
                <EmailPanel
                    title="✉ REFERENCE EMAIL"
                    parts={parts}
                    isReference={true}
                />

                {/* Practice Panel */}
                <EmailPanel
                    title="✏ YOUR PRACTICE  — type here"
                    parts={parts}
                    isReference={false}
                    values={values}
                    onChange={handleChange}
                    onSend={handleSend}
                    disabled={sessionState === 'finished'}
                    submitted={sessionState === 'finished'}
                />
            </Box>
        </Box>
    );
}
