'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Paper, Stack, Chip, CircularProgress,
    Button, Alert, LinearProgress, Divider, Tooltip,
} from '@mui/material';
import {
    Keyboard, CheckCircle, ArrowBack, Replay, ArrowForward,
    Speed, GpsFixed, ErrorOutline, Timer,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
    id: string; lesson_number: number; title: string;
    content_text: string; difficulty_level: string | null; target_keys: string | null;
}

type CharState = 'pending' | 'correct' | 'wrong' | 'cursor';
type SessionState = 'idle' | 'active' | 'finished';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KeyboardLessonSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [lesson, setLesson] = useState<Lesson | null>(null);
    const [isMarathi, setIsMarathi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Typing engine state
    const [sessionState, setSessionState] = useState<SessionState>('idle');
    const [charStates, setCharStates] = useState<CharState[]>([]);
    const [cursorPos, setCursorPos] = useState(0);
    const [mistakes, setMistakes] = useState(0);
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);

    // Timer
    const [elapsed, setElapsed] = useState(0); // seconds
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Result stats
    const [finalWpm, setFinalWpm] = useState(0);
    const [finalAccuracy, setFinalAccuracy] = useState(0);

    // Keyboard input ref (invisible input)
    const inputRef = useRef<HTMLInputElement>(null);

    // ─── Fetch lesson ─────────────────────────────────────────────────────────

    useEffect(() => {
        async function fetchLesson() {
            try {
                const res = await fetch('/api/student/practice/keyboard');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.lessons ?? []).find((l: Lesson) => l.id === id);
                if (!found) throw new Error('Lesson not found.');
                setLesson(found);
                setIsMarathi(!!json.is_marathi);
                // Init char states
                setCharStates(found.content_text.split('').map(() => 'pending' as CharState));
                setCursorPos(0);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        fetchLesson();
    }, [id]);

    // ─── Timer ────────────────────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        startTimeRef.current = Date.now() - elapsed * 1000;
        timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 500);
    }, [elapsed]);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => () => stopTimer(), [stopTimer]);

    // ─── Compute WPM & accuracy live ─────────────────────────────────────────

    const wpm = elapsed > 0 ? Math.round((cursorPos / 5) / (elapsed / 60)) : 0;
    const accuracy = totalKeystrokes > 0 ? Math.round(((totalKeystrokes - mistakes) / totalKeystrokes) * 100) : 100;
    const progress = lesson ? Math.round((cursorPos / lesson.content_text.length) * 100) : 0;

    // ─── Session complete ─────────────────────────────────────────────────────

    const completeSession = useCallback(async (finalPos: number, totalKeys: number, errs: number, secs: number) => {
        stopTimer();
        setSessionState('finished');

        const mins = secs / 60 || 0.001;
        const fw = Math.round((finalPos / 5) / mins);
        const fa = totalKeys > 0 ? Math.round(((totalKeys - errs) / totalKeys) * 100) : 100;
        setFinalWpm(fw);
        setFinalAccuracy(fa);

        // Save session
        setSaving(true);
        try {
            await fetch('/api/student/practice/keyboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lesson_id: id,
                    wpm: fw,
                    accuracy: fa,
                    mistakes: errs,
                    duration_seconds: secs,
                }),
            });
        } catch { /* silent — don't block UI */ }
        finally { setSaving(false); }
    }, [id, stopTimer]);

    // ─── Keyboard handler ─────────────────────────────────────────────────────

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (sessionState === 'finished') return;
        if (!lesson) return;

        // Ignore modifier-only keys
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return;
        e.preventDefault();

        const content = lesson.content_text;

        // Start timer on first keystroke
        if (sessionState === 'idle') {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 500);
        }

        setCursorPos(prev => {
            const pos = prev;
            if (pos >= content.length) return pos;

            setTotalKeystrokes(k => k + 1);

            if (e.key === 'Backspace') {
                if (pos === 0) return 0;
                // Remove mistake if last was wrong
                setCharStates(cs => {
                    const next = [...cs];
                    next[pos - 1] = 'pending';
                    return next;
                });
                return pos - 1;
            }

            const expected = content[pos];
            const typed = e.key === 'Enter' ? '\n' : e.key;

            setCharStates(cs => {
                const next = [...cs];
                next[pos] = typed === expected ? 'correct' : 'wrong';
                return next;
            });

            if (typed !== expected) {
                setMistakes(m => m + 1);
            }

            const newPos = pos + 1;

            // Check completion
            if (newPos >= content.length) {
                const secs = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
                // Use functional update pattern to get latest mistakes/keystrokes
                setMistakes(m => {
                    setTotalKeystrokes(k => {
                        setTimeout(() => completeSession(newPos, k + 1, m + (typed !== expected ? 1 : 0), secs), 400);
                        return k;
                    });
                    return m;
                });
            }

            return newPos;
        });
    }, [lesson, sessionState, completeSession]);

    // Attach keyboard listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Focus invisible input on click anywhere
    const focusInput = () => inputRef.current?.focus();

    // ─── Reset ────────────────────────────────────────────────────────────────

    const resetSession = () => {
        stopTimer();
        setElapsed(0);
        setSessionState('idle');
        setCursorPos(0);
        setMistakes(0);
        setTotalKeystrokes(0);
        setFinalWpm(0);
        setFinalAccuracy(0);
        if (lesson) setCharStates(lesson.content_text.split('').map(() => 'pending'));
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // ─── Render helpers ───────────────────────────────────────────────────────

    const DIFF_COLOR: Record<string, string> = {
        beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444',
    };

    const timeStr = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

    // ─── Loading / Error ──────────────────────────────────────────────────────

    if (loading) return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ p: 4 }}>
            <Alert severity="error" action={<Button onClick={() => router.back()}>Go Back</Button>}>{error}</Alert>
        </Box>
    );

    if (!lesson) return null;

    // ─── Result Screen ────────────────────────────────────────────────────────

    if (sessionState === 'finished') {
        const passed = finalAccuracy >= 80;
        return (
            <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', pt: 6 }}>
                <Box sx={{
                    width: 100, height: 100, borderRadius: '50%', mx: 'auto', mb: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: passed ? 'success.50' : 'warning.50',
                    border: '3px solid', borderColor: passed ? 'success.main' : 'warning.main',
                }}>
                    <CheckCircle sx={{ fontSize: 52, color: passed ? 'success.main' : 'warning.main' }} />
                </Box>

                <Typography variant="h4" fontWeight={800} gutterBottom>
                    {passed ? '🎉 Lesson Complete!' : '💪 Good Effort!'}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 22 : 16 }}>
                    Lesson {lesson.lesson_number}: {lesson.title}
                </Typography>

                {/* Stats */}
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                    <Stack direction="row" divider={<Box sx={{ width: 1, bgcolor: 'divider' }} />}>
                        <ResultStat icon={<Speed sx={{ color: 'primary.main' }} />} label="WPM" value={String(finalWpm)} />
                        <ResultStat icon={<GpsFixed sx={{ color: passed ? 'success.main' : 'warning.main' }} />}
                            label="Accuracy" value={`${finalAccuracy}%`}
                            color={passed ? 'success.main' : 'warning.main'} />
                        <ResultStat icon={<ErrorOutline sx={{ color: 'error.main' }} />} label="Mistakes" value={String(mistakes)} />
                        <ResultStat icon={<Timer sx={{ color: 'text.secondary' }} />} label="Time" value={timeStr} />
                    </Stack>
                </Paper>

                {!passed && (
                    <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                        Aim for at least <strong>80% accuracy</strong> before moving on. Try again — focus on correctness over speed!
                    </Alert>
                )}

                {saving && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}

                <Stack direction="row" spacing={2} justifyContent="center">
                    <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/keyboard')}>
                        All Lessons
                    </Button>
                    <Button variant="outlined" startIcon={<Replay />} onClick={resetSession}>
                        Try Again
                    </Button>
                    {passed && (
                        <Button variant="contained" endIcon={<ArrowForward />}
                            onClick={() => router.push('/student/practice/keyboard')}>
                            Next Lesson
                        </Button>
                    )}
                </Stack>
            </Box>
        );
    }

    // ─── Practice Screen ──────────────────────────────────────────────────────

    return (
        <Box onClick={focusInput} sx={{ userSelect: 'none', cursor: 'text' }}>
            {/* Hidden input to capture keyboard events on mobile */}
            <input ref={inputRef} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} autoFocus readOnly />

            {/* ── Header ── */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Button variant="text" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/keyboard')} size="small">
                        Lessons
                    </Button>
                    <Divider orientation="vertical" flexItem />
                    <Keyboard sx={{ color: 'primary.main' }} />
                    <Box>
                        <Typography fontWeight={700}>{lesson.title}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">Lesson {lesson.lesson_number}</Typography>
                            {lesson.difficulty_level && (
                                <Chip size="small" label={lesson.difficulty_level}
                                    sx={{
                                        height: 16, fontSize: 10, textTransform: 'capitalize',
                                        bgcolor: DIFF_COLOR[lesson.difficulty_level] + '22',
                                        color: DIFF_COLOR[lesson.difficulty_level],
                                        fontWeight: 700,
                                    }} />
                            )}
                        </Stack>
                    </Box>
                </Stack>
                <Button variant="outlined" size="small" startIcon={<Replay />} onClick={resetSession}>
                    Reset
                </Button>
            </Stack>

            {/* ── Target Keys highlight ── */}
            {lesson.target_keys && (() => {
                // target_keys may be a JSON array ["a","s"] or a comma/space-delimited string
                const raw = lesson.target_keys as unknown;
                const keys: string[] = Array.isArray(raw)
                    ? (raw as any[]).map(String).filter(Boolean)
                    : String(raw).split(/[,\s]+/).filter(Boolean);
                return keys.length > 0 ? (
                    <Paper variant="outlined" sx={{ px: 2, py: 1, mb: 2, borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">Focus keys:</Typography>
                        {keys.map(k => (
                            <Box key={k} sx={{
                                px: 1, py: 0.3, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200',
                                borderRadius: 1, fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'primary.main',
                                boxShadow: '0 2px 0 #1976d233',
                            }}>{k}</Box>
                        ))}
                    </Paper>
                ) : null;
            })()}

            {/* ── Live Stats Bar ── */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3 }}>
                <Stack direction="row" spacing={0} divider={<Box sx={{ width: 1, bgcolor: 'divider' }} />}>
                    <LiveStat label="Time" value={timeStr}
                        color={sessionState === 'idle' ? 'text.disabled' : 'text.primary'} mono />
                    <LiveStat label="WPM" value={String(sessionState === 'idle' ? 0 : wpm)} color="primary.main" mono />
                    <LiveStat label="Accuracy" value={`${sessionState === 'idle' ? 100 : accuracy}%`}
                        color={accuracy >= 90 ? 'success.main' : accuracy >= 75 ? 'warning.main' : 'error.main'} mono />
                    <LiveStat label="Mistakes" value={String(mistakes)}
                        color={mistakes === 0 ? 'success.main' : 'error.main'} mono />
                    <LiveStat label="Progress" value={`${progress}%`} color="text.primary" mono />
                </Stack>
                <LinearProgress variant="determinate" value={progress}
                    sx={{ mt: 1.5, height: 5, borderRadius: 3 }} />
            </Paper>

            {/* ── Text Display Area ── */}
            <Paper
                variant="outlined"
                sx={{
                    p: 3.5, borderRadius: 3, minHeight: 200,
                    fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"JetBrains Mono", "Courier New", monospace',
                    fontSize: isMarathi ? { xs: 24, md: 32 } : { xs: 16, md: 20 },
                    lineHeight: 2.2,
                    letterSpacing: '0.04em',
                    cursor: 'text',
                    position: 'relative',
                    bgcolor: 'grey.50',
                    border: sessionState === 'active' ? '2px solid' : '1px solid',
                    borderColor: sessionState === 'active' ? 'primary.main' : 'divider',
                    transition: 'border-color 0.2s',
                    overflowX: 'auto',
                    wordBreak: 'break-word',
                }}
                onClick={focusInput}
            >
                {/* Idle overlay */}
                {sessionState === 'idle' && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.7)',
                        borderRadius: 3, zIndex: 1, backdropFilter: 'blur(2px)',
                    }}>
                        <Typography color="text.secondary" fontWeight={600} fontSize={16}>
                            🖮  Click here and start typing…
                        </Typography>
                    </Box>
                )}

                {/* Characters */}
                <Box component="span" sx={{ display: 'inline' }}>
                    {lesson.content_text.split('').map((char, i) => {
                        const state: CharState = i === cursorPos && (sessionState === 'active' || sessionState === 'idle')
                            ? 'cursor'
                            : (charStates[i] ?? 'pending');

                        const isNewline = char === '\n';

                        const styles: Record<CharState, React.CSSProperties> = {
                            pending: { color: '#94a3b8' },
                            correct: { color: '#16a34a', backgroundColor: 'transparent' },
                            wrong: { color: '#dc2626', backgroundColor: '#fee2e2', borderRadius: 2 },
                            cursor: {
                                color: '#1e293b',
                                backgroundColor: '#bfdbfe',
                                borderBottom: '3px solid #2563eb',
                                borderRadius: 2,
                            },
                        };

                        if (isNewline) {
                            return (
                                <span key={i}>
                                    <span style={{
                                        ...styles[state],
                                        fontFamily: 'monospace',
                                        opacity: state === 'cursor' ? 1 : 0.35,
                                    }}>↵</span>
                                    <br />
                                </span>
                            );
                        }

                        return (
                            <span key={i} style={styles[state]}>
                                {char === ' ' && state === 'wrong' ? '·' : char}
                            </span>
                        );
                    })}
                </Box>
            </Paper>

            {/* ── Tips ── */}
            <Paper variant="outlined" sx={{ px: 2.5, py: 1.5, mt: 2, borderRadius: 2, bgcolor: 'primary.50', border: 'none' }}>
                <Typography variant="caption" color="primary.dark">
                    💡 <strong>Tips:</strong> Keep your fingers on home row (ASDF JKL;). Don't look at the keyboard.
                    Use <kbd style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>Backspace</kbd> to correct mistakes.
                    Accuracy matters more than speed at this stage.
                </Typography>
            </Paper>
        </Box>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveStat({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
    return (
        <Stack flex={1} alignItems="center" spacing={0} sx={{ px: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 10 }}>
                {label}
            </Typography>
            <Typography fontWeight={800} fontSize={22} color={color ?? 'text.primary'}
                sx={{ fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit', lineHeight: 1.3 }}>
                {value}
            </Typography>
        </Stack>
    );
}

function ResultStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
    return (
        <Stack flex={1} alignItems="center" spacing={0.5} sx={{ px: 2, py: 1 }}>
            {icon}
            <Typography variant="h5" fontWeight={800} color={color}>{value}</Typography>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </Stack>
    );
}
