'use client';

import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, Paper, Stack, Grid, Tab, Tabs, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Timer, Description, TableChart, CheckCircle } from '@mui/icons-material';

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

// ─── Statement Grid Renderer (Read-Only reference) ──────────────────────────

function StatementDisplayGrid({ content }: { content: string }) {
    const parsed = useMemo(() => {
        try { return JSON.parse(content ?? '{}'); } catch { return null; }
    }, [content]);

    if (!parsed?.data) return <Box sx={{ p: 2, color: 'text.secondary' }}>No table data</Box>;

    const data: any[][] = parsed.data;
    const merges: any[] = parsed.merges ?? [];

    // Build merge map: key = "row:col", value = {rowspan, colspan}
    const mergeMap: Record<string, { rowSpan: number; colSpan: number }> = {};
    const hiddenCells = new Set<string>();
    for (const m of merges) {
        const key = `${m.s.r}:${m.s.c}`;
        mergeMap[key] = { rowSpan: m.e.r - m.s.r + 1, colSpan: m.e.c - m.s.c + 1 };
        for (let r = m.s.r; r <= m.e.r; r++) {
            for (let c = m.s.c; c <= m.e.c; c++) {
                if (r === m.s.r && c === m.s.c) continue;
                hiddenCells.add(`${r}:${c}`);
            }
        }
    }

    const styles: Record<string, any> = parsed.styles ?? {};

    const maxCols = Math.max(...data.map((r: any[]) => r.length), 1);

    return (
        <Box sx={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: maxCols * 100 }}>
                <tbody>
                    {data.map((row: any[], rIdx: number) => (
                        <tr key={rIdx}>
                            {Array.from({ length: maxCols }).map((_, cIdx) => {
                                const key = `${rIdx}:${cIdx}`;
                                if (hiddenCells.has(key)) return null;
                                const m = mergeMap[key];
                                const st = styles[key] || {};
                                const cellVal = row[cIdx] ?? '';
                                return (
                                    <td
                                        key={cIdx}
                                        rowSpan={m?.rowSpan}
                                        colSpan={m?.colSpan}
                                        style={{
                                            border: '1px solid #ccc',
                                            padding: '4px 8px',
                                            fontWeight: st.bold ? 700 : 400,
                                            textAlign: st.align || 'left',
                                            fontSize: 13,
                                            whiteSpace: 'pre-wrap',
                                            background: rIdx === 0 ? '#f1f5f9' : 'white',
                                            minWidth: 80,
                                        }}
                                    >
                                        {String(cellVal)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Box>
    );
}

// ─── Student Input Grid ──────────────────────────────────────────────────────

function StatementInputGrid({ refContent, isMarathi }: { refContent: string; isMarathi: boolean }) {
    const parsed = useMemo(() => {
        try { return JSON.parse(refContent ?? '{}'); } catch { return null; }
    }, [refContent]);

    const refData: any[][] = parsed?.data ?? [];
    const rows = Math.max(refData.length, 5);
    const cols = Math.max(...refData.map((r: any[]) => r.length), 4);

    const [grid, setGrid] = useState<string[][]>(() => Array(rows).fill(0).map(() => Array(cols).fill('')));

    const update = (r: number, c: number, val: string) => {
        setGrid(prev => {
            const next = prev.map(row => [...row]);
            next[r][c] = val;
            return next;
        });
    };

    const colHeaders = Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i));

    return (
        <Box sx={{ overflowX: 'auto', border: '2px solid', borderColor: 'primary.200', borderRadius: 1 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: cols * 110 }}>
                <thead>
                    <tr>
                        <th style={{ border: '1px solid #ccc', background: '#e2e8f0', padding: '4px 8px', fontSize: 12, width: 36 }}>#</th>
                        {colHeaders.map(h => (
                            <th key={h} style={{ border: '1px solid #ccc', background: '#e2e8f0', padding: '4px 8px', fontSize: 12, textAlign: 'center', minWidth: 100 }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {grid.map((row, r) => (
                        <tr key={r}>
                            <td style={{ border: '1px solid #ccc', background: '#f8fafc', textAlign: 'center', fontSize: 12, fontWeight: 600, padding: 4 }}>{r + 1}</td>
                            {row.map((val, c) => (
                                <td key={c} style={{ border: '1px solid #ccc', padding: 0, margin: 0 }}>
                                    <input
                                        value={val}
                                        onChange={e => update(r, c, e.target.value)}
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            padding: '5px 8px',
                                            fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'system-ui, sans-serif',
                                            fontSize: isMarathi ? 18 : 13,
                                        }}
                                        onFocus={e => e.target.style.background = '#eff6ff'}
                                        onBlur={e => e.target.style.background = 'white'}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Box>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExamLetterStatement({ letter, statement, duration, onComplete }: any) {
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [activeTab, setActiveTab] = useState<'letter' | 'statement'>('letter');
    const [letterTyped, setLetterTyped] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);

    const isMarathi = letter?.courses?.language_name?.toLowerCase().includes('marathi') ||
        letter?.title?.toLowerCase().includes('marathi') ||
        statement?.title?.toLowerCase().includes('marathi');

    useEffect(() => {
        const t = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(t); onComplete(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [onComplete]);

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
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="overline" color="primary" fontWeight={700}>✏️ Your Editor</Typography>
                                <Chip label={`${letterTyped.length} chars`} size="small" variant="outlined" />
                            </Box>
                            <textarea
                                value={letterTyped}
                                onChange={e => setLetterTyped(e.target.value)}
                                placeholder="Type the letter exactly as shown in the reference..."
                                style={{
                                    width: '100%',
                                    minHeight: 500,
                                    padding: '16px',
                                    border: '2px solid #3b82f6',
                                    borderRadius: 8,
                                    fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : '"Segoe UI", system-ui, sans-serif',
                                    fontSize: isMarathi ? 20 : 14,
                                    lineHeight: 2,
                                    resize: 'vertical',
                                    outline: 'none',
                                    color: '#1e293b',
                                }}
                            />
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
                                    <StatementDisplayGrid content={statement.template_content} />
                                ) : (
                                    <Typography color="text.secondary">No statement template assigned.</Typography>
                                )}
                            </Paper>

                            <Typography variant="overline" color="primary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                                ✏️ Your Statement Editor (Fill in the table below)
                            </Typography>
                            {statement ? (
                                <StatementInputGrid refContent={statement.template_content} isMarathi={isMarathi} />
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
                        <Typography variant="body2">• Letter: {letterTyped.length} characters typed</Typography>
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
