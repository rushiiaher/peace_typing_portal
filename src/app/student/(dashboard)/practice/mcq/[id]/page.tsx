'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Paper, Stack, Radio, RadioGroup,
    FormControlLabel, FormControl, Button, CircularProgress,
    Alert, LinearProgress, Divider,
} from '@mui/material';
import {
    ArrowBack, CheckCircle, ErrorOutline, Replay,
    SkipNext, ArrowForward, Quiz, Timer,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
    id: string; question: string; category: string;
    option_a: string; option_b: string; option_c: string; option_d: string;
    correct_answer: string;
    explanation?: string;
}

export default function MCQSession() {
    const { id: set_id } = useParams<{ id: string }>();
    const router = useRouter();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [isMarathi, setIsMarathi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Quiz state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({}); // index -> selected 'a'|'b'|'c'|'d'
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0, percent: 0 });

    // ─── Fetch ──────────────────────────────────────────────────────────────

    useEffect(() => {
        async function fetchQuestions() {
            try {
                const res = await fetch('/api/student/practice/mcq');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const filtered = json.questions ?? [];
                if (filtered.length === 0) throw new Error('No questions found.');
                setQuestions(filtered);
                setIsMarathi(!!json.is_marathi);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        fetchQuestions();
    }, [set_id]);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleAnswerChange = (val: string) => {
        setAnswers(prev => ({ ...prev, [currentIndex]: val }));
    };

    const next = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            finish();
        }
    };

    const finish = async () => {
        let correct = 0;
        questions.forEach((q, i) => {
            if (answers[i] === q.correct_answer.toLowerCase()) correct++;
        });

        const total = questions.length;
        const percent = Math.round((correct / total) * 100);
        setScore({ correct, total, percent });
        setShowResults(true);

        setSaving(true);
        try {
            await fetch('/api/student/practice/mcq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    set_id, total_questions: total,
                    correct_answers: correct, score_percent: percent,
                }),
            });
        } catch { }
        finally { setSaving(false); }
    };

    const reset = () => {
        setCurrentIndex(0);
        setAnswers({});
        setShowResults(false);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (questions.length === 0) return null;

    const q = questions[currentIndex];
    const selected = answers[currentIndex] || '';

    if (showResults) {
        const passed = score.percent >= 80;
        return (
            <Box sx={{
                position: 'fixed', inset: 0, zIndex: 1400,
                bgcolor: '#f8fafc', overflow: 'auto', py: 8, px: 3
            }}>
                <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                    {/* ── Result Summary Card ── */}
                    <Paper elevation={0} sx={{ p: 6, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', mb: 5, textAlign: 'center' }}>
                        <Box sx={{
                            width: 100, height: 100, borderRadius: '50%', bgcolor: passed ? 'success.50' : 'warning.50',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3
                        }}>
                            {passed ? <CheckCircle sx={{ fontSize: 60, color: 'success.main' }} /> : <ErrorOutline sx={{ fontSize: 60, color: 'warning.main' }} />}
                        </Box>

                        <Typography variant="h3" fontWeight={900} color="text.primary" gutterBottom>
                            {passed ? 'Congratulations!' : 'Session Complete'}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 4, fontWeight: 500 }}>
                            {passed ? "You've successfully mastered this module." : "Great effort! Keep practicing to improve your score."}
                        </Typography>

                        <Box sx={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4, p: 3,
                            bgcolor: '#f1f5f9', borderRadius: 4
                        }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="h3" fontWeight={900} color={passed ? 'success.main' : 'primary.main'}>
                                    {score.percent}%
                                </Typography>
                                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Total Accuracy
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Correct Answers</Typography>
                                    <Typography variant="body2" fontWeight={800} color="success.main">{score.correct}</Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">Total Questions</Typography>
                                    <Typography variant="body2" fontWeight={800}>{score.total}</Typography>
                                </Stack>
                            </Box>
                        </Box>

                        <Stack direction="row" spacing={2.5} justifyContent="center">
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={<ArrowBack />}
                                onClick={() => router.push('/student/practice/mcq')}
                                sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: 700, textTransform: 'none', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                            >
                                Back to List
                            </Button>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<Replay />}
                                onClick={reset}
                                sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: 800, textTransform: 'none', boxShadow: 'none' }}
                            >
                                Try Again
                            </Button>
                        </Stack>
                    </Paper>

                    {/* ── Answer Key / Analysis Section ── */}
                    <Typography variant="h5" fontWeight={900} sx={{ mb: 3, color: '#1e293b' }}>
                        Answer Key & Analysis
                    </Typography>

                    <Stack spacing={3}>
                        {questions.map((q, idx) => {
                            const userAns = answers[idx];
                            const correctAns = q.correct_answer.toLowerCase();
                            const isCorrect = userAns === correctAns;

                            const getOptionText = (key: string) => {
                                if (key === 'a') return q.option_a;
                                if (key === 'b') return q.option_b;
                                if (key === 'c') return q.option_c;
                                if (key === 'd') return q.option_d;
                                return 'N/A';
                            };

                            return (
                                <Paper key={idx} variant="outlined" sx={{ p: 4, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', bgcolor: isCorrect ? 'success.main' : 'error.main' }} />

                                    <Stack spacing={2.5}>
                                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#1e293b', fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 24 : 16 }}>
                                            {idx + 1}. {q.question}
                                        </Typography>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                                            <Paper sx={{ p: 2, bgcolor: isCorrect ? 'success.50' : 'error.50', borderRadius: 2, border: '1px solid', borderColor: isCorrect ? 'success.100' : 'error.100' }}>
                                                <Typography variant="caption" fontWeight={800} color={isCorrect ? 'success.dark' : 'error.dark'} sx={{ display: 'block', mb: 0.5 }}>
                                                    YOUR ANSWER
                                                </Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 20 : 14 }}>
                                                    ({userAns?.toUpperCase() || '—'}) {getOptionText(userAns)}
                                                </Typography>
                                            </Paper>

                                            <Paper sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'success.100' }}>
                                                <Typography variant="caption" fontWeight={800} color="success.dark" sx={{ display: 'block', mb: 0.5 }}>
                                                    CORRECT ANSWER
                                                </Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 20 : 14 }}>
                                                    ({correctAns.toUpperCase()}) {getOptionText(correctAns)}
                                                </Typography>
                                            </Paper>
                                        </Box>

                                        {q.explanation && (
                                            <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2.5, borderLeft: '4px solid #3b82f6' }}>
                                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                    <Quiz sx={{ fontSize: 18, color: '#3b82f6' }} />
                                                    <Typography variant="caption" fontWeight={900} color="primary.main" sx={{ letterSpacing: 0.5 }}>
                                                        EXPLANATION
                                                    </Typography>
                                                </Stack>
                                                <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 18 : 14 }}>
                                                    {q.explanation}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Stack>

                    <Box sx={{ py: 6, textAlign: 'center' }}>
                        <Button
                            variant="text"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            sx={{ fontWeight: 700, color: 'text.secondary' }}
                        >
                            Back to Top
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            position: 'fixed', inset: 0, zIndex: 1400,
            bgcolor: '#f1f5f9', overflow: 'auto'
        }}>
            <Box sx={{ maxWidth: 850, mx: 'auto', px: 3, py: 6 }}>
                {/* ── Top Bar ── */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                    <Button
                        variant="text"
                        startIcon={<ArrowBack />}
                        onClick={() => router.push('/student/practice/mcq')}
                        sx={{
                            color: '#475569', bgcolor: 'white', fontWeight: 700, px: 2, borderRadius: 2,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)', '&:hover': { bgcolor: '#f8fafc' }
                        }}
                    >
                        Quit Quiz
                    </Button>

                    <Stack direction="row" alignItems="center" spacing={3}>
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                                Progress
                            </Typography>
                            <Typography variant="body2" fontWeight={800} color="primary.main">
                                {currentIndex + 1} / {questions.length}
                            </Typography>
                        </Box>
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <CircularProgress
                                variant="determinate"
                                value={((currentIndex + 1) / questions.length) * 100}
                                size={44}
                                thickness={5}
                                sx={{ color: '#e2e8f0' }}
                            />
                            <CircularProgress
                                variant="determinate"
                                value={((currentIndex + 1) / questions.length) * 100}
                                size={44}
                                thickness={5}
                                sx={{
                                    color: 'primary.main', position: 'absolute', left: 0,
                                    strokeLinecap: 'round'
                                }}
                            />
                        </Box>
                    </Stack>
                </Stack>

                {/* ── Question Card ── */}
                <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03)', mb: 4 }}>
                    <Typography variant="h5" fontWeight={800} sx={{ mb: 5, color: '#1e293b', lineHeight: 1.6, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 32 : 24 }}>
                        {q.question}
                    </Typography>

                    <FormControl component="fieldset" fullWidth>
                        <RadioGroup value={selected} onChange={(e) => handleAnswerChange(e.target.value)}>
                            {[
                                { lab: q.option_a, val: 'a', key: 'A' },
                                { lab: q.option_b, val: 'b', key: 'B' },
                                { lab: q.option_c, val: 'c', key: 'C' },
                                { lab: q.option_d, val: 'd', key: 'D' },
                            ].map((opt) => (
                                <Box
                                    key={opt.val}
                                    onClick={() => handleAnswerChange(opt.val)}
                                    sx={{
                                        mb: 2, p: 2.5, borderRadius: 3, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 2,
                                        border: '2px solid',
                                        borderColor: selected === opt.val ? 'primary.main' : '#e2e8f0',
                                        bgcolor: selected === opt.val ? 'primary.50' : 'white',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            borderColor: selected === opt.val ? 'primary.main' : 'primary.200',
                                            bgcolor: selected === opt.val ? 'primary.50' : '#f8fafc',
                                            transform: 'translateX(4px)'
                                        },
                                    }}
                                >
                                    <Box sx={{
                                        width: 32, height: 32, borderRadius: 1.5,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, fontSize: 13,
                                        bgcolor: selected === opt.val ? 'primary.main' : '#f1f5f9',
                                        color: selected === opt.val ? 'white' : '#64748b',
                                        transition: 'all 0.2s'
                                    }}>
                                        {opt.key}
                                    </Box>
                                    <Typography sx={{
                                        fontSize: isMarathi ? 24 : 16, fontWeight: selected === opt.val ? 700 : 500,
                                        color: selected === opt.val ? 'primary.dark' : '#334155',
                                        fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit'
                                    }}>
                                        {opt.lab}
                                    </Typography>
                                    <Radio
                                        value={opt.val}
                                        checked={selected === opt.val}
                                        sx={{ ml: 'auto', display: 'none' }}
                                    />
                                </Box>
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Paper>

                {/* ── Navigation Buttons ── */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button
                        variant="text"
                        size="large"
                        startIcon={<ArrowBack />}
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentIndex === 0}
                        sx={{ fontWeight: 700, borderRadius: 2, color: '#64748b' }}
                    >
                        Previous
                    </Button>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={next}
                        endIcon={currentIndex === questions.length - 1 ? <CheckCircle /> : <ArrowForward />}
                        disabled={!selected}
                        sx={{
                            px: 6, py: 1.5, borderRadius: 3, fontWeight: 800,
                            boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
                            textTransform: 'none'
                        }}
                    >
                        {currentIndex === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}
