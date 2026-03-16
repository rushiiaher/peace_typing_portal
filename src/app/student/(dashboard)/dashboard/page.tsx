'use client';

import { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Paper, Stack, CircularProgress,
    Alert, Divider, Chip
} from '@mui/material';
import {
    Speed, GpsFixed, Assignment, EmojiEvents,
    History, Keyboard, Description, Article, Email, Quiz
} from '@mui/icons-material';

interface Session {
    id: string;
    practice_type: string;
    wpm: number;
    accuracy: number;
    score_percent: number;
    completed_at: string;
}

const TYPE_CONFIG: Record<string, { label: string, icon: any, color: string }> = {
    keyboard_lesson: { label: 'Keyboard Lesson', icon: <Keyboard fontSize="small" />, color: '#3b82f6' },
    speed_passage: { label: 'Speed Practice', icon: <Speed fontSize="small" />, color: '#10b981' },
    letter_template: { label: 'Letter Writing', icon: <Description fontSize="small" />, color: '#6366f1' },
    statement_template: { label: 'Statement Practice', icon: <Article fontSize="small" />, color: '#059669' },
    email_template: { label: 'Email Writing', icon: <Email fontSize="small" />, color: '#db2777' },
    mcq: { label: 'MCQ Quiz', icon: <Quiz fontSize="small" />, color: '#d97706' },
};

export default function StudentDashboard() {
    const [data, setData] = useState<{ sessions: Session[], stats: any } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/student/dashboard');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                setData(json);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, []);



    const stats = [
        { label: 'Average Speed', value: `${data?.stats.avgWpm} WPM`, icon: <Speed sx={{ color: 'white' }} />, color: '#3b82f6' },
        { label: 'Average Accuracy', value: `${data?.stats.avgAcc}%`, icon: <GpsFixed sx={{ color: 'white' }} />, color: '#10b981' },
        { label: 'Total Practices', value: String(data?.stats.totalSessions), icon: <Assignment sx={{ color: 'white' }} />, color: '#6366f1' },
        { label: 'Completion Rate', value: 'Good', icon: <EmojiEvents sx={{ color: 'white' }} />, color: '#d97706' },
    ];

    return (
        <Box>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>Welcome back!</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>Track your typing progress and recent exercises.</Typography>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {!loading && !error && <>

                <Grid container spacing={3} sx={{ mb: 6 }}>
                    {stats.map((s, i) => (
                        <Grid item xs={12} sm={6} md={3} key={i}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {s.icon}
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 10 }}>{s.label}</Typography>
                                    <Typography variant="h6" fontWeight={800}>{s.value}</Typography>
                                </Box>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Grid container spacing={4}>
                    <Grid item xs={12} md={7}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                                <History sx={{ color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
                            </Stack>

                            {data?.sessions.length === 0 ? (
                                <Box sx={{ py: 4, textAlign: 'center' }}>
                                    <Typography color="text.disabled">No recent activity. Start practicing!</Typography>
                                </Box>
                            ) : (
                                <Stack spacing={1.5}>
                                    {data?.sessions.map((s) => {
                                        const config = TYPE_CONFIG[s.practice_type] || { label: 'Practice', icon: <Assignment />, color: '#666' };
                                        return (
                                            <Box key={s.id} sx={{
                                                p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                '&:hover': { bgcolor: 'grey.50' }, transition: 'background 0.2s',
                                            }}>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <Box sx={{ color: config.color }}>{config.icon}</Box>
                                                    <Box>
                                                        <Typography fontWeight={600} variant="body2">{config.label}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {new Date(s.completed_at).toLocaleDateString()} at {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    {s.wpm > 0 && <Typography fontWeight={800} color="primary.main">{s.wpm} WPM</Typography>}
                                                    <Typography variant="caption" fontWeight={700} color="success.main">
                                                        {s.accuracy || s.score_percent}% Accuracy
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={5}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: 'primary.50', borderColor: 'primary.100' }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom>Next Recommendation</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Based on your activity, you should focus on accuracy in Speed Practice.
                            </Typography>
                            <Stack spacing={2}>
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'white' }}>
                                    <Box>
                                        <Typography fontWeight={700} variant="body2">Advanced Speed Test</Typography>
                                        <Typography variant="caption" color="text.secondary">English • 10 Questions</Typography>
                                    </Box>
                                    <Speed sx={{ color: 'primary.main' }} />
                                </Paper>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="caption" color="primary.main" sx={{ cursor: 'pointer', fontWeight: 600 }}>Explore all modes →</Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </>}
        </Box>
    );
}
