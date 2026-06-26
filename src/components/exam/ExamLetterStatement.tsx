'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Grid, Tab, Tabs, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    ToggleButton, ToggleButtonGroup, Divider, Tooltip, Alert,
} from '@mui/material';
import {
    Timer, Description, TableChart, CheckCircle,
    FormatBold, FormatItalic, FormatUnderlined,
    FormatAlignLeft, FormatAlignCenter, Lock, LockOpen, EastOutlined,
} from '@mui/icons-material';
import FortuneSheetWrapper from './FortuneSheetWrapper';
import { convertToFortuneSheetData } from '../../utils/fortuneSheetAdapter';

// ── Letter reference renderer ─────────────────────────────────────────────────

function LetterDisplay({ content, isMarathi }: { content: any; isMarathi: boolean }) {
    let parsed: any = null;
    try { parsed = JSON.parse(content ?? '{}'); } catch { parsed = null; }

    const sx = isMarathi
        ? { fontFamily: '"Kruti Dev 010", Arial, sans-serif', fontSize: '20px' }
        : { fontFamily: 'inherit', fontSize: '14px' };

    if (!parsed) return <Box sx={{ whiteSpace: 'pre-wrap', ...sx, lineHeight: 2 }}>{content}</Box>;

    return (
        <Box sx={{ lineHeight: 2.2, ...sx }}>
            {parsed.letterhead && (
                <Box sx={{ textAlign: 'center', fontWeight: 700, textDecoration: 'underline', mb: 1, textTransform: 'uppercase' }}>
                    {parsed.letterhead}
                </Box>
            )}
            {parsed.sender_address && <Box sx={{ mb: 1, whiteSpace: 'pre-line' }}>{parsed.sender_address}</Box>}
            {(parsed.ref_number || parsed.date) && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <span>{parsed.ref_number}</span><span>{parsed.date}</span>
                </Box>
            )}
            {parsed.receiver_address && <Box sx={{ mb: 1, whiteSpace: 'pre-line' }}>{parsed.receiver_address}</Box>}
            {parsed.subject && <Box sx={{ mb: 1, fontWeight: 700 }}>Sub: {parsed.subject}</Box>}
            {parsed.reference_line && <Box sx={{ mb: 1, fontWeight: 700 }}>{parsed.reference_line}</Box>}
            {parsed.salutation && <Box sx={{ mb: 2 }}>{parsed.salutation}</Box>}
            {[parsed.body_para_1, parsed.body_para_2, parsed.body_para_3].filter(Boolean).map((para: string, i: number) => (
                <Box key={i} sx={{ mb: 1.5, textAlign: 'justify', whiteSpace: 'pre-line' }}>{para}</Box>
            ))}
            {parsed.complimentary_close && <Box sx={{ mt: 2 }}>{parsed.complimentary_close}</Box>}
            {parsed.subscription && <Box sx={{ textAlign: 'right' }}>{parsed.subscription}</Box>}
            {parsed.designation && <Box sx={{ textAlign: 'right' }}>{parsed.designation}</Box>}
            {parsed.enclosure && <Box sx={{ mt: 2, fontSize: '0.9em' }}>Encl: {parsed.enclosure}</Box>}
        </Box>
    );
}

// ── Letter editor (imperative ref so HTML is always readable by parent) ───────

interface LetterEditorProps {
    isMarathi: boolean;
    readOnly: boolean;
    editorRef: React.RefObject<HTMLDivElement | null>;
}

function LetterEditor({ isMarathi, readOnly, editorRef }: LetterEditorProps) {
    const [charCount, setCharCount] = useState(0);

    const execCmd = useCallback((cmd: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, undefined);
    }, [editorRef]);

    const updateCount = () => setCharCount(editorRef.current?.innerText?.length ?? 0);

    return (
        <Box>
            {/* Formatting toolbar — hidden when read-only */}
            {!readOnly && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{
                    mb: 1, p: 0.5, border: '1px solid', borderColor: 'divider',
                    borderRadius: 1, bgcolor: 'grey.50', flexWrap: 'wrap',
                }}>
                    <ToggleButtonGroup size="small">
                        <ToggleButton value="bold" title="Bold" onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}>
                            <FormatBold fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="italic" title="Italic" onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}>
                            <FormatItalic fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="underline" title="Underline" onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}>
                            <FormatUnderlined fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Divider orientation="vertical" flexItem />
                    <ToggleButtonGroup size="small">
                        <ToggleButton value="left" title="Left" onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }}>
                            <FormatAlignLeft fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="center" title="Center" onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }}>
                            <FormatAlignCenter fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{ ml: 'auto', pr: 1 }}>
                        <Chip label={`${charCount} chars`} size="small" variant="outlined" />
                    </Box>
                </Stack>
            )}

            <Box
                ref={editorRef}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onInput={updateCount}
                data-placeholder={readOnly ? '' : 'Type the letter exactly as shown in the reference…'}
                sx={{
                    minHeight: 500,
                    p: 2,
                    border: '2px solid',
                    borderColor: readOnly ? 'success.main' : 'primary.main',
                    borderRadius: 1,
                    outline: 'none',
                    bgcolor: readOnly ? '#f0fdf4' : 'background.paper',
                    fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Segoe UI", system-ui, sans-serif',
                    fontSize: isMarathi ? 20 : 14,
                    lineHeight: 2,
                    color: '#1e293b',
                    overflowY: 'auto',
                    cursor: readOnly ? 'default' : 'text',
                    pointerEvents: readOnly ? 'none' : 'auto',
                    '&:empty::before': {
                        content: 'attr(data-placeholder)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                    },
                }}
            />
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExamLetterStatement({ letter, statement, duration, onComplete, isMarathi: isMarathiProp }: any) {
    const [statementGrid, setStatementGrid] = useState<any[]>([]);
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [activeTab, setActiveTab] = useState<'letter' | 'statement'>('letter');

    // Letter sub-flow: idle → submitted
    const [letterSubmitted, setLetterSubmitted] = useState(false);
    const [letterConfirmOpen, setLetterConfirmOpen] = useState(false);

    // Section submit confirm
    const [sectionConfirmOpen, setSectionConfirmOpen] = useState(false);

    const letterEditorRef = useRef<HTMLDivElement>(null);

    const isMarathi = isMarathiProp ??
        (letter?.title?.toLowerCase().includes('marathi') ||
        statement?.title?.toLowerCase().includes('marathi'));

    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    // Countdown timer
    useEffect(() => {
        const t = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(t);
                    const html = letterEditorRef.current?.innerHTML ?? '';
                    onCompleteRef.current({ letterHtml: html, statementGrid });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formatTime = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
    const timerCritical = timeLeft < 300;

    // Tab switch guard — block statement until letter submitted
    const handleTabChange = (_: any, value: 'letter' | 'statement') => {
        if (value === 'statement' && !letterSubmitted) return; // silently blocked; tooltip shown on tab
        setActiveTab(value);
    };

    const submitLetter = () => {
        setLetterSubmitted(true);
        setLetterConfirmOpen(false);
        setActiveTab('statement');
    };

    const submitSection = () => {
        setSectionConfirmOpen(false);
        const html = letterEditorRef.current?.innerHTML ?? '';
        onCompleteRef.current({ letterHtml: html, statementGrid });
    };

    const letterCharCount = letterEditorRef.current?.innerText?.length ?? 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ── Header ── */}
            <Paper elevation={2} sx={{
                px: 3, py: 1.5,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 64, zIndex: 20, borderRadius: 2,
            }}>
                <Tabs value={activeTab} onChange={handleTabChange}>
                    {/* Letter tab — always accessible */}
                    <Tab
                        label="Letter Writing"
                        value="letter"
                        icon={letterSubmitted ? <CheckCircle color="success" fontSize="small" /> : <Description fontSize="small" />}
                        iconPosition="start"
                    />

                    {/* Statement tab — locked until letter submitted */}
                    <Tab
                        label={
                            <Tooltip
                                title={letterSubmitted ? '' : 'Complete Letter Writing first to unlock Statement Writing'}
                                placement="bottom"
                                arrow
                            >
                                <Stack direction="row" alignItems="center" spacing={0.75}>
                                    {letterSubmitted
                                        ? <LockOpen fontSize="small" />
                                        : <Lock fontSize="small" sx={{ color: '#94a3b8' }} />
                                    }
                                    <span>Statement (Excel)</span>
                                    {!letterSubmitted && (
                                        <Chip label="Locked" size="small"
                                            sx={{ bgcolor: '#f1f5f9', color: '#94a3b8', fontSize: 10, height: 18, ml: 0.5 }} />
                                    )}
                                </Stack>
                            </Tooltip>
                        }
                        value="statement"
                        disabled={!letterSubmitted}
                        sx={{
                            opacity: letterSubmitted ? 1 : 0.6,
                            cursor: letterSubmitted ? 'pointer' : 'not-allowed',
                            '&.Mui-disabled': { pointerEvents: 'auto' }, // keep tooltip firing on disabled
                        }}
                    />
                </Tabs>

                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{
                        px: 3, py: 1, borderRadius: '999px', border: '2px solid',
                        borderColor: timerCritical ? 'error.main' : 'primary.main',
                        color: timerCritical ? 'error.main' : 'primary.main',
                        display: 'flex', alignItems: 'center', gap: 1,
                        animation: timerCritical ? 'pulse 1s infinite' : 'none',
                        '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                    }}>
                        <Timer fontSize="small" />
                        <Typography variant="h6" fontFamily="monospace" fontWeight={700}>{formatTime(timeLeft)}</Typography>
                    </Box>

                    {/* Show "Submit Letter" CTA when on letter tab and not yet submitted */}
                    {activeTab === 'letter' && !letterSubmitted && (
                        <Button variant="contained" color="primary" endIcon={<EastOutlined />}
                            onClick={() => setLetterConfirmOpen(true)}>
                            Submit Letter
                        </Button>
                    )}

                    {/* Show "Submit Section 2" only after letter is done and on statement tab */}
                    {letterSubmitted && (
                        <Button variant="contained" color="success" startIcon={<CheckCircle />}
                            onClick={() => setSectionConfirmOpen(true)}>
                            Submit Section 2
                        </Button>
                    )}
                </Stack>
            </Paper>

            {/* ── Letter Writing tab ── */}
            {activeTab === 'letter' && (
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    {letterSubmitted && (
                        <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2, borderRadius: 1 }}>
                            Letter submitted — now complete the Statement Writing to finish Section 2.
                        </Alert>
                    )}
                    <Grid container spacing={3}>
                        <Grid item xs={12} lg={6}>
                            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                📄 Reference Letter
                            </Typography>
                            <Paper variant="outlined" sx={{
                                p: 4, minHeight: 520, bgcolor: '#fafafa',
                                userSelect: 'none', pointerEvents: 'none', overflowY: 'auto',
                                borderRight: '3px solid', borderRightColor: 'divider',
                            }}>
                                {letter
                                    ? <LetterDisplay content={letter.template_content} isMarathi={isMarathi} />
                                    : <Typography color="text.secondary">No letter template assigned.</Typography>
                                }
                            </Paper>
                        </Grid>

                        <Grid item xs={12} lg={6}>
                            <Typography variant="overline" color={letterSubmitted ? 'success.main' : 'primary'}
                                fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                {letterSubmitted ? '✅ Your Letter (Submitted)' : '✏️ Your Editor'}
                            </Typography>
                            <LetterEditor
                                isMarathi={isMarathi}
                                readOnly={letterSubmitted}
                                editorRef={letterEditorRef}
                            />
                            {!letterSubmitted && (
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button variant="contained" color="primary" endIcon={<EastOutlined />}
                                        onClick={() => setLetterConfirmOpen(true)}>
                                        Submit Letter &amp; Unlock Statement
                                    </Button>
                                </Box>
                            )}
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* ── Statement Writing tab — 50:50 split ── */}
            {activeTab === 'statement' && (
                <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Grid container sx={{ height: 'calc(100vh - 180px)', minHeight: 500 }}>
                        {/* Left — Reference (read-only) */}
                        <Grid item xs={12} lg={6} sx={{
                            display: 'flex', flexDirection: 'column',
                            borderRight: { lg: '3px solid' }, borderRightColor: { lg: 'divider' },
                            borderBottom: { xs: '3px solid', lg: 'none' }, borderBottomColor: { xs: 'divider' },
                        }}>
                            <Box sx={{
                                px: 2, py: 1, bgcolor: '#fafafa',
                                borderBottom: '1px solid', borderBottomColor: 'divider',
                                flexShrink: 0,
                            }}>
                                <Typography variant="overline" color="text.secondary" fontWeight={700}>
                                    📊 Reference Table (Read Only)
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, overflow: 'hidden', userSelect: 'none', pointerEvents: 'none' }}>
                                {statement
                                    ? <FortuneSheetWrapper
                                        data={convertToFortuneSheetData(statement.template_content, 'Reference')}
                                        readOnly
                                        isMarathi={isMarathi}
                                        height={-1}  // fills parent
                                      />
                                    : <Box sx={{ p: 3 }}><Typography color="text.secondary">No statement template assigned.</Typography></Box>
                                }
                            </Box>
                        </Grid>

                        {/* Right — Student editor */}
                        <Grid item xs={12} lg={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{
                                px: 2, py: 1, bgcolor: '#eff6ff',
                                borderBottom: '1px solid', borderBottomColor: 'divider',
                                flexShrink: 0,
                            }}>
                                <Typography variant="overline" color="primary" fontWeight={700}>
                                    ✏️ Your Statement Editor
                                </Typography>
                            </Box>
                            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                                {statement
                                    ? <FortuneSheetWrapper
                                        data={[{ name: 'My Statement', celldata: [], status: 1 }]}
                                        onChange={setStatementGrid}
                                        readOnly={false}
                                        isMarathi={isMarathi}
                                        height={-1}  // fills parent
                                      />
                                    : <Box sx={{ p: 3 }}><Typography color="text.secondary">No statement template assigned.</Typography></Box>
                                }
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* ── Letter submit confirm ── */}
            <Dialog open={letterConfirmOpen} onClose={() => setLetterConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Description color="primary" /> Submit Letter Writing?
                </DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        Once submitted, your letter cannot be edited. Statement Writing will unlock immediately.
                    </Typography>
                    <Box sx={{ mt: 1.5, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">
                            Characters typed: <strong>{letterEditorRef.current?.innerText?.length ?? 0}</strong>
                        </Typography>
                    </Box>
                    {(letterEditorRef.current?.innerText?.length ?? 0) < 10 && (
                        <Alert severity="warning" sx={{ mt: 1.5 }}>
                            Your letter appears to be very short. Are you sure you want to submit?
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLetterConfirmOpen(false)}>Keep Editing</Button>
                    <Button variant="contained" color="primary" endIcon={<EastOutlined />} onClick={submitLetter}>
                        Confirm &amp; Unlock Statement
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Section 2 submit confirm ── */}
            <Dialog open={sectionConfirmOpen} onClose={() => setSectionConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Submit Section 2?</DialogTitle>
                <DialogContent>
                    <Typography>You are about to submit Letter &amp; Statement. This cannot be undone.</Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">• Letter: ✅ Submitted</Typography>
                        <Typography variant="body2">• Statement: table data saved</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSectionConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={submitSection}>
                        Confirm &amp; Continue to Section 3
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
