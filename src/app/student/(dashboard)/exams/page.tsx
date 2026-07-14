'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Box, Typography, CircularProgress, Alert, Chip, Paper, Stack,
    Grid, Avatar, Divider, Button,
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import { fmtDateIST, fmtTimeIST } from '../../../../utils/dateIST';
import {
    Event, AccessTime, School, PlayArrow, CheckCircle,
    HourglassEmpty, Cancel, HowToReg, PersonOff,
} from '@mui/icons-material';

const statusConfig: Record<string, { label: string; color: any; icon: any }> = {
    scheduled: { label: 'Upcoming', color: 'primary', icon: <HourglassEmpty fontSize="small" /> },
    in_progress: { label: 'In Progress', color: 'warning', icon: <PlayArrow fontSize="small" /> },
    completed: { label: 'Completed', color: 'success', icon: <CheckCircle fontSize="small" /> },
    cancelled: { label: 'Cancelled', color: 'error', icon: <Cancel fontSize="small" /> },
};

export default function ExamList() {
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/student/exams')
            .then(r => r.json())
            .then(j => {
                if (j.error) throw new Error(j.error);
                setExams(j.exams || []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 16 }}>
            <CircularProgress size={48} />
        </Box>
    );

    const upcoming = exams.filter(e => e.status === 'scheduled' || e.status === 'in_progress');
    const past = exams.filter(e => e.status === 'completed' || e.status === 'cancelled');

    return (
        <Box sx={{ maxWidth: 860, mx: 'auto', px: 3, py: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>My Exams</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Scheduled assessments and exam history
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* Stats */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {[
                    { label: 'Upcoming', value: upcoming.length, color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Completed', value: past.filter(e => e.status === 'completed').length, color: '#10b981', bg: '#f0fdf4' },
                    { label: 'Passed', value: past.filter(e => e.result === 'pass').length, color: '#8b5cf6', bg: '#f5f3ff' },
                ].map((s, i) => (
                    <Grid item xs={4} key={i}>
                        <Paper elevation={0} variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderRadius: 2, bgcolor: s.bg }}>
                            <Typography variant="h3" fontWeight={800} sx={{ color: s.color }}>{s.value}</Typography>
                            <Typography variant="body2" color="text.secondary" fontWeight={600}>{s.label}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Upcoming */}
            {upcoming.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>📅 Upcoming Exams</Typography>
                    <Stack spacing={2}>
                        {upcoming.map(exam => (
                            <ExamCard key={exam.id} exam={exam} />
                        ))}
                    </Stack>
                </Box>
            )}

            {/* Past */}
            {past.length > 0 && (
                <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>📁 Past Exams</Typography>
                    <Stack spacing={2}>
                        {past.map(exam => (
                            <ExamCard key={exam.id} exam={exam} />
                        ))}
                    </Stack>
                </Box>
            )}

            {/* Empty */}
            {exams.length === 0 && (
                <Paper variant="outlined" sx={{ p: 8, textAlign: 'center', borderRadius: 3, borderStyle: 'dashed' }}>
                    <School sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>No Exams Scheduled</Typography>
                    <Typography variant="body2" color="text.disabled">
                        Your institute will schedule exams after you complete your course duration.
                    </Typography>
                </Paper>
            )}
        </Box>
    );
}

function ExamCard({ exam }: { exam: any }) {
    const status = exam.status || 'scheduled';
    const cfg = statusConfig[status] || statusConfig.scheduled;
    const isActionable = status === 'scheduled' || status === 'in_progress';
    const attendancePresent = exam.attendance_status === 'present';
    const examDateLabel = fmtDateIST(exam.exam_date);

    return (
        <Paper elevation={0} variant="outlined" sx={{
            borderRadius: 3, overflow: 'hidden',
            borderLeft: '4px solid',
            borderLeftColor: cfg.color === 'primary' ? 'primary.main'
                : cfg.color === 'warning' ? 'warning.main'
                    : cfg.color === 'success' ? 'success.main' : 'error.main',
            transition: 'box-shadow 0.2s',
            '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
        }}>
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.50' }}>
                            <School fontSize="small" color="primary" />
                        </Avatar>
                        <Box>
                            <Typography variant="body1" fontWeight={700}>
                                {exam.courses?.name || exam.course_name || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {exam.exam_patterns?.pattern_name || exam.pattern_name || '—'}
                            </Typography>
                        </Box>
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Stack direction="row" spacing={3} flexWrap="wrap">
                        {exam.exam_date && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Event fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    {examDateLabel}
                                </Typography>
                            </Box>
                        )}
                        {exam.start_time && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTime fontSize="small" color="action" />
                                <Typography variant="body2" color="text.secondary">
                                    {fmtTimeIST(exam.start_time)}
                                </Typography>
                            </Box>
                        )}
                    </Stack>

                    {/* Result badge for completed */}
                    {status === 'completed' && exam.result && (
                        <Box sx={{ mt: 1.5 }}>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip
                                    label={exam.result.toUpperCase()}
                                    color={exam.result === 'pass' ? 'success' : 'error'}
                                    size="small"
                                    sx={{ fontWeight: 700 }}
                                />
                                {exam.exam_answers?.[0] && (
                                    <>
                                        <Chip 
                                            label={`MCQ: ${exam.exam_answers[0].mcq_marks_obtained || 0}/50`} 
                                            size="small" 
                                            variant="outlined" 
                                            color={exam.exam_answers[0].mcq_marks_obtained >= 20 ? 'success' : 'error'}
                                        />
                                        <Chip 
                                            label={`Speed: ${exam.exam_answers[0].speed_wpm || 0} WPM (${exam.exam_answers[0].speed_accuracy || 0}%)`} 
                                            size="small" 
                                            variant="outlined"
                                            color={exam.exam_answers[0].speed_passed ? 'success' : 'error'}
                                        />
                                    </>
                                )}
                            </Stack>
                        </Box>
                    )}
                </Box>

                <Stack alignItems="flex-end" spacing={1.5}>
                    <Chip icon={cfg.icon} label={cfg.label} color={cfg.color} size="small" />

                    {/* Attendance state for upcoming exams */}
                    {status === 'scheduled' && (
                        attendancePresent ? (
                            <Chip icon={<HowToReg fontSize="small" />} label="Attendance Marked"
                                color="success" size="small" variant="outlined" />
                        ) : (
                            <Chip icon={<PersonOff fontSize="small" />} label="Attendance Pending"
                                color="warning" size="small" variant="outlined" />
                        )
                    )}

                    {isActionable ? (
                        status === 'in_progress' || attendancePresent ? (
                            <Link href={`/student/exams/${exam.id}`} style={{ textDecoration: 'none' }}>
                                <Button variant="contained" size="small" startIcon={<PlayArrow />} sx={{ borderRadius: 2 }}>
                                    {status === 'in_progress' ? 'Resume' : 'Start Exam'}
                                </Button>
                            </Link>
                        ) : (
                            <Box sx={{ textAlign: 'right' }}>
                                <Button variant="contained" size="small" disabled startIcon={<HourglassEmpty />}
                                    sx={{ borderRadius: 2 }}>
                                    Waiting for Attendance
                                </Button>
                                <Typography variant="caption" color="text.secondary"
                                    sx={{ display: 'block', mt: 0.5, maxWidth: 200 }}>
                                    Report to the exam hall — your invigilator will mark you present.
                                </Typography>
                            </Box>
                        )
                    ) : status === 'completed' ? (
                        <Button variant="outlined" size="small" disabled sx={{ borderRadius: 2 }}>
                            View Result
                        </Button>
                    ) : null}
                </Stack>
            </Box>
        </Paper>
    );
}
