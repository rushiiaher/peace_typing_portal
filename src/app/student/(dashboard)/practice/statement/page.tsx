'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Box, Typography, Chip, Paper, Stack, Skeleton,
    Alert, TextField, InputAdornment, LinearProgress, Grid, Card, CardContent,
} from '@mui/material';
import { TableChart, CheckCircle, PlayArrow, Replay, Search, EmojiEvents, GpsFixed, Speed, TrendingUp, Lock } from '@mui/icons-material';

interface StatementTemplate {
    id: string; title: string; difficulty: string | null;
    attempted: boolean;
    best_accuracy: number | null; best_wpm: number | null;
}

const DIFF_COLOR: Record<string, any> = {
    beginner: { color: '#16a34a', bg: '#dcfce7', label: 'Beginner' },
    intermediate: { color: '#d97706', bg: '#fef3c7', label: 'Intermediate' },
    advanced: { color: '#dc2626', bg: '#fee2e2', label: 'Advanced' },
};

export default function StatementPracticePage() {
    const [templates, setTemplates] = useState<StatementTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/student/practice/statement');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setTemplates(json.templates ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const attempted = templates.filter(t => t.attempted).length;
    const bestAcc = Math.max(0, ...templates.filter(t => t.best_accuracy).map(t => t.best_accuracy ?? 0));
    const bestWpm = Math.max(0, ...templates.filter(t => t.best_wpm).map(t => t.best_wpm ?? 0));
    const filtered = templates.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    const progress = templates.length > 0 ? Math.round((attempted / templates.length) * 100) : 0;

    if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;

    return (
        <Box>
            {/* ── Header ── */}
            <Box sx={{
                background: 'linear-gradient(135deg, #1a472a 0%, #217346 60%, #2e8b57 100%)',
                borderRadius: 4, p: 4, mb: 4, color: 'white', position: 'relative', overflow: 'hidden',
            }}>
                {/* decorative circles */}
                <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)', top: -60, right: -40 }} />
                <Box sx={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)', bottom: -50, right: 160 }} />

                <Stack direction="row" alignItems="center" spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                    <Box sx={{
                        width: 56, height: 56, borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <TableChart sx={{ fontSize: 32, color: 'white' }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" fontWeight={900} color="white">Statement Practice</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
                            Practice tab setting and financial statement formatting in an Excel-like environment
                        </Typography>
                    </Box>
                </Stack>
            </Box>

            {/* ── Stats Cards ── */}
            {!loading && templates.length > 0 && (
                <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    {[
                        {
                            icon: <EmojiEvents sx={{ fontSize: 28 }} />,
                            label: 'Completed',
                            value: `${attempted} / ${templates.length}`,
                            color: '#d97706', bg: '#fffbeb',
                            sub: `${progress}% done`,
                        },
                        {
                            icon: <GpsFixed sx={{ fontSize: 28 }} />,
                            label: 'Best Accuracy',
                            value: attempted > 0 ? `${Math.round(bestAcc)}%` : '—',
                            color: '#16a34a', bg: '#f0fdf4',
                            sub: 'across all statements',
                        },
                        {
                            icon: <Speed sx={{ fontSize: 28 }} />,
                            label: 'Best WPM',
                            value: bestWpm > 0 ? String(bestWpm) : '—',
                            color: '#2563eb', bg: '#eff6ff',
                            sub: 'words per minute',
                        },
                        {
                            icon: <TrendingUp sx={{ fontSize: 28 }} />,
                            label: 'Overall Progress',
                            value: `${progress}%`,
                            color: '#7c3aed', bg: '#f5f3ff',
                            sub: `${templates.length - attempted} remaining`,
                        },
                    ].map(s => (
                        <Grid item xs={6} md={3} key={s.label}>
                            <Card elevation={0} sx={{
                                borderRadius: 3, border: '1px solid #e2e8f0',
                                transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)' },
                            }}>
                                <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                                    <Box sx={{
                                        width: 48, height: 48, borderRadius: 2.5,
                                        bgcolor: s.bg, color: s.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
                                    }}>
                                        {s.icon}
                                    </Box>
                                    <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                                    <Typography variant="body2" fontWeight={700} color="text.primary">{s.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}

                    {/* Full-width progress bar */}
                    <Grid item xs={12}>
                        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', px: 3, py: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight={700} color="text.secondary">Overall Progress</Typography>
                                <Typography variant="body2" fontWeight={800} color="success.main">{progress}%</Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                    height: 10, borderRadius: 5,
                                    bgcolor: '#e2e8f0',
                                    '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: '#217346' },
                                }}
                            />
                            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8 }}>
                                <Typography variant="caption" color="text.secondary">{attempted} completed</Typography>
                                <Typography variant="caption" color="text.secondary">{templates.length} total</Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            {/* ── Search ── */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 2.5, mb: 3 }}>
                <TextField
                    fullWidth size="small"
                    placeholder="Search statements by name…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
            </Paper>

            {/* ── Template List ── */}
            {loading
                ? <Stack spacing={2}>{[...Array(3)].map((_, i) => <Skeleton key={i} height={100} sx={{ borderRadius: 3, transform: 'none' }} />)}</Stack>
                : templates.length === 0
                    ? <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 4, border: '2px dashed #e2e8f0' }}>
                        <TableChart sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} color="text.secondary">No statement templates available</Typography>
                        <Typography variant="body2" color="text.disabled">Your instructor hasn't added any statement templates yet.</Typography>
                    </Paper>
                    : filtered.length === 0
                        ? <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Search sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
                            <Typography color="text.secondary">No results for "<strong>{search}</strong>"</Typography>
                        </Paper>
                        : <Stack spacing={2}>
                            {filtered.map((t, idx) => {
                                const diff = t.difficulty ? DIFF_COLOR[t.difficulty] : null;
                                return (
                                    <Paper
                                        key={t.id}
                                        elevation={0}
                                        sx={{
                                            borderRadius: 3,
                                            border: '1px solid',
                                            borderColor: t.attempted ? '#bbf7d0' : '#e2e8f0',
                                            overflow: 'hidden',
                                            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                            '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.1)', transform: 'translateY(-2px)' },
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                                            {/* Left accent bar */}
                                            <Box sx={{
                                                width: 6, flexShrink: 0,
                                                bgcolor: t.attempted ? '#217346' : '#e2e8f0',
                                            }} />

                                            {/* Icon */}
                                            <Box sx={{
                                                width: 64, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: t.attempted ? '#f0fdf4' : '#f8fafc',
                                            }}>
                                                <Box sx={{
                                                    width: 40, height: 40, borderRadius: 2,
                                                    bgcolor: t.attempted ? '#217346' : '#64748b',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {t.attempted
                                                        ? <CheckCircle sx={{ color: 'white', fontSize: 22 }} />
                                                        : <TableChart sx={{ color: 'white', fontSize: 20 }} />}
                                                </Box>
                                            </Box>

                                            {/* Content */}
                                            <Box sx={{ flex: 1, p: 2.5, minWidth: 0 }}>
                                                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ mb: 0.5 }}>
                                                    <Typography variant="body1" fontWeight={700}>{t.title}</Typography>
                                                    {diff && (
                                                        <Chip
                                                            size="small"
                                                            label={diff.label}
                                                            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: diff.bg, color: diff.color, border: 'none' }}
                                                        />
                                                    )}
                                                    {t.attempted && (
                                                        <Chip size="small" label="Completed" icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                                                            color="success" variant="outlined" sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                                                    )}
                                                </Stack>
                                                {t.attempted && (
                                                    <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
                                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                                            <GpsFixed sx={{ fontSize: 14, color: '#16a34a' }} />
                                                            <Typography variant="caption" fontWeight={700} color="success.dark">
                                                                {Math.round(t.best_accuracy ?? 0)}% accuracy
                                                            </Typography>
                                                        </Stack>
                                                        <Stack direction="row" alignItems="center" spacing={0.5}>
                                                            <Speed sx={{ fontSize: 14, color: '#2563eb' }} />
                                                            <Typography variant="caption" fontWeight={700} color="primary.dark">
                                                                {t.best_wpm} WPM
                                                            </Typography>
                                                        </Stack>
                                                    </Stack>
                                                )}
                                                {!t.attempted && (
                                                    <Typography variant="caption" color="text.disabled">Not attempted yet</Typography>
                                                )}
                                            </Box>

                                            {/* Action Button */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', pr: 2.5 }}>
                                                <Link href={`/student/practice/statement/${t.id}`} style={{ textDecoration: 'none' }}>
                                                    <Box sx={{
                                                        display: 'flex', alignItems: 'center', gap: 0.8,
                                                        px: 2.5, py: 1.2, borderRadius: 2.5,
                                                        fontWeight: 700, fontSize: 13,
                                                        bgcolor: t.attempted ? '#217346' : '#2563eb',
                                                        color: 'white', cursor: 'pointer', whiteSpace: 'nowrap',
                                                        transition: 'opacity 0.2s, transform 0.1s',
                                                        '&:hover': { opacity: 0.88, transform: 'scale(1.03)' },
                                                    }}>
                                                        {t.attempted
                                                            ? <><Replay sx={{ fontSize: 16 }} /> Practice Again</>
                                                            : <><PlayArrow sx={{ fontSize: 16 }} /> Start Practice</>}
                                                    </Box>
                                                </Link>
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
