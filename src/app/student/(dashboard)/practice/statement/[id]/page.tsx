'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Stack, Button, CircularProgress, Alert,
    LinearProgress, Divider
} from '@mui/material';
import { ArrowBack, Replay } from '@mui/icons-material';
import FortuneSheetWrapper from '@/components/exam/FortuneSheetWrapper';
import { convertToFortuneSheetData } from '@/utils/fortuneSheetAdapter';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
    id: string; title: string; difficulty: string | null;
    template_content: string;
}

type SessionState = 'idle' | 'active' | 'finished';

function pad2(n: number) { return String(n).padStart(2, '0'); }

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatementPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [template, setTemplate] = useState<Template | null>(null);
    const [isMarathi, setIsMarathi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Practice state
    const [referenceData, setReferenceData] = useState<any[]>([]);
    const [studentData, setStudentData] = useState<any[]>([]);
    
    const [sessionState, setSessionState] = useState<SessionState>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [results, setResults] = useState<{ accuracy: number; wpm: number; mistakes: number } | null>(null);

    const startTimeRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);
    useEffect(() => () => stopTimer(), [stopTimer]);

    const timeStr = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

    // ─── Fetch template ───────────────────────────────────────────────────────

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/student/practice/statement');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.templates ?? []).find((t: Template) => t.id === id);
                if (!found) throw new Error('Statement not found.');
                
                setTemplate(found);
                setIsMarathi(!!json.is_marathi);

                const refData = convertToFortuneSheetData(found.template_content, "Reference");
                setReferenceData(refData);
                
                // For student practice, we give them an empty sheet with the same name
                setStudentData([{ name: "My Practice", status: 1 }]);

            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleStudentDataChange = (data: any[]) => {
        if (sessionState === 'idle') {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 500);
        }
        setStudentData(data);
    };

    const handleFinish = useCallback(async () => {
        stopTimer();
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
        setSessionState('finished');

        // Scoring
        let correctCells = 0, totalCells = 0, mistakes = 0;
        let totalCharsTyped = 0;

        const refSheet = referenceData[0]?.data || [];
        const studentSheet = studentData[0]?.data || [];

        refSheet.forEach((row: any[], r: number) => {
            row.forEach((cell: any, c: number) => {
                const refVal = String(cell?.v ?? '').trim();
                if (refVal) {
                    totalCells++;
                    const typedCell = studentSheet[r]?.[c];
                    const typedVal = String(typedCell?.v ?? '').trim();
                    
                    if (typedVal === refVal) {
                        correctCells++;
                    } else {
                        mistakes++;
                    }
                }
            });
        });

        // Count all typed characters
        studentSheet.forEach((row: any[]) => {
            row?.forEach((cell: any) => {
                const typedVal = String(cell?.v ?? '').trim();
                totalCharsTyped += typedVal.length;
            });
        });

        const accuracy = Math.round((correctCells / Math.max(1, totalCells)) * 100);
        const wpm = Math.round((totalCharsTyped / 5) / (secs / 60));

        setResults({ accuracy, wpm, mistakes });

        setSaving(true);
        try {
            await fetch('/api/student/practice/statement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: id, wpm, accuracy,
                    mistakes, duration_seconds: secs,
                }),
            });
        } catch { } finally { setSaving(false); }
    }, [referenceData, studentData, id, stopTimer]);

    const reset = () => {
        stopTimer(); setElapsed(0); setSessionState('idle');
        setStudentData([{ name: "My Practice", status: 1 }]);
        setResults(null);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!template) return null;

    const isPassed = (results?.accuracy ?? 0) >= 80;

    return (
        <Box sx={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 1400, bgcolor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            {/* ── Top Bar ── */}
            <Box sx={{ bgcolor: '#217346', px: 2, py: 1.5, color: 'white' }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Button size="small" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/statement')}
                        sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined">
                        Exit
                    </Button>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 18 : 16 }}>
                        {template.title} — Excel Practice
                    </Typography>
                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                    <Stack direction="row" spacing={3}>
                        <Box><Typography variant="caption" sx={{ opacity: 0.8 }}>Timer</Typography><Typography sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{timeStr}</Typography></Box>
                    </Stack>
                    <Button sx={{ ml: 'auto', bgcolor: '#fff', color: '#217346', '&:hover': { bgcolor: '#eee' }, px: 3, fontWeight: 700 }}
                        onClick={handleFinish} disabled={sessionState === 'finished'}>
                        Finish
                    </Button>
                </Stack>
            </Box>

            {saving && <LinearProgress />}

            {/* ── Result Screen Overlay ── */}
            {sessionState === 'finished' && results && (
                <Box sx={{ p: 4, bgcolor: isPassed ? '#f0fdf4' : '#fffbeb', borderBottom: '2px solid #ccc' }}>
                    <Stack direction="row" alignItems="center" spacing={4} justifyContent="center">
                        <Box textAlign="center">
                            <Typography variant="h4" fontWeight={800} color={isPassed ? 'success.main' : 'warning.main'}>
                                {results.accuracy}% Accuracy
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Goal is 80%</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="h4" fontWeight={800} color="primary.main">{results.wpm} WPM</Typography>
                            <Typography variant="caption" color="text.secondary">Gross Speed</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography variant="h4" fontWeight={800} color="error.main">{results.mistakes}</Typography>
                            <Typography variant="caption" color="text.secondary">Incorrect Cells</Typography>
                        </Box>
                        <Stack spacing={1}>
                            <Button variant="contained" onClick={reset} startIcon={<Replay />}>Try Again</Button>
                            <Button variant="outlined" onClick={() => router.push('/student/practice/statement')}>Back to List</Button>
                        </Stack>
                    </Stack>
                </Box>
            )}

            {/* ── Main Canvas ── */}
            <Box sx={{ bgcolor: '#808080', p: 2, display: 'flex', gap: 2, height: 'calc(100vh - 80px)', overflow: 'auto' }}>
                {/* Reference Grid */}
                <Box sx={{ flex: 1, minWidth: 500, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700, mb: 0.5 }}>REFERENCE SHEET (Read Only)</Typography>
                    <Box sx={{ flex: 1, bgcolor: '#fff', boxShadow: 4 }}>
                        <FortuneSheetWrapper data={referenceData} readOnly={true} />
                    </Box>
                </Box>

                {/* Practice Grid */}
                <Box sx={{ flex: 1, minWidth: 500, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700, mb: 0.5 }}>YOUR EXCEL EDITOR</Typography>
                    <Box sx={{ flex: 1, bgcolor: '#fff', boxShadow: 4 }}>
                        <FortuneSheetWrapper data={studentData} onChange={handleStudentDataChange} readOnly={false} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
