'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, Button, Paper, Radio, RadioGroup,
    FormControlLabel, FormControl, Stack, Grid, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Divider, Tooltip,
} from '@mui/material';
import { Timer, Send, QuestionAnswer, Email, ArrowBack, ArrowForward, CheckCircle, HighlightOff, EastOutlined } from '@mui/icons-material';

interface EmailParts {
    mail_to?: string; subject?: string; cc?: string; bcc?: string; body?: string;
    attachment_1?: string; attachment_2?: string; attachment_3?: string;
}

// ── Navigator status colours (used in button sx AND legend) ──────────────────
const NAV_COLORS = {
    current:          { bg: '#2563eb', border: '#2563eb', text: '#fff' },
    answered:         { bg: '#16a34a', border: '#16a34a', text: '#fff' },
    visitedUnanswered:{ bg: '#fff',    border: '#f59e0b', text: '#b45309' },
    notVisited:       { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' },
} as const;

function navSx(status: keyof typeof NAV_COLORS) {
    const c = NAV_COLORS[status];
    return {
        width: 36, height: 36,
        borderRadius: 1,
        border: `2px solid ${c.border}`,
        bgcolor: c.bg,
        color: c.text,
        fontSize: 13,
        fontWeight: 700,
        '&:hover': { bgcolor: c.bg, opacity: 0.85 },
    };
}

function getStatus(
    idx: number,
    currentIdx: number,
    answers: Record<string, string>,
    visited: Set<number>,
    qId: string,
): keyof typeof NAV_COLORS {
    if (idx === currentIdx) return 'current';
    if (answers[qId]) return 'answered';
    if (visited.has(idx)) return 'visitedUnanswered';
    return 'notVisited';
}

export default function ExamMCQEmail({ mcqs, email, duration, onComplete }: any) {
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [activeTab, setActiveTab] = useState<'mcq' | 'email'>('mcq');
    const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [visited, setVisited] = useState<Set<number>>(new Set([0]));
    const [emailValues, setEmailValues] = useState<EmailParts>({});
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showMcqComplete, setShowMcqComplete] = useState(false);
    const mcqCompleteShown = useRef(false);

    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    const handleComplete = useCallback(() => {
        onCompleteRef.current({ answers, emailValues });
    }, [answers, emailValues]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) { handleComplete(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const parsedEmailParts: EmailParts = email?.template_content ? JSON.parse(email.template_content) : {};

    const navigateTo = useCallback((idx: number) => {
        setCurrentMcqIndex(idx);
        setVisited(prev => { const s = new Set(prev); s.add(idx); return s; });
    }, []);

    const handleAnswerChange = useCallback((qId: string, val: string) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    }, []);

    const handleClearAnswer = useCallback(() => {
        if (!mcqs) return;
        const qId = mcqs[currentMcqIndex]?.id;
        if (!qId) return;
        setAnswers(prev => { const n = { ...prev }; delete n[qId]; return n; });
    }, [mcqs, currentMcqIndex]);

    // Fire MCQ-complete nudge exactly once when all questions answered
    useEffect(() => {
        if (mcqs && Object.keys(answers).length === mcqs.length && !mcqCompleteShown.current) {
            mcqCompleteShown.current = true;
            setShowMcqComplete(true);
        }
    }, [answers, mcqs]);

    const handleEmailChange = (field: keyof EmailParts, val: string) => {
        setEmailValues(prev => ({ ...prev, [field]: val }));
    };

    const isMarathi = email?.course_name?.toLowerCase().includes('marathi') || email?.title?.toLowerCase().includes('marathi');
    const isLastQuestion = mcqs && currentMcqIndex === mcqs.length - 1;
    const answeredCount = Object.keys(answers).length;
    const timerCritical = timeLeft < 300;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ── Header ── */}
            <Paper elevation={3} sx={{
                px: 3, py: 1.5, position: 'sticky', top: 64, zIndex: 20,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderRadius: 2,
            }}>
                <Stack direction="row" spacing={2}>
                    <Button
                        variant={activeTab === 'mcq' ? 'contained' : 'outlined'}
                        startIcon={<QuestionAnswer />}
                        onClick={() => setActiveTab('mcq')}
                    >
                        MCQs ({answeredCount}/{mcqs?.length ?? 25})
                    </Button>
                    <Button
                        variant={activeTab === 'email' ? 'contained' : 'outlined'}
                        startIcon={<Email />}
                        onClick={() => setActiveTab('email')}
                    >
                        Email Writing
                    </Button>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{
                        px: 3, py: 1, borderRadius: '999px', border: '2px solid',
                        borderColor: timerCritical ? 'error.main' : 'primary.main',
                        color: timerCritical ? 'error.main' : 'primary.main',
                        display: 'flex', alignItems: 'center', gap: 1,
                        animation: timerCritical ? 'pulse 1s infinite' : 'none',
                        '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                    }}>
                        <Timer fontSize="small" />
                        <Typography variant="h6" fontFamily="monospace" fontWeight={700}>{formatTime(timeLeft)}</Typography>
                    </Box>
                    <Button variant="contained" color="success" startIcon={<CheckCircle />}
                        onClick={() => setShowSubmitConfirm(true)}>
                        Submit Section 1
                    </Button>
                </Stack>
            </Paper>

            <Box sx={{ minHeight: 600 }}>
                {activeTab === 'mcq' ? (
                    <Grid container spacing={3}>
                        {/* ── Question Card ── */}
                        <Grid item xs={12} md={8}>
                            {mcqs && mcqs[currentMcqIndex] && (
                                <Paper elevation={1} sx={{ p: 4, borderRadius: 2 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography variant="overline" color="text.secondary" fontWeight={700}>
                                            Question {currentMcqIndex + 1} of {mcqs.length}
                                        </Typography>
                                        {answers[mcqs[currentMcqIndex].id] && (
                                            <Tooltip title="Clear your selected answer">
                                                <Button
                                                    size="small"
                                                    color="warning"
                                                    startIcon={<HighlightOff fontSize="small" />}
                                                    onClick={handleClearAnswer}
                                                    sx={{ textTransform: 'none', fontSize: 12 }}
                                                >
                                                    Clear Response
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </Stack>

                                    <Typography variant="h6" fontWeight={700} mb={2}>
                                        {mcqs[currentMcqIndex].question}
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />

                                    <FormControl component="fieldset" fullWidth>
                                        <RadioGroup
                                            value={answers[mcqs[currentMcqIndex].id] || ''}
                                            onChange={(e) => handleAnswerChange(mcqs[currentMcqIndex].id, e.target.value)}
                                        >
                                            {(['a', 'b', 'c', 'd'] as const).map((key) => {
                                                const selected = answers[mcqs[currentMcqIndex].id] === key;
                                                return (
                                                    <Paper
                                                        key={key}
                                                        variant="outlined"
                                                        sx={{
                                                            mb: 1.5,
                                                            borderWidth: 2,
                                                            borderColor: selected ? 'primary.main' : 'divider',
                                                            bgcolor: selected ? 'primary.50' : 'background.paper',
                                                            transition: 'all 0.15s',
                                                            cursor: 'pointer',
                                                            '&:hover': { borderColor: 'primary.light', bgcolor: '#f0f9ff' },
                                                        }}
                                                        onClick={() => handleAnswerChange(mcqs[currentMcqIndex].id, key)}
                                                    >
                                                        <FormControlLabel
                                                            value={key}
                                                            control={<Radio color="primary" />}
                                                            label={mcqs[currentMcqIndex][`option_${key}`]}
                                                            sx={{ width: '100%', m: 0, px: 2, py: 1 }}
                                                        />
                                                    </Paper>
                                                );
                                            })}
                                        </RadioGroup>
                                    </FormControl>

                                    {/* ── Navigation Buttons ── */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                        <Button
                                            disabled={currentMcqIndex === 0}
                                            onClick={() => navigateTo(currentMcqIndex - 1)}
                                            startIcon={<ArrowBack />}
                                            variant="outlined"
                                        >
                                            Previous
                                        </Button>

                                        {isLastQuestion ? (
                                            <Button
                                                variant="contained"
                                                color="success"
                                                endIcon={<EastOutlined />}
                                                onClick={() => setShowSubmitConfirm(true)}
                                                sx={{ fontWeight: 700 }}
                                            >
                                                Proceed to Email / Submit Section
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => navigateTo(currentMcqIndex + 1)}
                                                endIcon={<ArrowForward />}
                                                variant="contained"
                                            >
                                                Next Question
                                            </Button>
                                        )}
                                    </Box>
                                </Paper>
                            )}
                        </Grid>

                        {/* ── Question Navigator ── */}
                        <Grid item xs={12} md={4}>
                            <Paper elevation={1} sx={{ p: 3, borderRadius: 2, position: 'sticky', top: 140 }}>
                                <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 2 }}>
                                    Question Navigator
                                </Typography>

                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, mb: 3 }}>
                                    {mcqs?.map((m: any, idx: number) => {
                                        const status = getStatus(idx, currentMcqIndex, answers, visited, m.id);
                                        return (
                                            <IconButton
                                                key={m.id}
                                                size="small"
                                                onClick={() => navigateTo(idx)}
                                                sx={navSx(status)}
                                            >
                                                {idx + 1}
                                            </IconButton>
                                        );
                                    })}
                                </Box>

                                {/* Legend */}
                                <Divider sx={{ mb: 2 }} />
                                <Stack spacing={1}>
                                    {([
                                        ['current',           'Current Question'],
                                        ['answered',          'Answered'],
                                        ['visitedUnanswered', 'Visited — Not Answered'],
                                        ['notVisited',        'Not Visited'],
                                    ] as const).map(([key, label]) => (
                                        <Stack key={key} direction="row" alignItems="center" spacing={1.5}>
                                            <Box sx={{
                                                width: 16, height: 16, borderRadius: 0.5,
                                                bgcolor: NAV_COLORS[key].bg,
                                                border: `2px solid ${NAV_COLORS[key].border}`,
                                                flexShrink: 0,
                                            }} />
                                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>

                                {/* Summary */}
                                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Answered: <strong>{answeredCount}</strong> / {mcqs?.length ?? 0}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                ) : !email ? (
                    <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom>No Email Template Assigned</Typography>
                        <Typography variant="body2" color="text.secondary">Email writing content was not assigned for this exam. Contact your institute.</Typography>
                    </Paper>
                ) : (
                    <Paper sx={{ p: 3, borderRadius: 2 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} lg={6}>
                                <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                    📄 Reference Email
                                </Typography>
                                <Paper variant="outlined" sx={{
                                    p: 3, bgcolor: '#fafafa', userSelect: 'none',
                                    pointerEvents: 'none', borderRight: '3px solid', borderRightColor: 'divider',
                                }}>
                                    <Stack spacing={1.5} divider={<Divider />}>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Typography fontWeight={700} width={80} flexShrink={0}>To:</Typography>
                                            <Typography fontFamily="monospace">{parsedEmailParts.mail_to}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Typography fontWeight={700} width={80} flexShrink={0}>Subject:</Typography>
                                            <Typography>{parsedEmailParts.subject}</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <Typography fontWeight={700} width={80} flexShrink={0}>CC:</Typography>
                                            <Typography fontFamily="monospace">{parsedEmailParts.cc || '—'}</Typography>
                                        </Box>
                                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, minHeight: 200, whiteSpace: 'pre-wrap' }}>
                                            {parsedEmailParts.body}
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} lg={6}>
                                <Typography variant="overline" color="primary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                    ✏️ Your Editor
                                </Typography>
                                <Stack spacing={2}>
                                    <TextField label="To" fullWidth size="small"
                                        value={emailValues.mail_to || ''}
                                        onChange={(e) => handleEmailChange('mail_to', e.target.value)} />
                                    <TextField label="Subject" fullWidth size="small"
                                        value={emailValues.subject || ''}
                                        onChange={(e) => handleEmailChange('subject', e.target.value)} />
                                    <TextField label="CC" fullWidth size="small"
                                        value={emailValues.cc || ''}
                                        onChange={(e) => handleEmailChange('cc', e.target.value)} />
                                    <TextField
                                        label="Compose Email" multiline rows={12} fullWidth
                                        value={emailValues.body || ''}
                                        onChange={(e) => handleEmailChange('body', e.target.value)}
                                        sx={{
                                            '& textarea': {
                                                fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit',
                                                fontSize: isMarathi ? '24px' : 'inherit',
                                            }
                                        }}
                                    />
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>
                )}
            </Box>

            {/* ── MCQ completion nudge ── */}
            <Dialog open={showMcqComplete} onClose={() => setShowMcqComplete(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle color="success" /> All MCQs Answered!
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        All {mcqs?.length} MCQ questions answered. Click <strong>Submit Section 1</strong> to proceed, or review answers first.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowMcqComplete(false)}>Review Answers</Button>
                    <Button variant="contained" color="success"
                        onClick={() => { setShowMcqComplete(false); setShowSubmitConfirm(true); }}>
                        Submit Section 1
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Submit Confirm ── */}
            <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)}>
                <DialogTitle>Finish Section 1?</DialogTitle>
                <DialogContent>
                    <Typography>You are about to finish the MCQ and Email section. This cannot be undone.</Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">• MCQs Answered: {answeredCount} / {mcqs?.length ?? 0}</Typography>
                        {answeredCount < (mcqs?.length ?? 0) && (
                            <Typography variant="body2" color="warning.main">
                                ⚠ {(mcqs?.length ?? 0) - answeredCount} question(s) unanswered
                            </Typography>
                        )}
                        <Typography variant="body2">• Email Body: {emailValues.body?.length || 0} characters</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSubmitConfirm(false)}>Go Back</Button>
                    <Button variant="contained" color="success" endIcon={<EastOutlined />} onClick={handleComplete}>
                        Confirm &amp; Proceed to Section 2
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
