'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Paper, Stack, Chip, CircularProgress,
    Button, Alert, LinearProgress, Divider,
} from '@mui/material';
import {
    Speed, CheckCircle, ArrowBack, Replay, ArrowForward,
    GpsFixed, ErrorOutline, Timer,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Passage {
    id: string; title: string; passage_text: string;
    difficulty: string | null; duration_minutes: number;
}

type CharState = 'pending' | 'correct' | 'wrong' | 'cursor';
type SessionState = 'idle' | 'active' | 'finished';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

export default function SpeedPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [passage, setPassage] = useState<Passage | null>(null);
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
    const [timeLeft, setTimeLeft] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Results
    const [finalWpm, setFinalWpm] = useState(0);
    const [finalAccuracy, setFinalAccuracy] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);

    // ─── Fetch ──────────────────────────────────────────────────────────────

    useEffect(() => {
        async function fetchPassage() {
            try {
                const res = await fetch('/api/student/practice/speed');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.passages ?? []).find((p: Passage) => p.id === id);
                if (!found) throw new Error('Passage not found.');
                setPassage(found);
                setCharStates(found.passage_text.split('').map(() => 'pending' as CharState));
                setTimeLeft(found.duration_minutes * 60);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        fetchPassage();
    }, [id]);

    // ─── Timer Logic ─────────────────────────────────────────────────────────

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => () => stopTimer(), [stopTimer]);

    // ─── Session Complete ─────────────────────────────────────────────────────

    const completeSession = useCallback(async (pos: number, keys: number, errs: number, secsSpent: number) => {
        stopTimer();
        setSessionState('finished');

        const mins = secsSpent / 60 || 0.001;
        const fw = Math.round((pos / 5) / mins);
        const fa = keys > 0 ? Math.round(((keys - errs) / keys) * 100) : 100;
        setFinalWpm(fw);
        setFinalAccuracy(fa);

        setSaving(true);
        try {
            await fetch('/api/student/practice/speed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    passage_id: id, wpm: fw, accuracy: fa,
                    mistakes: errs, duration_seconds: secsSpent,
                }),
            });
        } catch { }
        finally { setSaving(false); }
    }, [id, stopTimer]);

    // ─── Keyboard Handler ─────────────────────────────────────────────────────

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (sessionState === 'finished' || !passage) return;
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return;
        e.preventDefault();

        const content = passage.passage_text;

        if (sessionState === 'idle') {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        const spent = passage.duration_minutes * 60;
                        setCursorPos(cp => {
                            setTotalKeystrokes(tk => {
                                setMistakes(m => {
                                    completeSession(cp, tk, m, spent);
                                    return m;
                                });
                                return tk;
                            });
                            return cp;
                        });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        setCursorPos(prev => {
            const pos = prev;
            if (pos >= content.length) return pos;

            setTotalKeystrokes(k => k + 1);

            if (e.key === 'Backspace') {
                if (pos === 0) return 0;
                setCharStates(cs => { const next = [...cs]; next[pos - 1] = 'pending'; return next; });
                return pos - 1;
            }

            const expected = content[pos];
            const typed = e.key === 'Enter' ? '\n' : e.key;

            setCharStates(cs => {
                const next = [...cs];
                next[pos] = typed === expected ? 'correct' : 'wrong';
                return next;
            });

            if (typed !== expected) setMistakes(m => m + 1);

            const newPos = pos + 1;
            if (newPos >= content.length) {
                const spent = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
                setMistakes(m => {
                    setTotalKeystrokes(k => {
                        setTimeout(() => completeSession(newPos, k, m, spent), 400);
                        return k;
                    });
                    return m;
                });
            }
            return newPos;
        });
    }, [passage, sessionState, completeSession]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const reset = () => {
        stopTimer();
        setSessionState('idle');
        setCursorPos(0);
        setMistakes(0);
        setTotalKeystrokes(0);
        if (passage) {
            setCharStates(passage.passage_text.split('').map(() => 'pending'));
            setTimeLeft(passage.duration_minutes * 60);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!passage) return null;

    const timeStr = `${pad2(Math.floor(timeLeft / 60))}:${pad2(timeLeft % 60)}`;
    const progress = Math.round((cursorPos / passage.passage_text.length) * 100);
    const currentWpm = timeLeft < passage.duration_minutes * 60 ? Math.round((cursorPos / 5) / ((passage.duration_minutes * 60 - timeLeft) / 60)) : 0;
    const currentAcc = totalKeystrokes > 0 ? Math.round(((totalKeystrokes - mistakes) / totalKeystrokes) * 100) : 100;

    if (sessionState === 'finished') {
        const passed = finalAccuracy >= 90;
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
                    {passed ? '🎉 Great Speed!' : '💪 Keep Practicing!'}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>{passage.title}</Typography>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                    <Stack direction="row" divider={<Box sx={{ width: 1, bgcolor: 'divider' }} />}>
                        {[
                            { icon: <Speed sx={{ color: 'primary.main' }} />, label: 'WPM', value: String(finalWpm) },
                            { icon: <GpsFixed sx={{ color: passed ? 'success.main' : 'warning.main' }} />, label: 'Accuracy', value: `${finalAccuracy}%`, color: passed ? 'success.main' : 'warning.main' },
                            { icon: <ErrorOutline sx={{ color: 'error.main' }} />, label: 'Mistakes', value: String(mistakes) },
                            { icon: <Timer sx={{ color: 'text.secondary' }} />, label: 'Elapsed', value: `${passage.duration_minutes}:00` },
                        ].map(s => (
                            <Stack key={s.label} flex={1} alignItems="center" spacing={0.5} sx={{ px: 2, py: 1 }}>
                                {s.icon}
                                <Typography variant="h5" fontWeight={800} color={s.color}>{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Paper>
                {saving && <LinearProgress sx={{ mb: 2, borderRadius: 4 }} />}
                <Stack direction="row" spacing={2} justifyContent="center">
                    <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/speed')}>Back</Button>
                    <Button variant="outlined" startIcon={<Replay />} onClick={reset}>Restart</Button>
                    {passed && <Button variant="contained" endIcon={<ArrowForward />} onClick={() => router.push('/student/practice/speed')}>Next</Button>}
                </Stack>
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Button variant="text" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/speed')} size="small">Back</Button>
                    <Divider orientation="vertical" flexItem />
                    <Speed sx={{ color: 'primary.main' }} />
                    <Box>
                        <Typography fontWeight={700}>{passage.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{passage.difficulty} • {passage.duration_minutes} min</Typography>
                    </Box>
                </Stack>
                <Button variant="outlined" size="small" startIcon={<Replay />} onClick={reset}>Reset</Button>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3 }}>
                <Stack direction="row" divider={<Box sx={{ width: 1, bgcolor: 'divider' }} />}>
                    {[
                        { label: 'Remaining', value: timeStr, color: timeLeft < 60 ? 'error.main' : 'text.primary' },
                        { label: 'Live WPM', value: String(currentWpm), color: 'primary.main' },
                        { label: 'Accuracy', value: `${currentAcc}%`, color: currentAcc >= 95 ? 'success.main' : currentAcc >= 85 ? 'warning.main' : 'error.main' },
                        { label: 'Progress', value: `${progress}%` },
                    ].map(s => (
                        <Stack key={s.label} flex={1} alignItems="center" spacing={0}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase' }}>{s.label}</Typography>
                            <Typography fontWeight={800} fontSize={22} color={s.color} sx={{ fontFamily: 'monospace' }}>{s.value}</Typography>
                        </Stack>
                    ))}
                </Stack>
                <LinearProgress variant="determinate" value={progress} sx={{ mt: 1.5, height: 4 }} />
            </Paper>

            <Paper
                variant="outlined"
                sx={{
                    p: 4, borderRadius: 3, minHeight: 300, bgcolor: 'grey.50',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 20, lineHeight: 2,
                    position: 'relative', overflowY: 'auto', maxHeight: 500,
                }}
                onClick={() => inputRef.current?.focus()}
            >
                {sessionState === 'idle' && (
                    <Box sx={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'rgba(255,255,255,0.7)', zIndex: 1, backdropFilter: 'blur(2px)',
                    }}>
                        <Typography fontWeight={700} color="text.secondary">Start typing to begin the countdown...</Typography>
                    </Box>
                )}
                <Box component="span">
                    {passage.passage_text.split('').map((char, i) => {
                        const state: CharState = i === cursorPos && (sessionState === 'active' || sessionState === 'idle') ? 'cursor' : (charStates[i] ?? 'pending');
                        const styles: Record<CharState, React.CSSProperties> = {
                            pending: { color: '#94a3b8' },
                            correct: { color: '#16a34a' },
                            wrong: { color: '#dc2626', backgroundColor: '#fee2e2' },
                            cursor: { backgroundColor: '#bfdbfe', borderBottom: '2px solid #2563eb' },
                        };
                        return <span key={i} style={styles[state]}>{char === '\n' ? <br /> : (char === ' ' && state === 'wrong' ? '·' : char)}</span>;
                    })}
                </Box>
            </Paper>
        </Box>
    );
}
