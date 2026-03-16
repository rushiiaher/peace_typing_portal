'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Box, Typography, Chip, Paper, Stack, Skeleton,
    LinearProgress, Tooltip, TextField, InputAdornment, Alert,
    Grid, Card, CardContent,
} from '@mui/material';
import {
    Keyboard, CheckCircle, Lock, PlayArrow, Replay,
    Search, EmojiEvents, Speed, Abc, TrendingUp,
} from '@mui/icons-material';

interface Lesson {
    id: string;
    lesson_number: number;
    title: string;
    content_text: string;
    difficulty_level: string | null;
    target_keys: string | null;
    attempted: boolean;
    best_wpm: number | null;
    best_accuracy: number | null;
}

const DIFF_MAP: Record<string, { color: string; bg: string; label: string }> = {
    beginner: { color: '#16a34a', bg: '#dcfce7', label: 'Beginner' },
    intermediate: { color: '#d97706', bg: '#fef3c7', label: 'Intermediate' },
    advanced: { color: '#dc2626', bg: '#fee2e2', label: 'Advanced' },
};

export default function KeyboardLessonsPage() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const fetchLessons = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/student/practice/keyboard');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setLessons(json.lessons ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLessons(); }, [fetchLessons]);

    const attempted = lessons.filter(l => l.attempted).length;
    const avgAccuracy = lessons.filter(l => l.best_accuracy).reduce((a, l) => a + (l.best_accuracy ?? 0), 0) / (lessons.filter(l => l.best_accuracy).length || 1);
    const bestWpm = Math.max(0, ...lessons.filter(l => l.best_wpm).map(l => l.best_wpm ?? 0));
    const filtered = lessons.filter(l => `${l.title} ${l.lesson_number}`.toLowerCase().includes(search.toLowerCase()));
    const progress = lessons.length > 0 ? Math.round((attempted / lessons.length) * 100) : 0;

    if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;

    return (
        <Box>
            {/* ── Hero Header ── */}
            <Box sx={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)',
                borderRadius: 4, p: 4, mb: 4, color: 'white', position: 'relative', overflow: 'hidden',
            }}>
                <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', top: -60, right: -40 }} />
                <Box sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', bottom: -50, right: 160 }} />
                <Stack direction="row" alignItems="center" spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Keyboard sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" fontWeight={900} color="white">Keyboard Lessons</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.5 }}>
                            Build muscle memory key by key — complete each lesson to unlock the next
                        </Typography>
                    </Box>
                </Stack>
            </Box>

            {/* ── Stats ── */}
            {!loading && lessons.length > 0 && (
                <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    {[
                        { icon: <EmojiEvents sx={{ fontSize: 28 }} />, label: 'Completed', value: `${attempted} / ${lessons.length}`, color: '#d97706', bg: '#fffbeb', sub: `${progress}% done` },
                        { icon: <Speed sx={{ fontSize: 28 }} />, label: 'Best WPM', value: bestWpm > 0 ? String(bestWpm) : '—', color: '#0f172a', bg: '#f1f5f9', sub: 'words per minute' },
                        { icon: <Abc sx={{ fontSize: 28 }} />, label: 'Avg Accuracy', value: attempted > 0 ? `${Math.round(avgAccuracy)}%` : '—', color: '#16a34a', bg: '#f0fdf4', sub: 'across attempted' },
                        { icon: <TrendingUp sx={{ fontSize: 28 }} />, label: 'Progress', value: `${progress}%`, color: '#2563eb', bg: '#eff6ff', sub: `${lessons.length - attempted} remaining` },
                    ].map(s => (
                        <Grid item xs={6} md={3} key={s.label}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)' } }}>
                                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                                    <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>{s.icon}</Box>
                                    <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                                    <Typography variant="body2" fontWeight={700} color="text.primary">{s.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                    <Grid item xs={12}>
                        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', px: 3, py: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight={700} color="text.secondary">Lesson Progress</Typography>
                                <Typography variant="body2" fontWeight={800} color="text.primary">{progress}%</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: '#1e293b' } }} />
                            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                                <Typography variant="caption" color="text.secondary">{attempted} completed</Typography>
                                <Typography variant="caption" color="text.secondary">{lessons.length} total lessons</Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ── Search ── */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 2.5, mb: 3 }}>
                <TextField fullWidth size="small" placeholder="Search lessons…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
            </Paper>

            {/* ── Lessons List ── */}
            {loading
                ? <Stack spacing={2}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={100} sx={{ borderRadius: 3, transform: 'none' }} />)}</Stack>
                : lessons.length === 0
                    ? <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 4, border: '2px dashed #e2e8f0' }}>
                        <Keyboard sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} color="text.secondary">No lessons available</Typography>
                        <Typography variant="body2" color="text.disabled">Your instructor hasn't added keyboard lessons to your course yet.</Typography>
                    </Paper>
                    : <Stack spacing={2}>
                        {filtered.map((lesson, index) => {
                            const prevDone = index === 0 || lessons[index - 1]?.attempted;
                            const unlocked = prevDone;
                            const diff = lesson.difficulty_level ? DIFF_MAP[lesson.difficulty_level] : null;
                            const wordCount = lesson.content_text?.trim().split(/\s+/).filter(Boolean).length ?? 0;

                            return (
                                <Paper key={lesson.id} elevation={0} sx={{
                                    borderRadius: 3, border: '1px solid',
                                    borderColor: lesson.attempted ? '#cbd5e1' : '#e2e8f0',
                                    overflow: 'hidden', opacity: unlocked ? 1 : 0.5,
                                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                    '&:hover': unlocked ? { boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' } : {},
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                                        {/* Accent bar */}
                                        <Box sx={{ width: 6, flexShrink: 0, bgcolor: lesson.attempted ? '#1e293b' : unlocked ? '#64748b' : '#e2e8f0' }} />

                                        {/* Lesson number circle */}
                                        <Box sx={{ width: 72, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: lesson.attempted ? '#f1f5f9' : '#f8fafc' }}>
                                            <Box sx={{
                                                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: lesson.attempted ? '#1e293b' : unlocked ? '#64748b' : '#e2e8f0',
                                                color: 'white', fontWeight: 800, fontSize: 16,
                                            }}>
                                                {lesson.attempted ? <CheckCircle sx={{ fontSize: 22 }} /> : unlocked ? lesson.lesson_number : <Lock sx={{ fontSize: 18 }} />}
                                            </Box>
                                        </Box>

                                        {/* Info */}
                                        <Box sx={{ flex: 1, p: 2.5, minWidth: 0 }}>
                                            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
                                                <Typography variant="body1" fontWeight={700} noWrap>
                                                    Lesson {lesson.lesson_number}: {lesson.title}
                                                </Typography>
                                                {diff && <Chip size="small" label={diff.label} sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: diff.bg, color: diff.color }} />}
                                                {!unlocked && <Chip size="small" icon={<Lock sx={{ fontSize: '13px !important' }} />} label="Locked" sx={{ height: 22, fontSize: 11, bgcolor: '#f1f5f9', color: '#94a3b8' }} />}
                                                {lesson.attempted && <Chip size="small" label="Done" icon={<CheckCircle sx={{ fontSize: '13px !important' }} />} sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }} />}
                                            </Stack>
                                            <Stack direction="row" spacing={2.5} alignItems="center">
                                                {lesson.target_keys && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', bgcolor: '#f1f5f9', px: 1, py: 0.2, borderRadius: 1 }}>
                                                        Keys: {lesson.target_keys}
                                                    </Typography>
                                                )}
                                                {wordCount > 0 && (
                                                    <Typography variant="caption" color="text.secondary">{wordCount} words</Typography>
                                                )}
                                                {lesson.attempted && (
                                                    <>
                                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                                            <Speed sx={{ fontSize: 13, color: '#64748b' }} />
                                                            <Typography variant="caption" fontWeight={700} color="text.secondary">{lesson.best_wpm} WPM</Typography>
                                                        </Stack>
                                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                                            <Abc sx={{ fontSize: 13, color: '#16a34a' }} />
                                                            <Typography variant="caption" fontWeight={700} color="success.dark">{lesson.best_accuracy}% acc</Typography>
                                                        </Stack>
                                                    </>
                                                )}
                                            </Stack>
                                        </Box>

                                        {/* CTA */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', pr: 2.5 }}>
                                            <Tooltip title={!unlocked ? 'Complete the previous lesson first' : ''}>
                                                <span>
                                                    <Link href={unlocked ? `/student/practice/keyboard/${lesson.id}` : '#'} style={{ pointerEvents: unlocked ? 'auto' : 'none', textDecoration: 'none' }}>
                                                        <Box sx={{
                                                            display: 'flex', alignItems: 'center', gap: 0.8,
                                                            px: 2.5, py: 1.2, borderRadius: 2.5, fontWeight: 700, fontSize: 13,
                                                            bgcolor: lesson.attempted ? '#1e293b' : unlocked ? '#334155' : '#e2e8f0',
                                                            color: unlocked ? 'white' : '#94a3b8',
                                                            cursor: unlocked ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
                                                            transition: 'opacity 0.2s, transform 0.1s',
                                                            '&:hover': unlocked ? { opacity: 0.88, transform: 'scale(1.03)' } : {},
                                                        }}>
                                                            {lesson.attempted
                                                                ? <><Replay sx={{ fontSize: 16 }} /> Redo</>
                                                                : unlocked
                                                                    ? <><PlayArrow sx={{ fontSize: 16 }} /> Start</>
                                                                    : <><Lock sx={{ fontSize: 14 }} /> Locked</>}
                                                        </Box>
                                                    </Link>
                                                </span>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>
            }
        </Box>
    );
}
