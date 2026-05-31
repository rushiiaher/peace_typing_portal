'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fmtDateLongIST, fmtTimeIST } from '../../../../../utils/dateIST';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Paper, Typography, Button, CircularProgress,
    Alert, Stepper, Step, StepLabel, Stack, Chip, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
    QuestionAnswer, Email, Description, TableChart, Speed, CheckCircle,
    AccessTime, School, PlayArrow, HowToReg, Block, Fullscreen, Warning,
} from '@mui/icons-material';
import ExamMCQEmail from '../../../../../components/exam/ExamMCQEmail';
import ExamLetterStatement from '../../../../../components/exam/ExamLetterStatement';
import ExamSpeedSection from '../../../../../components/exam/ExamSpeedSection';

const STEPS = [
    'Instructions',
    'Section 1 — MCQ & Email',
    'Section 2 — Letter & Statement',
    'Section 3 — Speed Passage',
];

export default function ExamSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [examData, setExamData] = useState<any>(null);
    const [step, setStep] = useState(0); // 0: Intro, 1-3: sections, 4: done
    const [starting, setStarting] = useState(false);
    const [fsWarning, setFsWarning] = useState(false);   // fullscreen-exit warning dialog
    const [fsViolations, setFsViolations] = useState(0); // count of exits
    const examContainerRef = useRef<HTMLDivElement>(null);
    const examActiveRef = useRef(false); // true while exam is in progress (step 1-3)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/student/exams/${id}`);
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Failed to load exam');
                setExamData(j);
                if (j.exam.status === 'completed') setStep(4);
                else if (j.exam.status === 'in_progress') {
                    examActiveRef.current = true;
                    setStep(1);
                }
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    const enterFullscreen = useCallback(async () => {
        const el = examContainerRef.current ?? document.documentElement;
        try {
            await (el as any).requestFullscreen?.() ??
                (el as any).webkitRequestFullscreen?.() ??
                (el as any).mozRequestFullScreen?.() ??
                (el as any).msRequestFullscreen?.();
        } catch { /* user denied — exam still starts */ }
    }, []);

    const exitFullscreen = useCallback(() => {
        try {
            (document as any).exitFullscreen?.() ??
                (document as any).webkitExitFullscreen?.() ??
                (document as any).mozCancelFullScreen?.() ??
                (document as any).msExitFullscreen?.();
        } catch { /* ignore */ }
    }, []);

    // Listen for fullscreen exits while exam is active
    useEffect(() => {
        const onFsChange = () => {
            const isFs = !!(
                document.fullscreenElement ??
                (document as any).webkitFullscreenElement ??
                (document as any).mozFullScreenElement
            );
            if (!isFs && examActiveRef.current) {
                setFsViolations(v => v + 1);
                setFsWarning(true);
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        document.addEventListener('mozfullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
            document.removeEventListener('mozfullscreenchange', onFsChange);
        };
    }, []);

    // Warn on tab/window blur while exam active
    useEffect(() => {
        const onBlur = () => { if (examActiveRef.current) setFsWarning(true); };
        window.addEventListener('blur', onBlur);
        return () => window.removeEventListener('blur', onBlur);
    }, []);

    const startExam = async () => {
        setStarting(true);
        try {
            const res = await fetch(`/api/student/exams/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' }),
            });
            if (!res.ok) throw new Error('Failed to start exam');
            examActiveRef.current = true;
            await enterFullscreen();
            setStep(1);
        } catch (e: any) { setError(e.message); }
        finally { setStarting(false); }
    };

    const finishExam = async (speedStats?: any) => {
        examActiveRef.current = false;
        exitFullscreen();
        try {
            await fetch(`/api/student/exams/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'completed',
                    results: { totalMarks: speedStats?.wpm || 0 }
                }),
            });
        } catch { /* silent */ } finally {
            setStep(4);
        }
    };

    const reEnterFullscreen = async () => {
        setFsWarning(false);
        await enterFullscreen();
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <CircularProgress size={48} />
        </Box>
    );
    if (error) return (
        <Box sx={{ p: 4 }}>
            <Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert>
        </Box>
    );

    const exam = examData?.exam;
    const content = examData?.content;
    const pattern = exam?.exam_patterns;
    const course = exam?.courses;
    const passWpm = course?.passing_criteria_wpm || 30;
    const sec1Dur = pattern?.section_1_duration || 25;
    const sec2Dur = pattern?.section_2_duration || 25;

    // ── Introduction Screen ───────────────────────────────────────────────────
    if (step === 0) {
        return (
            <Box sx={{ maxWidth: 760, mx: 'auto', p: 4 }}>
                <Paper elevation={3} sx={{
                    borderRadius: 4, overflow: 'hidden',
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5986 100%)',
                }}>
                    {/* Header */}
                    <Box sx={{ p: 4, color: 'white', textAlign: 'center' }}>
                        <School sx={{ fontSize: 56, opacity: 0.9, mb: 1 }} />
                        <Typography variant="h4" fontWeight={800}>{course?.name}</Typography>
                        <Typography variant="subtitle1" sx={{ opacity: 0.8, mt: 0.5 }}>
                            {pattern?.pattern_name}
                        </Typography>
                        <Chip
                            label={`Exam Date: ${fmtDateLongIST(exam?.exam_date)}`}
                            sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 600 }}
                        />
                        {exam?.start_time && (
                            <Chip
                                label={`Time: ${fmtTimeIST(exam.start_time)}`}
                                sx={{ mt: 1, ml: 1, bgcolor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600 }}
                            />
                        )}
                    </Box>

                    {/* Exam Plan */}
                    <Box sx={{ bgcolor: 'white', p: 4 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>📋 Exam Pattern</Typography>

                        <Stack spacing={1.5} sx={{ mb: 4 }}>
                            {/* Section 1 */}
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderLeft: '4px solid #3b82f6' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography fontWeight={700} color="primary">Section 1</Typography>
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                            <Chip icon={<QuestionAnswer fontSize="small" />} label={`${pattern?.mcq_count || 25} MCQs`} size="small" variant="outlined" />
                                            <Chip icon={<Email fontSize="small" />} label="Email Writing" size="small" variant="outlined" />
                                        </Stack>
                                    </Box>
                                    <Chip icon={<AccessTime fontSize="small" />} label={`${sec1Dur} min`} color="primary" />
                                </Box>
                            </Paper>

                            {/* Section 2 */}
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderLeft: '4px solid #f59e0b' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography fontWeight={700} color="warning.dark">Section 2</Typography>
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                            <Chip icon={<Description fontSize="small" />} label="Letter Writing" size="small" variant="outlined" />
                                            <Chip icon={<TableChart fontSize="small" />} label="Statement (Excel)" size="small" variant="outlined" />
                                        </Stack>
                                    </Box>
                                    <Chip icon={<AccessTime fontSize="small" />} label={`${sec2Dur} min`} color="warning" />
                                </Box>
                            </Paper>

                            {/* Section 3 */}
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderLeft: '4px solid #10b981' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography fontWeight={700} color="success.dark">Section 3</Typography>
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                            <Chip icon={<Speed fontSize="small" />} label="Speed Passage Typing" size="small" variant="outlined" />
                                            <Chip label={`Required: ${passWpm} WPM`} size="small" color="success" variant="outlined" />
                                        </Stack>
                                    </Box>
                                    <Chip label="Dynamic Timer" color="success" />
                                </Box>
                            </Paper>
                        </Stack>

                        {/* Rules */}
                        <Paper sx={{ p: 2.5, bgcolor: '#fef9c3', border: '1px solid #fde047', borderRadius: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight={700} color="warning.dark" gutterBottom>⚠️ Important Rules</Typography>
                            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {[
                                    'Once you start, the exam cannot be paused.',
                                    'Do NOT refresh or close the browser tab.',
                                    'Sections proceed sequentially — you cannot go back.',
                                    'Section 3 timer starts only when you type your first character.',
                                    'Paste (Ctrl+V) is disabled in the typing areas.',
                                ].map((rule, i) => (
                                    <Typography component="li" variant="body2" key={i}>{rule}</Typography>
                                ))}
                            </Stack>
                        </Paper>

                        {/* Attendance Gate */}
                        {exam?.attendance_status === 'present' ? (
                            <Box>
                                <Alert severity="success" icon={<HowToReg />} sx={{ mb: 2, borderRadius: 2 }}>
                                    Attendance marked — you are cleared to start.
                                </Alert>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                    <Button variant="outlined" size="large" onClick={() => router.back()}>Go Back</Button>
                                    <Button variant="contained" size="large" startIcon={starting ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                                        onClick={startExam} disabled={starting} sx={{ px: 5 }}>
                                        {starting ? 'Starting…' : 'Start Exam'}
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <Box>
                                <Alert severity="error" icon={<Block />} sx={{ mb: 2, borderRadius: 2 }}>
                                    <strong>Attendance not marked.</strong> Your institute must mark you as <em>Present</em> before you can start the exam.
                                    Please report to the exam hall and contact your invigilator.
                                </Alert>
                                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                    <Button variant="outlined" size="large" onClick={() => router.back()}>Go Back</Button>
                                    <Button variant="contained" size="large" disabled startIcon={<Block />} sx={{ px: 5 }}>
                                        Waiting for Attendance
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Paper>
            </Box>
        );
    }

    // ── Sections ──────────────────────────────────────────────────────────────
    return (
        <Box ref={examContainerRef} sx={{ maxWidth: '100%', p: { xs: 1, md: 2 } }}>
            {/* Stepper (hide when done) */}
            {step < 4 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                    <Stepper activeStep={step - 1}>
                        {['Section 1 – MCQ & Email', 'Section 2 – Letter & Statement', 'Section 3 – Speed'].map(label => (
                            <Step key={label}><StepLabel>{label}</StepLabel></Step>
                        ))}
                    </Stepper>
                </Paper>
            )}

            {step === 1 && (
                <ExamMCQEmail
                    mcqs={content?.mcq}
                    email={content?.email}
                    duration={sec1Dur}
                    onComplete={() => setStep(2)}
                />
            )}

            {step === 2 && (
                <ExamLetterStatement
                    letter={content?.letter}
                    statement={content?.statement}
                    duration={sec2Dur}
                    onComplete={() => setStep(3)}
                />
            )}

            {step === 3 && (
                <ExamSpeedSection
                    passage={content?.speed}
                    courseWpm={passWpm}
                    onComplete={finishExam}
                />
            )}

            {step === 4 && (
                <Box sx={{ maxWidth: 520, mx: 'auto', textAlign: 'center', py: 8 }}>
                    <Paper elevation={3} sx={{ p: 6, borderRadius: 4, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                        <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                        <Typography variant="h4" fontWeight={800} gutterBottom>Exam Submitted!</Typography>
                        <Typography color="text.secondary" sx={{ mb: 4 }}>
                            Your exam has been recorded successfully. The results will be verified by the institute and your certificate will be generated after evaluation.
                        </Typography>
                        <Button variant="contained" size="large" onClick={() => router.push('/student/exams')}>
                            View My Exams
                        </Button>
                    </Paper>
                </Box>
            )}

            {/* Fullscreen violation counter badge (visible during exam) */}
            {step >= 1 && step <= 3 && fsViolations > 0 && (
                <Box sx={{
                    position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
                    bgcolor: 'error.main', color: 'white',
                    px: 2, py: 1, borderRadius: 2, fontSize: 13, fontWeight: 700,
                    boxShadow: 4,
                }}>
                    ⚠ Fullscreen exits: {fsViolations}
                </Box>
            )}

            {/* Fullscreen exit warning dialog */}
            <Dialog open={fsWarning} disableEscapeKeyDown maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <Warning color="error" /> Fullscreen Required
                </DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        You exited fullscreen mode. This exam must be taken in fullscreen.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Fullscreen exits are recorded. Violation #{fsViolations} logged.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" color="error" startIcon={<Fullscreen />}
                        onClick={reEnterFullscreen}>
                        Return to Fullscreen
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
