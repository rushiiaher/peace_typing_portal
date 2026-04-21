'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Alert, Button, IconButton, Divider, Tooltip } from '@mui/material';
import {
    Save, Undo, Redo, ArrowBack, Replay, CheckCircle,
    Article, GridView, OpenInFull, ZoomIn, Search
} from '@mui/icons-material';

interface Passage {
    id: string;
    title: string;
    passage_text: string;
    difficulty_level: string | null;
    word_count: number | null;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

const DURATION = 600; // 10 minutes

export default function SpeedPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [passage, setPassage] = useState<Passage | null>(null);
    const [isMarathi, setIsMarathi] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Session
    const [sessionState, setSessionState] = useState<'idle' | 'active' | 'finished'>('idle');
    const [typedText, setTypedText] = useState('');
    const [timeLeft, setTimeLeft] = useState(DURATION);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Results
    const [finalWpm, setFinalWpm] = useState(0);
    const [finalAccuracy, setFinalAccuracy] = useState(0);
    const [finalMistakes, setFinalMistakes] = useState(0);

    // Fetch passage
    useEffect(() => {
        async function fetchPassage() {
            try {
                const res = await fetch('/api/student/practice/speed');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.passages ?? []).find((p: Passage) => p.id === id);
                if (!found) throw new Error('Passage not found.');
                setPassage(found);
                setIsMarathi(!!json.is_marathi);
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        fetchPassage();
    }, [id]);

    const computeStats = useCallback((typed: string, passageText: string, secsSpent: number) => {
        let mistakes = 0;
        const len = Math.min(typed.length, passageText.length);
        for (let i = 0; i < len; i++) {
            if (typed[i] !== passageText[i]) mistakes++;
        }
        const words = typed.trim().split(/\s+/).filter(Boolean).length;
        const mins = secsSpent / 60 || 0.001;
        const wpm = Math.round(words / mins);
        const accuracy = typed.length > 0
            ? Math.round(((typed.length - mistakes) / typed.length) * 100) : 100;
        return { wpm, accuracy, mistakes };
    }, []);

    const finishSession = useCallback(async (typed: string, passageText: string, secsSpent: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('finished');
        const { wpm, accuracy, mistakes } = computeStats(typed, passageText, secsSpent);
        setFinalWpm(wpm);
        setFinalAccuracy(accuracy);
        setFinalMistakes(mistakes);

        setSaving(true);
        try {
            await fetch('/api/student/practice/speed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passage_id: id, wpm, accuracy, mistakes, duration_seconds: secsSpent }),
            });
        } catch { } finally { setSaving(false); }
    }, [id, computeStats]);

    const handleTyping = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (sessionState === 'finished' || !passage) return;
        const value = e.target.value;
        if (value.length > passage.passage_text.length) return;

        if (sessionState === 'idle' && value.length > 0) {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current!);
                        setTypedText(t => {
                            finishSession(t, passage.passage_text, DURATION);
                            return t;
                        });
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        setTypedText(value);
        if (value.length === passage.passage_text.length) {
            const secsSpent = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
            setTimeout(() => finishSession(value, passage.passage_text, secsSpent), 300);
        }
    }, [passage, sessionState, finishSession]);

    const reset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('idle');
        setTypedText('');
        setTimeLeft(DURATION);
        setFinalWpm(0); setFinalAccuracy(0); setFinalMistakes(0);
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!passage) return null;

    const timeStr = `${pad2(Math.floor(timeLeft / 60))}:${pad2(timeLeft % 60)}`;
    const secsSpent = DURATION - timeLeft;
    const wordsCount = typedText.trim().split(/\s+/).filter(Boolean).length;
    const liveWpm = secsSpent > 0 ? Math.round(wordsCount / (secsSpent / 60)) : 0;
    const liveMistakes = (() => {
        let m = 0;
        for (let i = 0; i < typedText.length; i++) { if (typedText[i] !== passage.passage_text[i]) m++; }
        return m;
    })();
    const liveAcc = typedText.length > 0 ? Math.round(((typedText.length - liveMistakes) / typedText.length) * 100) : 100;

    const overlayChars = passage.passage_text.split('').map((char, i) => {
        if (i >= typedText.length) return { char, state: 'pending' as const };
        return { char, state: typedText[i] === char ? 'correct' as const : 'wrong' as const };
    });

    const overlayChunks: { state: 'pending' | 'correct' | 'wrong', text: string }[] = [];
    if (overlayChars.length > 0) {
        let current = { state: overlayChars[0].state, text: overlayChars[0].char };
        for (let i = 1; i < overlayChars.length; i++) {
            if (overlayChars[i].state === current.state) {
                current.text += overlayChars[i].char;
            } else {
                overlayChunks.push(current);
                current = { state: overlayChars[i].state, text: overlayChars[i].char };
            }
        }
        overlayChunks.push(current);
    }

    if (sessionState === 'finished') {
        const passed = finalAccuracy >= 90;
        return (
            <Box sx={{ minHeight: '100vh', bgcolor: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 5, maxWidth: 520, width: '100%', mx: 2, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                    <CheckCircle sx={{ fontSize: 72, color: passed ? '#16a34a' : '#f59e0b', mb: 2 }} />
                    <Typography variant="h4" fontWeight={800} gutterBottom>{passed ? '🎉 Excellent!' : '💪 Good Effort!'}</Typography>
                    <Typography color="text.secondary" sx={{ mb: 3, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 22 : 16 }}>{passage.title}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 3 }}>
                        {[
                            { label: 'WPM', value: String(finalWpm), color: '#2563eb' },
                            { label: 'Accuracy', value: `${finalAccuracy}%`, color: passed ? '#16a34a' : '#f59e0b' },
                            { label: 'Mistakes', value: String(finalMistakes), color: '#dc2626' },
                        ].map(s => (
                            <Box key={s.label} sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {saving && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Saving results…</Typography>}
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/speed')}>All Passages</Button>
                        <Button variant="contained" startIcon={<Replay />} onClick={reset}>Try Again</Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', flexDirection: 'column', bgcolor: '#f3f2f1', fontFamily: '"Segoe UI", Tahoma, sans-serif' }}>
            {/* Title Bar */}
            <Box sx={{ bgcolor: '#2b579a', height: 32, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ bgcolor: 'white', color: '#2b579a', fontWeight: 900, fontSize: 12, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0.2 }}>W</Box>
                    <IconButton size="small" sx={{ color: 'white' }}><Save sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" sx={{ color: 'white' }}><Undo sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" sx={{ color: 'white' }}><Redo sx={{ fontSize: 16 }} /></IconButton>
                    <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.3)', mx: 1 }} />
                    <Typography sx={{ color: 'white', fontSize: 12 }}>{passage.title} - Word</Typography>
                </Box>
                <Typography sx={{ color: 'white', fontSize: 12, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>Speed Typing - 10 Minutes</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button size="small" startIcon={<Replay sx={{ fontSize: 14 }} />} onClick={reset} sx={{ color: 'white', fontSize: 11, textTransform: 'none' }}>Reset</Button>
                    <Button size="small" startIcon={<ArrowBack sx={{ fontSize: 14 }} />} onClick={() => router.push('/student/practice/speed')} sx={{ color: 'white', fontSize: 11, textTransform: 'none' }}>Exit</Button>
                </Box>
            </Box>

            {/* Ribbon Tabs */}
            <Box sx={{ bgcolor: '#2b579a', display: 'flex', px: 1, flexShrink: 0, height: 32 }}>
                {['File', 'Home', 'Insert', 'Design', 'Layout', 'References', 'Mailings', 'Review', 'View'].map(tab => (
                    <Box key={tab} sx={{
                        px: 1.5, display: 'flex', alignItems: 'center', fontSize: 12, cursor: 'pointer',
                        bgcolor: tab === 'Home' ? '#f3f2f1' : 'transparent',
                        color: tab === 'Home' ? '#2b579a' : '#ffffff',
                        fontWeight: tab === 'Home' ? 600 : 400,
                        borderTopLeftRadius: 4, borderTopRightRadius: 4, mr: 0.2, mt: 0.5,
                    }}>{tab}</Box>
                ))}
            </Box>

            {/* Ribbon Content */}
            <Box sx={{ bgcolor: '#f3f2f1', borderBottom: '1px solid #e1dfdd', height: 96, px: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, borderRight: '1px solid #e1dfdd', pr: 2, mr: 1 }}>
                    <Article sx={{ fontSize: 24, color: '#2b579a' }} />
                    <Typography sx={{ fontSize: 10, color: '#605e5c', mt: 0.5 }}>Clipboard</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1, borderRight: '1px solid #e1dfdd', pr: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#323130' }}>Times New Roman</Typography>
                    <Typography sx={{ fontSize: 10, color: '#605e5c', mt: 0.5 }}>Font</Typography>
                </Box>
                <Box flex={1} />
                <Box sx={{ textAlign: 'right', mr: 2 }}>
                    <Typography sx={{ fontSize: 20, fontWeight: 900, color: timeLeft <= 60 ? '#d13438' : '#2b579a', fontFamily: 'monospace' }}>{timeStr}</Typography>
                    <Typography sx={{ fontSize: 9, color: '#605e5c', textTransform: 'uppercase' }}>Remaining Time</Typography>
                </Box>
                <Button variant="contained" onClick={() => finishSession(typedText, passage.passage_text, DURATION - timeLeft)} sx={{ bgcolor: '#2b579a', '&:hover': { bgcolor: '#1d4080' }, textTransform: 'none', fontWeight: 600 }}>Submit Passage</Button>
            </Box>

            {/* Ruler */}
            <Box sx={{ bgcolor: '#f3f2f1', height: 28, borderBottom: '1px solid #e1dfdd', display: 'flex', alignItems: 'flex-end', px: '80px', flexShrink: 0 }}>
                <svg width="100%" height="20">
                    <rect x="0" y="0" width="100%" height="20" fill="white" />
                    {Array.from({ length: 110 }, (_, i) => (
                        <g key={i}>
                            <line x1={i * 12} y1={i % 5 === 0 ? 4 : 12} x2={i * 12} y2={20} stroke="#919191" strokeWidth={i % 5 === 0 ? 1 : 0.5} />
                            {i % 10 === 0 && i > 0 && <text x={i * 12 + 2} y={12} fontSize={8} fill="#323130">{i / 10}</text>}
                        </g>
                    ))}
                </svg>
            </Box>

            {/* Workspace */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', bgcolor: '#e1dfdd' }}>
                <Box sx={{ flex: 1, overflow: 'auto', p: 4, display: 'flex', justifyContent: 'center', borderRight: '1px solid #c8c8c8' }}>
                    <Box
                        sx={{ bgcolor: 'white', width: 560, minHeight: 794, p: '72px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Times New Roman", Times, serif', fontSize: isMarathi ? 22 : 14, lineHeight: 1.9, textAlign: 'justify', whiteSpace: 'pre-wrap', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
                        onCopy={(e) => e.preventDefault()}
                        onCut={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                    >
                        {passage.passage_text}
                    </Box>
                </Box>
                <Box sx={{ flex: 1, overflow: 'auto', p: 4, display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ bgcolor: 'white', width: 560, minHeight: 794, p: '72px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', position: 'relative' }}>
                        <Box sx={{ position: 'absolute', top: '72px', left: '72px', right: '72px', fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Times New Roman", Times, serif', fontSize: isMarathi ? 22 : 14, lineHeight: 1.9, color: 'transparent', whiteSpace: 'pre-wrap', textAlign: 'justify', pointerEvents: 'none', zIndex: 2 }}>
                            {overlayChunks.map((chunk, i) => (
                                <span key={i} style={{ color: chunk.state === 'pending' ? 'transparent' : chunk.state === 'correct' ? '#16a34a' : '#dc2626', backgroundColor: chunk.state === 'wrong' ? '#fee2e2' : 'transparent' }}>{chunk.text}</span>
                            ))}
                            <span style={{ display: 'inline-block', width: 2, height: '1.2em', backgroundColor: '#2563eb', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
                        </Box>
                        <textarea ref={textareaRef} value={typedText} onChange={handleTyping} autoFocus spellCheck={false} onPaste={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} style={{ position: 'absolute', top: '72px', left: '72px', width: 'calc(100% - 144px)', minHeight: 'calc(100% - 144px)', fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Times New Roman", Times, serif', fontSize: isMarathi ? 22 : 14, lineHeight: 1.9, color: 'transparent', caretColor: 'transparent', background: 'transparent', border: 'none', outline: 'none', resize: 'none', zIndex: 3, whiteSpace: 'pre-wrap', textAlign: 'justify', overflow: 'hidden' }} />
                        {sessionState === 'idle' && typedText.length === 0 && (
                            <Box sx={{ position: 'absolute', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.9)', cursor: 'text' }} onClick={() => textareaRef.current?.focus()}>
                                <Typography sx={{ fontWeight: 600, color: '#2b579a', mb: 1 }}>Click to Start Typing</Typography>
                                <Typography variant="caption" color="text.secondary">Type the passage exactly as shown on the left</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Status Bar */}
            <Box sx={{ bgcolor: '#2b579a', height: 24, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11 }}>Page 1 of 1</Typography>
                    <Typography sx={{ fontSize: 11 }}>{wordsCount} words</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700 }}>WPM: {liveWpm} | Acc: {liveAcc}% | Err: {liveMistakes}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                        <Article sx={{ fontSize: 14 }} />
                        <GridView sx={{ fontSize: 14 }} />
                        <OpenInFull sx={{ fontSize: 14 }} />
                    </Box>
                </Box>
            </Box>

            <style>{`
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
                body { overflow: hidden; }
            `}</style>
        </Box>
    );
}
