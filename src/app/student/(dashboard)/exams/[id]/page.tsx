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
    Lock, RadioButtonChecked,
} from '@mui/icons-material';
import ExamMCQEmail from '../../../../../components/exam/ExamMCQEmail';
import ExamLetterStatement from '../../../../../components/exam/ExamLetterStatement';
import ExamSpeedSection from '../../../../../components/exam/ExamSpeedSection';

// ── Step config ───────────────────────────────────────────────────────────────
const SECTION_LABELS = [
    'Section 1 – MCQ & Email',
    'Section 2 – Letter & Statement',
    'Section 3 – Speed',
];

const SECTION_COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

// ── Custom StepIcon for locked/active/done states ─────────────────────────────
function SectionStepIcon({ step, active, completed }: {
    step: number; active: boolean; completed: boolean;
}) {
    if (completed) return <CheckCircle sx={{ color: '#16a34a', fontSize: 28 }} />;
    if (active)    return <RadioButtonChecked sx={{ color: SECTION_COLORS[step - 1], fontSize: 28 }} />;
    return <Lock sx={{ color: '#94a3b8', fontSize: 24 }} />;
}

// ── Section Transition Screen ─────────────────────────────────────────────────
function SectionTransition({ from, to }: { from: number; to: number }) {
    return (
        <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', gap: 3,
        }}>
            <Paper elevation={4} sx={{
                p: 6, borderRadius: 4, textAlign: 'center', maxWidth: 460,
                background: `linear-gradient(135deg, ${SECTION_COLORS[from - 1]}22, ${SECTION_COLORS[to - 1]}22)`,
                border: `1px solid ${SECTION_COLORS[from - 1]}44`,
            }}>
                <CheckCircle sx={{ fontSize: 64, color: '#16a34a', mb: 2 }} />
                <Typography variant="h5" fontWeight={800} gutterBottom>
                    Section {from} Submitted
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Your answers have been recorded. Proceeding to Section {to}…
                </Typography>
                <CircularProgress size={28} sx={{ color: SECTION_COLORS[to - 1] }} />
            </Paper>
        </Box>
    );
}

export default function ExamSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [examData, setExamData] = useState<any>(null);
    const [step, setStep] = useState(0);           // 0=intro, 1-3=sections, 4=done
    const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
    const [transitioning, setTransitioning] = useState<{ from: number; to: number } | null>(null);
    const [finalResult, setFinalResult] = useState<any>(null);
    const [starting, setStarting] = useState(false);
    const [fsWarning, setFsWarning] = useState(false);
    const [fsViolations, setFsViolations] = useState(0);
    const examContainerRef = useRef<HTMLDivElement>(null);
    const examActiveRef = useRef(false);
    // server-clock offset (server_time − client) so scheduling can't be bypassed
    // by changing the local clock; nowMs ticks so the button auto-enables
    const serverOffsetRef = useRef(0);
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/student/exams/${id}`);
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Failed to load exam');
                if (j.server_time) serverOffsetRef.current = new Date(j.server_time).getTime() - Date.now();
                setExamData(j);

                if (j.exam.status === 'completed') {
                    setStep(4);
                } else if (j.exam.status === 'in_progress') {
                    examActiveRef.current = true;
                    const resume = j.resumeSection ?? 1;
                    setStep(resume);
                    // Mark previously completed sections as done
                    const done = new Set<number>();
                    for (let s = 1; s < resume; s++) done.add(s);
                    setCompletedSections(done);
                }
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    const enterFullscreen = useCallback(async () => {
        const el = examContainerRef.current ?? document.documentElement;
        try {
            await ((el as any).requestFullscreen?.() ??
                (el as any).webkitRequestFullscreen?.() ??
                (el as any).mozRequestFullScreen?.() ??
                (el as any).msRequestFullscreen?.());
        } catch { }
    }, []);

    const exitFullscreen = useCallback(() => {
        try {
            ((document as any).exitFullscreen?.() ??
                (document as any).webkitExitFullscreen?.() ??
                (document as any).mozCancelFullScreen?.() ??
                (document as any).msExitFullscreen?.());
        } catch { }
    }, []);

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

    // ── Section completion: save → show transition → advance ─────────────────
    const advanceSection = useCallback(async (
        fromSection: number,
        apiPayload: object,
        onFinalResult?: (r: any) => void,
    ) => {
        // 1. Save to server
        try {
            const res = await fetch(`/api/student/exams/${id}/submit-section`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section: fromSection, data: apiPayload }),
            });
            const json = await res.json();
            if (onFinalResult && json.answer) onFinalResult(json.answer);
        } catch (e) { console.error(`Failed saving section ${fromSection}`, e); }

        // 2. Mark completed + show transition
        setCompletedSections(prev => new Set(prev).add(fromSection));
        const toSection = fromSection + 1;

        if (fromSection < 3) {
            setTransitioning({ from: fromSection, to: toSection });
            setTimeout(() => {
                setTransitioning(null);
                setStep(toSection);
            }, 2000);
        } else {
            // Section 3 done = exam finished
            examActiveRef.current = false;
            exitFullscreen();
            setStep(4);
        }
    }, [id, exitFullscreen]);

    const handleSection1Complete = useCallback(async (data: any) => {
        await advanceSection(1, data);
    }, [advanceSection]);

    const handleSection2Complete = useCallback(async (data: any) => {
        await advanceSection(2, data);
    }, [advanceSection]);

    const handleSection3Complete = useCallback(async (speedStats: any) => {
        await advanceSection(3, speedStats, (answer) => setFinalResult(answer));
    }, [advanceSection]);

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
    const isMarathi = course?.language_name?.toLowerCase().includes('marathi') ?? false;
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
                    <Box sx={{ p: 4, color: 'white', textAlign: 'center' }}>
                        <School sx={{ fontSize: 56, opacity: 0.9, mb: 1 }} />
                        <Typography variant="h4" fontWeight={800}>{course?.name}</Typography>
                        <Typography variant="subtitle1" sx={{ opacity: 0.8, mt: 0.5 }}>
                            {pattern?.pattern_name}
                        </Typography>
                        <Chip label={`Exam Date: ${fmtDateLongIST(exam?.exam_date)}`}
                            sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 600 }} />
                        {exam?.start_time && (
                            <Chip label={`Time: ${fmtTimeIST(exam.start_time)}`}
                                sx={{ mt: 1, ml: 1, bgcolor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600 }} />
                        )}
                    </Box>

                    <Box sx={{ bgcolor: 'white', p: 4 }}>
                        <Typography variant="h6" fontWeight={700} gutterBottom>📋 Exam Pattern</Typography>
                        <Stack spacing={1.5} sx={{ mb: 4 }}>
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

                        <Paper sx={{ p: 2.5, bgcolor: '#fef9c3', border: '1px solid #fde047', borderRadius: 2, mb: 3 }}>
                            <Typography variant="subtitle2" fontWeight={700} color="warning.dark" gutterBottom>⚠️ Important Rules</Typography>
                            <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2 }}>
                                {[
                                    'Once you start, the exam cannot be paused.',
                                    'Do NOT refresh or close the browser tab.',
                                    'Sections proceed sequentially — you cannot go back to a completed section.',
                                    'Section 3 timer starts only when you type your first character.',
                                    'Paste (Ctrl+V) is disabled in the typing areas.',
                                    'Submitted sections are locked — answers cannot be modified.',
                                ].map((rule, i) => (
                                    <Typography component="li" variant="body2" key={i}>{rule}</Typography>
                                ))}
                            </Stack>
                        </Paper>

                        {exam?.attendance_status === 'present' ? (
                            (() => {
                                const startMs = exam?.start_time ? new Date(exam.start_time).getTime() : 0;
                                const serverNow = nowMs + serverOffsetRef.current;
                                const timeReached = !startMs || serverNow >= startMs;
                                return (
                                    <Box>
                                        {timeReached ? (
                                            <Alert severity="success" icon={<HowToReg />} sx={{ mb: 2, borderRadius: 2 }}>
                                                Attendance marked — you are cleared to start.
                                            </Alert>
                                        ) : (
                                            <Alert severity="info" icon={<AccessTime />} sx={{ mb: 2, borderRadius: 2 }}>
                                                Your attendance has been marked. You can start the exam at the scheduled time
                                                {exam?.start_time ? <> — <strong>{fmtTimeIST(exam.start_time)}</strong> on {fmtDateLongIST(exam.exam_date)}</> : null}.
                                            </Alert>
                                        )}
                                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                            <Button variant="outlined" size="large" onClick={() => router.back()}>Go Back</Button>
                                            <Button variant="contained" size="large"
                                                startIcon={starting ? <CircularProgress size={20} color="inherit" /> : timeReached ? <PlayArrow /> : <AccessTime />}
                                                onClick={startExam} disabled={starting || !timeReached} sx={{ px: 5 }}>
                                                {starting ? 'Starting…' : timeReached ? 'Start Exam' : 'Not Started Yet'}
                                            </Button>
                                        </Box>
                                    </Box>
                                );
                            })()
                        ) : (
                            <Box>
                                <Alert severity="error" icon={<Block />} sx={{ mb: 2, borderRadius: 2 }}>
                                    <strong>Attendance not marked.</strong> Your institute must mark you as <em>Present</em> before you can start.
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
            {/* ── Enhanced Section Progress Stepper ── */}
            {step < 4 && (
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                    <Stepper activeStep={step - 1} alternativeLabel>
                        {SECTION_LABELS.map((label, idx) => {
                            const sectionNum = idx + 1;
                            const done = completedSections.has(sectionNum);
                            const active = step === sectionNum;
                            const locked = !done && !active;
                            return (
                                <Step key={label} completed={done}>
                                    <StepLabel
                                        StepIconComponent={() => (
                                            <SectionStepIcon
                                                step={sectionNum}
                                                active={active}
                                                completed={done}
                                            />
                                        )}
                                        sx={{
                                            '& .MuiStepLabel-label': {
                                                color: done ? '#16a34a' : active ? SECTION_COLORS[idx] : '#94a3b8',
                                                fontWeight: active ? 700 : 400,
                                            },
                                        }}
                                    >
                                        <Stack alignItems="center" spacing={0.25}>
                                            <span>{label}</span>
                                            {done && (
                                                <Chip label="Submitted" size="small"
                                                    sx={{ bgcolor: '#dcfce7', color: '#15803d', fontSize: 10, height: 18 }} />
                                            )}
                                            {locked && (
                                                <Chip label="Locked" size="small"
                                                    sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', fontSize: 10, height: 18 }} />
                                            )}
                                        </Stack>
                                    </StepLabel>
                                </Step>
                            );
                        })}
                    </Stepper>
                </Paper>
            )}

            {/* ── Transition Screen ── */}
            {transitioning && (
                <SectionTransition from={transitioning.from} to={transitioning.to} />
            )}

            {/* ── Active Sections (hidden during transition) ── */}
            {!transitioning && step === 1 && (
                <ExamMCQEmail
                    mcqs={content?.mcq}
                    email={content?.email}
                    duration={sec1Dur}
                    onComplete={handleSection1Complete}
                />
            )}

            {!transitioning && step === 2 && (
                <ExamLetterStatement
                    letter={content?.letter}
                    statement={content?.statement}
                    duration={sec2Dur}
                    onComplete={handleSection2Complete}
                    isMarathi={isMarathi}
                />
            )}

            {!transitioning && step === 3 && (
                <ExamSpeedSection
                    passage={content?.speed}
                    courseWpm={passWpm}
                    onComplete={handleSection3Complete}
                />
            )}

            {/* ── Exam Complete ── */}
            {step === 4 && (
                <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', py: 8 }}>
                    <Paper elevation={3} sx={{ p: 6, borderRadius: 4, background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
                        <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                        <Typography variant="h4" fontWeight={800} gutterBottom>Exam Submitted!</Typography>

                        {finalResult && (
                            <Paper variant="outlined" sx={{ p: 3, my: 4, bgcolor: 'rgba(255,255,255,0.8)', textAlign: 'left' }}>
                                <Typography variant="h6" fontWeight={700} gutterBottom align="center">Provisional Result</Typography>
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography fontWeight={600}>Section 1 (MCQ)</Typography>
                                        <Chip label={`${finalResult.mcq_marks_obtained || 0}/50`}
                                            color={finalResult.mcq_marks_obtained >= 20 ? 'success' : 'error'} />
                                    </Box>
                                    <Divider />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography fontWeight={600}>Section 2 (Letter &amp; Statement)</Typography>
                                        {(finalResult.letter_html || finalResult.statement_grid) ? (
                                            <Chip label="Submitted · Pending Evaluation" color="info" variant="outlined" />
                                        ) : (
                                            <Chip label="Not Submitted" color="error" variant="outlined" />
                                        )}
                                    </Box>
                                    <Divider />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography fontWeight={600}>Section 3 (Speed)</Typography>
                                        <Stack direction="row" spacing={1}>
                                            <Chip label={`${finalResult.speed_wpm || 0} WPM`} variant="outlined" />
                                            <Chip label={`${finalResult.speed_accuracy || 0}% Acc`} variant="outlined" />
                                            <Chip label={finalResult.speed_passed ? 'Pass' : 'Fail'}
                                                color={finalResult.speed_passed ? 'success' : 'error'} />
                                        </Stack>
                                    </Box>
                                    <Divider />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'primary.50', p: 1, borderRadius: 1 }}>
                                        <Typography fontWeight={700}>Overall Result</Typography>
                                        <Typography variant="h6" fontWeight={800}
                                            color={finalResult.overall_result === 'pass' ? 'success.main' : 'error.main'}>
                                            {finalResult.overall_result?.toUpperCase() || 'EVALUATING'}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Paper>
                        )}

                        <Typography color="text.secondary" sx={{ mb: 4 }}>
                            Your exam has been recorded successfully. The final results will be verified by the institute and your certificate will be generated after evaluation.
                        </Typography>
                        <Button variant="contained" size="large" onClick={() => router.push('/student/exams')}>
                            Return to Dashboard
                        </Button>
                    </Paper>
                </Box>
            )}

            {/* ── Fullscreen violation badge ── */}
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

            {/* ── Fullscreen exit warning ── */}
            <Dialog open={fsWarning} disableEscapeKeyDown maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <Warning color="error" /> Fullscreen Required
                </DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>You exited fullscreen mode. This exam must be taken in fullscreen.</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Fullscreen exits are recorded. Violation #{fsViolations} logged.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" color="error" startIcon={<Fullscreen />} onClick={reEnterFullscreen}>
                        Return to Fullscreen
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
