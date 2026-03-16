'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Paper, Stack, Chip } from '@mui/material';
import { Timer, Speed, CheckCircle } from '@mui/icons-material';

export default function ExamSpeedSection({ passage, courseWpm, onComplete }: any) {
    const isMarathi = passage?.course_name?.toLowerCase().includes('marathi') ||
        passage?.title?.toLowerCase().includes('marathi');

    // Dynamic timer: use course passing_criteria_wpm if available, else 30 WPM
    const wpm = courseWpm || passage?.passing_wpm || 30;
    const words = passage?.passage_text?.trim().split(/\s+/).filter(Boolean).length || 0;
    // Time = words / WPM * 60 seconds; minimum 60s, maximum 30 min
    const initialDuration = Math.max(60, Math.min(1800, Math.ceil((words / wpm) * 60)));

    const [timeLeft, setTimeLeft] = useState(initialDuration);
    const [status, setStatus] = useState<'idle' | 'active' | 'finished'>('idle');
    const [typedText, setTypedText] = useState('');
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const passageText: string = passage?.passage_text || '';

    const computeStats = useCallback(() => {
        let mistakes = 0;
        const len = Math.min(typedText.length, passageText.length);
        for (let i = 0; i < len; i++) {
            if (typedText[i] !== passageText[i]) mistakes++;
        }
        const typedWords = typedText.trim().split(/\s+/).filter(Boolean).length;
        const timeSpent = initialDuration - timeLeft || 1;
        const mins = timeSpent / 60;
        const actualWpm = Math.round(typedWords / mins);
        const accuracy = typedText.length > 0
            ? Math.round(((typedText.length - mistakes) / typedText.length) * 100) : 100;
        const passed = actualWpm >= wpm && accuracy >= 80;
        return { wpm: actualWpm, accuracy, mistakes, timeSpent, passed };
    }, [typedText, timeLeft, passageText, initialDuration, wpm]);

    useEffect(() => {
        if (status !== 'active') return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    setStatus('finished');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [status]);

    const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (status === 'finished') return;
        const val = e.target.value;
        if (status === 'idle' && val.length > 0) {
            setStatus('active');
            startTimeRef.current = Date.now();
        }
        setTypedText(val);
        if (val.length >= passageText.length) {
            clearInterval(timerRef.current!);
            setStatus('finished');
        }
    };

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formatTime = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

    const secsUsed = initialDuration - timeLeft;
    const liveWords = typedText.trim().split(/\s+/).filter(Boolean).length;
    const liveWpm = secsUsed > 0 ? Math.round(liveWords / (secsUsed / 60)) : 0;
    let liveMistakes = 0;
    for (let i = 0; i < typedText.length; i++) { if (typedText[i] !== passageText[i]) liveMistakes++; }
    const liveAcc = typedText.length > 0 ? Math.round(((typedText.length - liveMistakes) / typedText.length) * 100) : 100;

    // Build character-level overlay
    const overlaySpans = passageText.split('').map((char, i) => {
        let color = '#94a3b8';
        let bg = 'transparent';
        if (i < typedText.length) {
            color = typedText[i] === char ? '#16a34a' : '#dc2626';
            bg = typedText[i] === char ? 'transparent' : '#fee2e2';
        } else if (i === typedText.length && status === 'active') {
            bg = '#dbeafe';
        }
        return <span key={i} style={{ color, background: bg, whiteSpace: 'pre-wrap' }}>{char}</span>;
    });

    const timerCritical = timeLeft < 60 && status === 'active';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ── Header Bar ── */}
            <Paper elevation={2} sx={{
                px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 64, zIndex: 20, borderRadius: 2,
            }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Speed color="primary" />
                    <Typography variant="h6" fontWeight={700}>Section 3: Speed Passage</Typography>
                    {status === 'idle' && (
                        <Chip label="⏳ Start typing to begin timer" color="info" size="small" variant="outlined" />
                    )}
                    {status === 'active' && (
                        <Chip label="● Recording" color="success" size="small" />
                    )}
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                    {/* Live stats (only when active) */}
                    {status === 'active' && (
                        <Stack direction="row" spacing={1}>
                            <Chip label={`${liveWpm} WPM`} color={liveWpm >= wpm ? 'success' : 'default'} size="small" />
                            <Chip label={`${liveAcc}% Acc`} color={liveAcc >= 80 ? 'success' : 'warning'} size="small" />
                            <Chip label={`${liveMistakes} err`} color={liveMistakes > 0 ? 'error' : 'success'} size="small" variant="outlined" />
                        </Stack>
                    )}

                    {/* Timer */}
                    <Box sx={{
                        px: 3, py: 1, borderRadius: '999px', border: '2px solid',
                        borderColor: timerCritical ? 'error.main' : status === 'idle' ? 'grey.400' : 'primary.main',
                        color: timerCritical ? 'error.main' : status === 'idle' ? 'text.secondary' : 'primary.main',
                        animation: timerCritical ? 'pulse 1s infinite' : 'none',
                        display: 'flex', alignItems: 'center', gap: 1,
                        '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } }
                    }}>
                        <Timer fontSize="small" />
                        <Typography variant="h6" fontFamily="monospace" fontWeight={700}>
                            {formatTime(timeLeft)}
                        </Typography>
                    </Box>

                    {status === 'finished' && (
                        <Button variant="contained" color="success" size="large" startIcon={<CheckCircle />}
                            onClick={() => onComplete(computeStats())}>
                            Submit Exam
                        </Button>
                    )}
                </Stack>
            </Paper>

            {/* ── Info strip ── */}
            <Paper variant="outlined" sx={{ px: 3, py: 1.5, borderRadius: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary"><strong>Passage:</strong> {passage?.title}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Words:</strong> {words}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Required WPM:</strong> {wpm}</Typography>
                <Typography variant="body2" color="text.secondary"><strong>Allotted Time:</strong> {formatTime(initialDuration)}</Typography>
            </Paper>

            {/* ── Reference Text ── */}
            <Paper elevation={1} sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ mb: 2, display: 'block' }}>
                    📄 Reference Passage (Read & Type Below)
                </Typography>
                <Box sx={{
                    p: 3, bgcolor: '#f8fafc', borderRadius: 2,
                    border: '1px solid', borderColor: 'divider',
                    minHeight: 160, lineHeight: 2.2, fontSize: isMarathi ? '22px' : '16px',
                    fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit',
                    userSelect: 'none', pointerEvents: 'none',
                    letterSpacing: isMarathi ? '0.03em' : 'normal',
                }}>
                    {overlaySpans}
                </Box>
            </Paper>

            {/* ── Typing Area ── */}
            <Paper elevation={1} sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="overline" color="primary" fontWeight={700} sx={{ mb: 2, display: 'block' }}>
                    ⌨️ Your Input
                </Typography>
                <textarea
                    ref={textareaRef}
                    disabled={status === 'finished'}
                    autoFocus
                    placeholder={status === 'idle' ? 'Click here and start typing to begin the timer…' : ''}
                    value={typedText}
                    onChange={handleTyping}
                    onPaste={(e) => e.preventDefault()}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                        width: '100%',
                        minHeight: 180,
                        padding: '16px',
                        border: '2px solid',
                        borderColor: status === 'active' ? '#3b82f6' : status === 'finished' ? '#10b981' : '#e2e8f0',
                        borderRadius: 8,
                        fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Segoe UI", system-ui, sans-serif',
                        fontSize: isMarathi ? '22px' : '15px',
                        lineHeight: 1.9,
                        resize: 'vertical',
                        outline: 'none',
                        color: '#1e293b',
                        background: status === 'finished' ? '#f0fdf4' : '#ffffff',
                        transition: 'border-color 0.2s',
                    }}
                />

                {/* Progress bar */}
                {passageText.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Progress</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {typedText.length} / {passageText.length} characters
                            </Typography>
                        </Box>
                        <Box sx={{ height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                            <Box sx={{
                                height: '100%', borderRadius: 3,
                                width: `${Math.min(100, (typedText.length / passageText.length) * 100)}%`,
                                bgcolor: status === 'finished' ? 'success.main' : 'primary.main',
                                transition: 'width 0.1s',
                            }} />
                        </Box>
                    </Box>
                )}
            </Paper>

            {/* ── Finished Summary ── */}
            {status === 'finished' && (() => {
                const stats = computeStats();
                return (
                    <Paper sx={{ p: 4, borderRadius: 2, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.200' }}>
                        <Typography variant="h6" color="success.dark" fontWeight={700} gutterBottom>
                            ✅ Section Complete! Click "Submit Exam" above to finish.
                        </Typography>
                        <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" fontWeight={800} color="primary.main">{stats.wpm}</Typography>
                                <Typography variant="caption" color="text.secondary">WPM</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" fontWeight={800} color={stats.accuracy >= 80 ? 'success.main' : 'warning.main'}>{stats.accuracy}%</Typography>
                                <Typography variant="caption" color="text.secondary">Accuracy</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" fontWeight={800} color="error.main">{stats.mistakes}</Typography>
                                <Typography variant="caption" color="text.secondary">Errors</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h4" fontWeight={800} color={stats.passed ? 'success.main' : 'error.main'}>
                                    {stats.passed ? 'PASS' : 'FAIL'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">Result (≥{wpm} WPM)</Typography>
                            </Box>
                        </Stack>
                    </Paper>
                );
            })()}
        </Box>
    );
}
