'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Button, Paper, Radio, RadioGroup,
    FormControlLabel, FormControl, Stack, Grid, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Divider
} from '@mui/material';
import { Timer, Send, QuestionAnswer, Email, ArrowBack, ArrowForward, CheckCircle } from '@mui/icons-material';

interface EmailParts {
    mail_to?: string; subject?: string; cc?: string; bcc?: string; body?: string;
    attachment_1?: string; attachment_2?: string; attachment_3?: string;
}

export default function ExamMCQEmail({ mcqs, email, duration, onComplete }: any) {
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [activeTab, setActiveTab] = useState<'mcq' | 'email'>('mcq');
    const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [emailValues, setEmailValues] = useState<EmailParts>({});
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    onComplete(); // Auto submit
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [onComplete]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const parsedEmailParts: EmailParts = email?.template_content ? JSON.parse(email.template_content) : {};

    const handleAnswerChange = (qId: string, val: string) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const handleEmailChange = (field: keyof EmailParts, val: string) => {
        setEmailValues(prev => ({ ...prev, [field]: val }));
    };

    const isMarathi = email?.course_name?.toLowerCase().includes('marathi') || email?.title?.toLowerCase().includes('marathi');

    return (
        <Box className="space-y-4">
            {/* Exam Header (Timer & Tabs) */}
            <Paper className="p-4 sticky top-16 z-20 flex justify-between items-center shadow-md bg-white dark:bg-zinc-900 border-b">
                <Stack direction="row" spacing={2}>
                    <Button
                        variant={activeTab === 'mcq' ? 'contained' : 'outlined'}
                        startIcon={<QuestionAnswer />}
                        onClick={() => setActiveTab('mcq')}
                    >
                        MCQs ({Object.keys(answers).length}/25)
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
                    <Box className={`px-4 py-2 rounded-full flex items-center gap-2 border-2 ${timeLeft < 300 ? 'border-red-500 text-red-600 animate-pulse' : 'border-blue-500 text-blue-600'}`}>
                        <Timer />
                        <Typography className="font-mono font-bold text-xl">{formatTime(timeLeft)}</Typography>
                    </Box>
                    <Button variant="contained" color="success" onClick={() => setShowSubmitConfirm(true)}>
                        Submit Section 1
                    </Button>
                </Stack>
            </Paper>

            <Box className="min-h-[600px]">
                {activeTab === 'mcq' ? (
                    <Grid container spacing={4}>
                        <Grid item xs={12} md={8}>
                            {mcqs && mcqs[currentMcqIndex] && (
                                <Paper className="p-8 space-y-6">
                                    <Typography variant="h6" color="textSecondary">
                                        Question {currentMcqIndex + 1} of {mcqs.length}
                                    </Typography>
                                    <Typography variant="h5" className="font-bold">
                                        {mcqs[currentMcqIndex].question}
                                    </Typography>
                                    <Divider />
                                    <FormControl component="fieldset" fullWidth>
                                        <RadioGroup
                                            value={answers[mcqs[currentMcqIndex].id] || ''}
                                            onChange={(e) => handleAnswerChange(mcqs[currentMcqIndex].id, e.target.value)}
                                        >
                                            {['a', 'b', 'c', 'd'].map((key) => (
                                                <Paper
                                                    key={key}
                                                    className={`mb-3 border-2 transition-all ${answers[mcqs[currentMcqIndex].id] === key ? 'border-blue-500 bg-blue-50' : 'border-zinc-200'} p-1`}
                                                >
                                                    <FormControlLabel
                                                        value={key}
                                                        control={<Radio />}
                                                        label={mcqs[currentMcqIndex][`option_${key}`]}
                                                        sx={{ width: '100%', m: 0, px: 2, py: 1 }}
                                                    />
                                                </Paper>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>

                                    <Box className="flex justify-between pt-4">
                                        <Button
                                            disabled={currentMcqIndex === 0}
                                            onClick={() => setCurrentMcqIndex(curr => curr - 1)}
                                            startIcon={<ArrowBack />}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            disabled={currentMcqIndex === mcqs.length - 1}
                                            onClick={() => setCurrentMcqIndex(curr => curr + 1)}
                                            endIcon={<ArrowForward />}
                                            variant="contained"
                                        >
                                            Next Question
                                        </Button>
                                    </Box>
                                </Paper>
                            )}
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Paper className="p-4">
                                <Typography variant="subtitle2" gutterBottom className="text-zinc-500 uppercase">Question Navigator</Typography>
                                <Box className="grid grid-cols-5 gap-2">
                                    {mcqs?.map((m: any, idx: number) => (
                                        <IconButton
                                            key={m.id}
                                            size="small"
                                            onClick={() => setCurrentMcqIndex(idx)}
                                            className={`rounded-md border-2 ${currentMcqIndex === idx ? 'border-blue-600 bg-blue-600 text-white' :
                                                answers[m.id] ? 'border-green-500 text-green-600' : 'border-zinc-200'
                                                }`}
                                        >
                                            {idx + 1}
                                        </IconButton>
                                    ))}
                                </Box>
                                <Box className="mt-6 flex flex-col gap-2 text-xs">
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-600 rounded"></div> Current</div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded"></div> Answered</div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-zinc-200 rounded"></div> Not Visited</div>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                ) : (
                    <Paper className="p-6">
                        <Grid container spacing={3}>
                            <Grid item xs={12} lg={6}>
                                <Typography variant="h6" className="mb-4 bg-zinc-100 p-3 rounded">Reference Material</Typography>
                                <Box className="space-y-4 text-sm opacity-80 pointer-events-none select-none border-r pr-4">
                                    <Box className="flex gap-4 border-b py-2">
                                        <span className="font-bold w-20">To:</span>
                                        <span className="font-mono">{parsedEmailParts.mail_to}</span>
                                    </Box>
                                    <Box className="flex gap-4 border-b py-2">
                                        <span className="font-bold w-20">Subject:</span>
                                        <span>{parsedEmailParts.subject}</span>
                                    </Box>
                                    <Box className="flex gap-4 border-b py-2">
                                        <span className="font-bold w-20">CC:</span>
                                        <span className="font-mono">{parsedEmailParts.cc || '-'}</span>
                                    </Box>
                                    <Box className="p-4 bg-zinc-50 rounded border mt-4 min-h-[200px] whitespace-pre-wrap">
                                        {parsedEmailParts.body}
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item xs={12} lg={6}>
                                <Typography variant="h6" className="mb-4 bg-blue-50 text-blue-800 p-3 rounded">Your Editor</Typography>
                                <Stack spacing={2}>
                                    <TextField
                                        label="To" fullWidth size="small"
                                        value={emailValues.mail_to || ''}
                                        onChange={(e) => handleEmailChange('mail_to', e.target.value)}
                                    />
                                    <TextField
                                        label="Subject" fullWidth size="small"
                                        value={emailValues.subject || ''}
                                        onChange={(e) => handleEmailChange('subject', e.target.value)}
                                    />
                                    <TextField
                                        label="CC" fullWidth size="small"
                                        value={emailValues.cc || ''}
                                        onChange={(e) => handleEmailChange('cc', e.target.value)}
                                    />
                                    <TextField
                                        label="Compose Email" multiline rows={12} fullWidth
                                        value={emailValues.body || ''}
                                        onChange={(e) => handleEmailChange('body', e.target.value)}
                                        sx={{
                                            '& textarea': {
                                                fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit',
                                                fontSize: isMarathi ? '24px' : 'inherit'
                                            }
                                        }}
                                    />
                                </Stack>
                            </Grid>
                        </Grid>
                    </Paper>
                )}
            </Box>

            <Dialog open={showSubmitConfirm} onClose={() => setShowSubmitConfirm(false)}>
                <DialogTitle>Finish Section 1?</DialogTitle>
                <DialogContent>
                    <Typography>You are about to finish the MCQ and Email section. You cannot return to this section once submitted. All your progress will be saved.</Typography>
                    <Box className="mt-4 p-3 bg-zinc-50 rounded">
                        <Typography variant="body2">• MCQs Answered: {Object.keys(answers).length}/25</Typography>
                        <Typography variant="body2">• Email Content: {emailValues.body?.length || 0} characters</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={onComplete}>Confirm Submit</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
