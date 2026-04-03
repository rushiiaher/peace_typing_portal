'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, CircularProgress, Alert, Button, IconButton, Divider } from '@mui/material';
import {
    ArrowBack, Replay, CheckCircle, Save, Undo, Redo,
    Article, GridView, OpenInFull, ZoomIn, Search
} from '@mui/icons-material';
import { Editor } from '@tinymce/tinymce-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LetterParts {
    letterhead?: string;
    sender_address?: string;
    ref_number?: string;
    date?: string;
    receiver_address?: string;
    subject?: string;
    reference_line?: string;
    salutation?: string;
    body_para_1?: string;
    body_para_2?: string;
    body_para_3?: string;
    complimentary_close?: string;
    subscription?: string;
    designation?: string;
    enclosure?: string;
}

interface Template {
    id: string;
    title: string;
    category: string | null;
    template_content: string;
    sample_content: string | null;
    attempted: boolean;
    best_accuracy: number | null;
    best_wpm: number | null;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

/** Build flat expected text from letter parts in correct postal order */
function buildExpectedText(p: LetterParts): string {
    const lines: string[] = [];
    if (p.letterhead) lines.push(p.letterhead, '');
    if (p.sender_address) lines.push(p.sender_address, '');
    if (p.ref_number || p.date) {
        const left = p.ref_number ? `Ref. No : ${p.ref_number}` : '';
        const right = p.date ? `Date : ${p.date}` : '';
        if (left && right) lines.push(`${left}                    ${right}`);
        else lines.push(left || right);
        lines.push('');
    }
    lines.push('To,');
    if (p.receiver_address) lines.push(p.receiver_address, '');
    if (p.subject) lines.push(`Subject : ${p.subject}`);
    if (p.reference_line) lines.push(`Reference : ${p.reference_line}`);
    if (p.subject || p.reference_line) lines.push('');
    if (p.salutation) lines.push(p.salutation, '');
    if (p.body_para_1) lines.push(p.body_para_1, '');
    if (p.body_para_2) lines.push(p.body_para_2, '');
    if (p.body_para_3) lines.push(p.body_para_3, '');
    if (p.complimentary_close) lines.push(p.complimentary_close, '');
    if (p.subscription) lines.push(p.subscription);
    if (p.designation) lines.push(p.designation, '');
    if (p.enclosure) lines.push(`Encl. : ${p.enclosure}`);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Left pane: formatted letter renderer ────────────────────────────────────

function LetterPage({ p, isMarathi }: { p: LetterParts; isMarathi: boolean }) {
    const ff = isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Calibri, "Segoe UI", sans-serif';
    const fs = isMarathi ? '16pt' : '11pt';
    return (
        <div style={{ fontFamily: ff, fontSize: fs, lineHeight: 1.6, color: '#111' }}>
            {/* Letterhead */}
            {p.letterhead && (
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    {p.letterhead.split('\n').map((line, i) => (
                        <div key={i} style={{
                            fontWeight: 'bold', textDecoration: i === 0 ? 'underline' : 'none',
                            textTransform: 'uppercase', fontSize: '14pt',
                        }}>{line}</div>
                    ))}
                </div>
            )}
            {/* Sender address */}
            {p.sender_address && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    {p.sender_address.split('\n').map((line, i) => (
                        <div key={i} style={{ fontSize: '11pt' }}>{line}</div>
                    ))}
                </div>
            )}
            {/* Ref + Date */}
            {(p.ref_number || p.date) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                    {p.ref_number && <span style={{ fontWeight: 'bold' }}>Ref. No : {p.ref_number}</span>}
                    {p.date && <span style={{ fontWeight: 'bold' }}>Date : {p.date}</span>}
                </div>
            )}
            {/* Inside address */}
            <div style={{ marginBottom: 4, fontWeight: 'bold' }}>To,</div>
            {p.receiver_address && (
                <div style={{ marginBottom: 20 }}>
                    {p.receiver_address.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}
            {/* Subject */}
            {p.subject && (
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: 4, textAlign: 'center' }}>
                    Subject : {p.subject}
                </div>
            )}
            {p.reference_line && (
                <div style={{ fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                    Reference : {p.reference_line}
                </div>
            )}
            {/* Salutation */}
            {p.salutation && <div style={{ marginBottom: 12 }}>{p.salutation}</div>}
            {/* Body paragraphs */}
            {[p.body_para_1, p.body_para_2, p.body_para_3].map((para, i) =>
                para ? (
                    <div key={i} style={{
                        textAlign: 'justify', marginBottom: 16,
                        textIndent: '40px',
                    }}>{para}</div>
                ) : null
            )}
            {/* Complimentary close */}
            {p.complimentary_close && (
                <div style={{ marginBottom: 8 }}>{p.complimentary_close}</div>
            )}
            {/* Subscription + designation */}
            {(p.subscription || p.designation) && (
                <Box sx={{ mt: 4, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {p.subscription && <div style={{ fontWeight: 'bold' }}>{p.subscription}</div>}
                    <div style={{ height: 40 }} />
                    {p.designation && <div style={{ fontWeight: 'bold' }}>{p.designation}</div>}
                </Box>
            )}
            {/* Enclosure */}
            {p.enclosure && (
                <div style={{ marginTop: 20, fontWeight: 'bold' }}>Encl. : {p.enclosure}</div>
            )}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LetterPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [template, setTemplate] = useState<Template | null>(null);
    const [isMarathi, setIsMarathi] = useState(false);
    const [parts, setParts] = useState<LetterParts>({});
    const [expectedText, setExpectedText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Typing state
    const [content, setContent] = useState('');
    const [sessionState, setSessionState] = useState<'idle' | 'active' | 'finished'>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [finalWpm, setFinalWpm] = useState(0);
    const [finalAccuracy, setFinalAccuracy] = useState(0);
    const [finalMistakes, setFinalMistakes] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/student/practice/letter');
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                const found = (json.templates ?? []).find((t: Template) => t.id === id);
                if (!found) throw new Error('Template not found.');
                setTemplate(found);
                setIsMarathi(!!json.is_marathi);
                let parsed: LetterParts = {};
                try { parsed = JSON.parse(found.template_content); } catch { }
                setParts(parsed);
                setExpectedText(buildExpectedText(parsed));
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    // ── Finish ─────────────────────────────────────────────────────────────────

    const finishSession = useCallback(async (currentContent: string, secs: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('finished');

        // Helper to normalize text for comparison
        const normalize = (t: string) => t.replace(/\s+/g, ' ').trim();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = currentContent;
        const typedPlain = normalize(tempDiv.innerText || tempDiv.textContent || '');
        const expectedPlain = normalize(expectedText);

        let mistakes = 0;
        const typedLen = typedPlain.length;
        const compareLen = Math.min(typedLen, expectedPlain.length);

        for (let i = 0; i < compareLen; i++) {
            if (typedPlain[i] !== expectedPlain[i]) mistakes++;
        }

        // Calculate WPM based on actual content typed
        const words = typedPlain.split(' ').filter(Boolean).length;
        const wpm = Math.round(words / (secs / 60 || 0.001));

        // Accuracy = (Correct / Total Typed)
        const accuracy = typedLen > 0
            ? Math.max(0, Math.round(((typedLen - mistakes) / typedLen) * 100))
            : 100;

        setFinalWpm(wpm);
        setFinalAccuracy(accuracy);
        setFinalMistakes(mistakes);

        setSaving(true);
        try {
            await fetch('/api/student/practice/letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template_id: id, wpm, accuracy, mistakes, duration_seconds: secs }),
            });
        } catch { } finally { setSaving(false); }
    }, [id, expectedText]);

    // ── Editor change handler ──────────────────────────────────────────────────

    const handleEditorChange = (newContent: string) => {
        if (sessionState === 'finished') return;

        if (sessionState === 'idle' && newContent.length > 0) {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);
        }

        setContent(newContent);
    };

    // ── Reset ──────────────────────────────────────────────────────────────────

    const reset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setSessionState('idle');
        setContent('');
        setElapsed(0);
        setFinalWpm(0); setFinalAccuracy(0); setFinalMistakes(0);
    };

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!template) return null;

    const timeStr = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;

    // Live Word Count
    const tempDivForCount = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (tempDivForCount) tempDivForCount.innerHTML = content;
    const livePlain = tempDivForCount ? (tempDivForCount.innerText || tempDivForCount.textContent || '').trim() : '';
    const liveWords = livePlain.split(/\s+/).filter(Boolean).length;
    const liveWpm = elapsed > 0 ? Math.round(liveWords / (elapsed / 60)) : 0;

    // ── Result screen ──────────────────────────────────────────────────────────

    if (sessionState === 'finished') {
        const passed = finalAccuracy >= 80;
        return (
            <Box sx={{
                minHeight: '100vh', bgcolor: '#1e3a5f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Box sx={{
                    bgcolor: 'white', borderRadius: 3, p: 5, maxWidth: 520, width: '100%', mx: 2,
                    textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}>
                    <CheckCircle sx={{ fontSize: 72, color: passed ? '#16a34a' : '#f59e0b', mb: 2 }} />
                    <Typography variant="h4" fontWeight={800} gutterBottom>
                        {passed ? '🎉 Practice Completed!' : '💪 Keep Practising!'}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 3, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 22 : 16 }}>{template.title}</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5, mb: 3 }}>
                        {[
                            { label: 'WPM', value: String(finalWpm), color: '#2563eb' },
                            { label: 'Accuracy', value: `${finalAccuracy}%`, color: passed ? '#16a34a' : '#f59e0b' },
                            { label: 'Mistakes', value: String(finalMistakes), color: '#dc2626' },
                            { label: 'Time', value: timeStr, color: '#475569' },
                        ].map(s => (
                            <Box key={s.label} sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                <Typography variant="h5" fontWeight={800} color={s.color}>{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</Typography>
                            </Box>
                        ))}
                    </Box>
                    <Alert severity="info" sx={{ mb: 2, textAlign: 'left', fontSize: 13 }}>
                        {passed ? 'Great job! Your drafting skills are excellent.' : 'Drafting requires attention to detail. Ensure your content matches the reference precisely.'}
                    </Alert>
                    {saving && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>Saving…</Typography>}
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/letter')}>
                            Exit
                        </Button>
                        <Button variant="contained" startIcon={<Replay />} onClick={reset}>
                            Restart
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{
            position: 'fixed', inset: 0, zIndex: 1400,
            display: 'flex', flexDirection: 'column',
            bgcolor: '#f3f2f1',
            fontFamily: '"Segoe UI", Tahoma, sans-serif',
        }}>
            {/* ── Main Workspace ── */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', bgcolor: '#808080' }}>
                {/* Left: Reference Question (50% Width) */}
                <Box sx={{
                    width: '50%',
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRight: '2px solid #333',
                    p: 4,
                    bgcolor: '#666'
                }}>
                    <Typography textAlign="center" sx={{ color: 'white', fontSize: 11, fontWeight: 700, mb: 3, letterSpacing: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                        REFERENCE DOCUMENT
                    </Typography>
                    <Box sx={{
                        bgcolor: 'white',
                        width: '100%',
                        maxWidth: '560px',
                        minHeight: '794px',
                        p: '60px',
                        boxShadow: '0 15px 50px rgba(0,0,0,0.6)',
                        position: 'relative',
                        mb: 6
                    }}>
                        <LetterPage p={parts} isMarathi={isMarathi} />
                    </Box>
                </Box>

                {/* Right: TinyMCE Editor Workspace (50% Width) */}
                <Box sx={{
                    width: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'white', // Changed to white for seamless look
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <Editor
                        licenseKey="gpl"
                        value={content}
                        onEditorChange={handleEditorChange}
                        init={{
                            base_url: '/tinymce',
                            suffix: '.min',
                            height: '100%',
                            width: '100%',
                            menubar: true,
                            plugins: [
                                'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
                                'anchor', 'searchreplace', 'visualblocks', 'fullscreen',
                                'insertdatetime', 'table', 'help', 'wordcount'
                            ],
                            toolbar: 'undo redo | blocks fontfamily fontsize | ' +
                                'bold italic underline | alignleft aligncenter ' +
                                'alignright alignjustify | table | bullist numlist outdent indent | ' +
                                'removeformat | help',
                            table_default_attributes: { border: '0' },
                            table_default_styles: { 'border-collapse': 'collapse', 'width': '100%' },
                            table_appearance_options: false,
                            content_style: `
                                body {
                                    font-family: ${isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Calibri, "Segoe UI", sans-serif'};
                                    font-size: ${isMarathi ? '16pt' : '11pt'};
                                    padding: 50px;
                                    margin: 0;
                                    line-height: 1.5;
                                }
                            `,
                            branding: false,
                            statusbar: true,
                            elementpath: false,
                            promotion: false,
                            help_accessibility: false,
                            skin: 'oxide',
                        }}
                    />
                </Box>
            </Box>

            {/* ── Status Bar ── */}
            <Box sx={{ bgcolor: '#2b579a', height: 32, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>WORD COUNT: {liveWords}</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>WPM: {liveWpm}</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600 }}>TIME: {timeStr}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => finishSession(content, elapsed || 1)}
                        sx={{ bgcolor: '#ffffff', color: '#2b579a', '&:hover': { bgcolor: '#f0f0f0' }, textTransform: 'none', fontWeight: 700, fontSize: 11, height: 22 }}
                    >
                        Submit Work
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)', my: 1 }} />
                    <IconButton size="small" sx={{ color: 'white' }} onClick={() => router.push('/student/practice/letter')}><ArrowBack sx={{ fontSize: 16 }} /></IconButton>
                </Box>
            </Box>

            <style>{`.tox-promotion { display: none !important; }`}</style>
        </Box>
    );
}
