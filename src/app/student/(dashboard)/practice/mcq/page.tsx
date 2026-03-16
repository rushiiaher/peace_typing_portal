'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Box, Typography, Chip, Paper, Stack, Skeleton,
    Alert, TextField, InputAdornment, LinearProgress,
    Grid, Button,
} from '@mui/material';
import { Quiz, CheckCircle, PlayArrow, Replay, Search, EmojiEvents, Assignment } from '@mui/icons-material';

interface MCQSet {
    id: string; title: string; category: string | null;
    question_count: number; attempted: boolean;
    best_score: number | null;
}

export default function MCQPracticePage() {
    const [sets, setSets] = useState<MCQSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/student/practice/mcq');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setSets(json.sets ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const attempted = sets.filter(t => t.attempted).length;
    const filtered = sets.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

    if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;

    return (
        <Box sx={{ pb: 8 }}>
            {/* ── Header Section ── */}
            <Box sx={{
                mb: 4, p: 4, borderRadius: 4,
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                color: 'white', position: 'relative', overflow: 'hidden',
                boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.3)'
            }}>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                        <Box sx={{
                            p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Quiz sx={{ fontSize: 32 }} />
                        </Box>
                        <Box>
                            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: -0.5 }}>
                                MCQ Practice
                            </Typography>
                            <Typography sx={{ opacity: 0.9, fontSize: 15 }}>
                                Master your theory knowledge with interactive quizzes
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
                {/* Decorative circles */}
                <Box sx={{ position: 'absolute', top: -20, right: -20, width: 150, height: 150, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)' }} />
                <Box sx={{ position: 'absolute', bottom: -50, right: 80, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
            </Box>

            {!loading && sets.length > 0 && (
                <Grid container spacing={3} sx={{ mb: 5 }}>
                    <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, textAlign: 'center', height: '100%', border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                            <Assignment sx={{ color: 'primary.main', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" fontWeight={800}>{sets.length}</Typography>
                            <Typography color="text.secondary" variant="body2" fontWeight={600}>Total Modules</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, textAlign: 'center', height: '100%', border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                            <CheckCircle sx={{ color: 'success.main', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" fontWeight={800}>{attempted}</Typography>
                            <Typography color="text.secondary" variant="body2" fontWeight={600}>Completed</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, textAlign: 'center', height: '100%', border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                            <EmojiEvents sx={{ color: 'warning.main', fontSize: 32, mb: 1 }} />
                            <Typography variant="h4" fontWeight={800}>
                                {sets.length > 0 ? Math.round((attempted / sets.length) * 100) : 0}%
                            </Typography>
                            <Typography color="text.secondary" variant="body2" fontWeight={600}>Overall Progress</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            <Typography variant="h6" fontWeight={800} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                Available Training Modules
                {sets.length > 0 && <Chip label={sets.length} size="small" color="primary" sx={{ fontWeight: 700 }} />}
            </Typography>

            {loading
                ? <Stack spacing={2}>{[...Array(2)].map((_, i) => <Skeleton key={i} height={120} sx={{ borderRadius: 4 }} />)}</Stack>
                : sets.length === 0
                    ? <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 5, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                        <Quiz sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                        <Typography variant="h5" fontWeight={700} color="text.primary">No Quizzes Found</Typography>
                        <Typography color="text.secondary">All clear! No MCQ questions have been assigned to your course yet.</Typography>
                    </Paper>
                    : <Stack spacing={2.5}>
                        {filtered.map(t => (
                            <Paper key={t.id} elevation={0} sx={{
                                p: 3, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3,
                                border: '1px solid',
                                borderColor: t.attempted ? 'success.100' : '#e2e8f0',
                                bgcolor: 'white',
                                position: 'relative',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    borderColor: 'primary.300',
                                    boxShadow: '0 12px 20px -8px rgba(0, 0, 0, 0.08)',
                                    transform: 'scale(1.005)'
                                },
                            }}>
                                <Box sx={{
                                    width: 64, height: 64, borderRadius: 3, flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    bgcolor: t.attempted ? 'success.50' : 'primary.50',
                                    color: t.attempted ? 'success.main' : 'primary.main',
                                }}>
                                    <Assignment sx={{ fontSize: 32 }} />
                                </Box>

                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="h6" fontWeight={800} sx={{ color: '#1e293b' }}>
                                        {t.title}
                                    </Typography>
                                    <Stack direction="row" spacing={3} alignItems="center" sx={{ mt: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="caption" sx={{
                                                bgcolor: '#f1f5f9', px: 1.5, py: 0.5, borderRadius: 10,
                                                fontWeight: 700, color: '#64748b', fontSize: 11
                                            }} >
                                                📝 {t.question_count} Questions
                                            </Typography>
                                        </Box>
                                        {t.attempted && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography variant="caption" sx={{
                                                    bgcolor: 'success.50', color: 'success.dark',
                                                    px: 1.5, py: 0.5, borderRadius: 10, fontWeight: 700, fontSize: 11
                                                }}>
                                                    🏆 Best Score: {Math.round(t.best_score ?? 0)}%
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>
                                </Box>

                                <Link href={`/student/practice/mcq/${t.id}`} style={{ textDecoration: 'none' }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        startIcon={t.attempted ? <Replay /> : <PlayArrow />}
                                        sx={{
                                            borderRadius: 3, px: 4, py: 1.5, fontWeight: 800,
                                            textTransform: 'none', boxShadow: 'none',
                                            bgcolor: t.attempted ? 'success.main' : 'primary.main',
                                            '&:hover': {
                                                bgcolor: t.attempted ? 'success.dark' : 'primary.dark',
                                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
                                            }
                                        }}
                                    >
                                        {t.attempted ? 'Restart' : 'Start Quiz'}
                                    </Button>
                                </Link>
                                {t.attempted && (
                                    <Box sx={{
                                        position: 'absolute', top: 12, right: 12,
                                        color: 'success.main', display: 'flex', alignItems: 'center'
                                    }}>
                                        <CheckCircle sx={{ fontSize: 20 }} />
                                    </Box>
                                )}
                            </Paper>
                        ))}
                    </Stack>
            }
        </Box>
    );
}
