'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Box, Typography, Button, Paper, Stack, Grid, Tab, Tabs, Chip, Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup, Divider } from '@mui/material';
import { Timer, Description, TableChart, CheckCircle, FormatBold, FormatItalic, FormatUnderlined, FormatAlignLeft, FormatAlignCenter } from '@mui/icons-material';
import FortuneSheetWrapper from './FortuneSheetWrapper';
import { convertToFortuneSheetData } from '../../utils/fortuneSheetAdapter';

// ─── Letter Renderer ────────────────────────────────────────────────────────

function LetterDisplay({ content, isMarathi }: { content: any; isMarathi: boolean }) {
    let parsed: any = null;
    try { parsed = JSON.parse(content ?? '{}'); } catch { parsed = null; }

    const sx = isMarathi
        ? { fontFamily: '"Kruti Dev 010", Arial, sans-serif', fontSize: '20px' }
        : { fontFamily: 'inherit', fontSize: '14px' };

    if (!parsed) return (
        <Box sx={{ whiteSpace: 'pre-wrap', ...sx, lineHeight: 2 }}>{content}</Box>
    );

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
                    <span>{parsed.ref_number}</span>
                    <span>{parsed.date}</span>
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



// ─── Main Component ───────────────────────────────────────────────────────────

function LetterEditor({ isMarathi }: { isMarathi: boolean }) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [charCount, setCharCount] = useState(0);

    const execCmd = useCallback((cmd: string, val?: string) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val);
    }, []);

    const updateCount = () => {
        setCharCount(editorRef.current?.innerText?.length ?? 0);
    };

    return (
        <Box>
            {/* Formatting toolbar */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{
                mb: 1, p: 0.5, border: '1px solid', borderColor: 'divider',
                borderRadius: 1, bgcolor: 'grey.50', flexWrap: 'wrap',
            }}>
                <ToggleButtonGroup size="small">
                    <ToggleButton value="bold" title="Bold (Ctrl+B)" onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}>
                        <FormatBold fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="italic" title="Italic (Ctrl+I)" onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}>
                        <FormatItalic fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="underline" title="Underline (Ctrl+U)" onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}>
                        <FormatUnderlined fontSize="small" />
                    </ToggleButton>
                </ToggleButtonGroup>
                <Divider orientation="vertical" flexItem />
                <ToggleButtonGroup size="small">
                    <ToggleButton value="left" title="Align Left" onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }}>
                        <FormatAlignLeft fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="center" title="Center Align" onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }}>
                        <FormatAlignCenter fontSize="small" />
                    </ToggleButton>
                </ToggleButtonGroup>
                <Box sx={{ ml: 'auto', pr: 1 }}>
                    <Chip label={`${charCount} chars`} size="small" variant="outlined" />
                </Box>
            </Stack>

            {/* Rich-text editor area */}
            <Box
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={updateCount}
                data-placeholder="Type the letter exactly as shown in the reference..."
                sx={{
                    minHeight: 500,
                    p: 2,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    outline: 'none',
                    fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Segoe UI", system-ui, sans-serif',
                    fontSize: isMarathi ? 20 : 14,
                    lineHeight: 2,
                    color: '#1e293b',
                    overflowY: 'auto',
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

export default function ExamLetterStatement({ letter, statement, duration, onComplete }: any) {
    const [letterHtml, setLetterHtml] = useState('');
    const [statementGrid, setStatementGrid] = useState<any[]>([]);
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [activeTab, setActiveTab] = useState<'letter' | 'statement'>('letter');
    const [confirmOpen, setConfirmOpen] = useState(false);

    const isMarathi = letter?.courses?.language_name?.toLowerCase().includes('marathi') ||
        letter?.title?.toLowerCase().includes('marathi') ||
        statement?.title?.toLowerCase().includes('marathi');

    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        const t = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(t); onCompleteRef.current(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formatTime = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
    const timerCritical = timeLeft < 300;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* ── Header Bar ── */}
            <Paper elevation={2} sx={{
                px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 64, zIndex: 20, borderRadius: 2,
            }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label="Letter Writing" value="letter" icon={<Description />} iconPosition="start" />
                    <Tab label="Statement (Excel)" value="statement" icon={<TableChart />} iconPosition="start" />
                </Tabs>

                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{
                        px: 3, py: 1, borderRadius: '999px', border: '2px solid',
                        borderColor: timerCritical ? 'error.main' : 'primary.main',
                        color: timerCritical ? 'error.main' : 'primary.main',
                        display: 'flex', alignItems: 'center', gap: 1,
                        animation: timerCritical ? 'pulse 1s infinite' : 'none',
                        '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } }
                    }}>
                        <Timer fontSize="small" />
                        <Typography variant="h6" fontFamily="monospace" fontWeight={700}>{formatTime(timeLeft)}</Typography>
                    </Box>
                    <Button variant="contained" color="success" startIcon={<CheckCircle />}
                        onClick={() => setConfirmOpen(true)}>
                        Submit Section 2
                    </Button>
                </Stack>
            </Paper>

            {/* ── Letter Writing ── */}
            {activeTab === 'letter' && (
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Grid container spacing={3}>
                        {/* Reference */}
                        <Grid item xs={12} lg={6}>
                            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                📄 Reference Letter
                            </Typography>
                            <Paper variant="outlined" sx={{
                                p: 4, minHeight: 520, bgcolor: '#fafafa',
                                userSelect: 'none', pointerEvents: 'none', overflowY: 'auto',
                                borderRight: '3px solid', borderRightColor: 'divider',
                            }}>
                                {letter ? (
                                    <LetterDisplay content={letter.template_content} isMarathi={isMarathi} />
                                ) : (
                                    <Typography color="text.secondary">No letter template assigned for this exam.</Typography>
                                )}
                            </Paper>
                        </Grid>

                        {/* Editor */}
                        <Grid item xs={12} lg={6}>
                            <Typography variant="overline" color="primary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>✏️ Your Editor</Typography>
                            <LetterEditor isMarathi={isMarathi} />
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* ── Statement / Table ── */}
            {activeTab === 'statement' && (
                <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Grid container spacing={3}>
                        {/* Reference Table */}
                        <Grid item xs={12}>
                            <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                📊 Reference Table (Read Only)
                            </Typography>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fafafa', mb: 3, userSelect: 'none', pointerEvents: 'none' }}>
                                {statement ? (
                                    <FortuneSheetWrapper data={convertToFortuneSheetData(statement.template_content, "Reference")} readOnly={true} />
                                ) : (
                                    <Typography color="text.secondary">No statement template assigned.</Typography>
                                )}
                            </Paper>

                            <Typography variant="overline" color="primary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                ✏️ Your Statement Editor (Fill in the table below)
                            </Typography>
                            {statement ? (
                                <FortuneSheetWrapper 
                                    data={convertToFortuneSheetData(statement.template_content, "My Statement")} 
                                    onChange={(updatedData) => setStatementGrid(updatedData)} 
                                    readOnly={false} 
                                />
                            ) : (
                                <Typography color="text.secondary">No statement template assigned.</Typography>
                            )}
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* ── Confirm Submit Dialog ── */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Submit Section 2?</DialogTitle>
                <DialogContent>
                    <Typography>You are about to submit Letter & Statement. This cannot be undone.</Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2">• Letter: typed (check editor)</Typography>
                        <Typography variant="body2">• Statement: Table filled</Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={onComplete}>Confirm & Continue</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
