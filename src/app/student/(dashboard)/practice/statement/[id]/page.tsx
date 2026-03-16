'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Typography, Stack, Button, CircularProgress, Alert,
    LinearProgress, Paper, Chip, Divider, Tooltip, Select, MenuItem,
} from '@mui/material';
import {
    ArrowBack, Replay, CheckCircle, Speed, GpsFixed,
    ErrorOutline, Timer, ArrowForward, TableChart,
    FormatBold, FormatItalic, FormatUnderlined, FormatAlignCenter, FormatAlignLeft,
    FormatAlignRight, Functions, BorderAll, WrapText, Sort, FilterList,
    Spellcheck, ModeComment, Calculate, ZoomIn,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
    id: string; title: string; difficulty: string | null;
    template_content: string;
}

type SessionState = 'idle' | 'active' | 'finished';

interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
}

interface MergeRange {
    s: { r: number; c: number };
    e: { r: number; c: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0'); }

const COL_HEADERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Pre-defined Statement Data for Demo if parsing fails
const DEFAULT_GRID = [
    ['', 'NUMBER OF BOOKS IN STOCK', '', '', ''],
    ['', '', '', '', ''],
    ['Serial No.', 'Particulars', '2002', '2003', '2004'],
    ['1', 'Marathi', '1,789', '1,674', '1,800'],
    ['2', 'English', '570', '449', '760'],
    ['3', 'Hindi', '920', '876', '970'],
    ['4', 'Urdu', '450', '878', '910'],
    ['5', 'Gujrati', '1,331', '1,420', '1,749'],
    ['6', 'French', '2', '1,784', '1,983'],
    ['7', 'German', '765', '831', '957'],
    ['8', 'Latin', '1,546', '3,451', '1,765'],
];

// ─── Excel Grid Component ─────────────────────────────────────────────────────

function ExcelGrid({
    grid, isReference, values, onChange, activeCell, setActiveCell, merges = [], styles = {}, onStyleChange, isMarathi,
}: {
    grid: string[][]; isReference: boolean;
    values?: string[][]; onChange?: (r: number, c: number, val: string) => void;
    activeCell?: [number, number]; setActiveCell?: (cell: [number, number]) => void;
    merges?: MergeRange[];
    styles?: Record<string, CellStyle>;
    onStyleChange?: (r: number, c: number, style: Partial<CellStyle>) => void;
    isMarathi?: boolean;
}) {
    const rows = 20;
    const cols = 8;

    // Helper to check if a cell is part of a merge range
    const getMerge = (r: number, c: number) => {
        return merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
    };

    return (
        <Box sx={{
            display: 'grid',
            gridTemplateColumns: `40px repeat(${cols}, minmax(100px, 1fr))`,
            border: '1px solid #ccc',
            bgcolor: '#fff',
            fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'Calibri, Arial, sans-serif',
            fontSize: isMarathi ? 24 : 13,
            userSelect: 'none',
            width: 'fit-content',
            minWidth: '100%',
        }}>
            <Box sx={{ bgcolor: '#e6e6e6', border: '1px solid #ccc', height: 25, position: 'sticky', left: 0, zIndex: 11 }} />
            {COL_HEADERS.slice(0, cols).map((col, i) => (
                <Box key={col} sx={{
                    bgcolor: '#e6e6e6', border: '1px solid #ccc', height: 25,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, color: '#333',
                    position: 'sticky', top: 0, zIndex: 10,
                }}>
                    {col}
                </Box>
            ))}

            {[...Array(rows)].map((_, r) => (
                <Box key={r} sx={{ display: 'contents' }}>
                    <Box sx={{
                        bgcolor: '#e6e6e6', border: '1px solid #ccc', height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600, color: '#333',
                        position: 'sticky', left: 0, zIndex: 9,
                    }}>
                        {r + 1}
                    </Box>

                    {[...Array(cols)].map((_, c) => {
                        const merge = getMerge(r, c);
                        const isMergeRoot = merge ? (merge.s.r === r && merge.s.c === c) : true;
                        const isMerged = merge && !isMergeRoot;

                        if (isMerged) return null;

                        const cellVal = isReference ? (grid[r]?.[c] ?? '') : (values?.[r]?.[c] ?? '');
                        const isActive = activeCell?.[0] === r && activeCell?.[1] === c;
                        const cellStyle = styles[`${r}-${c}`] || {};

                        // Auto alignment for reference based on content if no explicit style
                        let align = cellStyle.align;
                        if (!align && isReference) {
                            if (r === 0) align = 'center';
                            else if (isNaN(Number(cellVal.toString().replace(/,/g, ''))) || cellVal === '') align = 'left';
                            else align = 'right';
                        }

                        return (
                            <Box
                                key={`${r}-${c}`}
                                onClick={() => setActiveCell?.([r, c])}
                                sx={{
                                    border: isActive ? '2px solid #217346' : '1px solid #ddd',
                                    height: merge ? ((merge.e.r - merge.s.r + 1) * 22) : 22,
                                    gridColumn: merge ? `span ${merge.e.c - merge.s.c + 1}` : 'span 1',
                                    gridRow: merge ? `span ${merge.e.r - merge.s.r + 1}` : 'span 1',
                                    px: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                                    bgcolor: isActive ? '#fff' : 'transparent',
                                    cursor: isReference ? 'default' : 'text',
                                    fontWeight: cellStyle.bold || (isReference && r < 3) ? 700 : 400,
                                    fontStyle: cellStyle.italic ? 'italic' : 'normal',
                                    textDecoration: cellStyle.underline ? 'underline' : isReference && r === 0 ? 'underline' : 'none',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    zIndex: isActive ? 12 : 1,
                                }}
                            >
                                {!isReference && isActive ? (
                                    <input
                                        autoFocus
                                        value={cellVal}
                                        onChange={(e) => onChange?.(r, c, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab') {
                                                e.preventDefault();
                                                setActiveCell?.([r, c + 1]);
                                            } else if (e.key === 'Enter') {
                                                e.preventDefault();
                                                setActiveCell?.([r + 1, c]);
                                            }
                                        }}
                                        style={{
                                            width: '100%', border: 'none', outline: 'none',
                                            fontFamily: 'inherit', fontSize: 'inherit', height: '100%',
                                            textAlign: align || 'left',
                                            fontWeight: 'inherit', fontStyle: 'inherit',
                                        }}
                                    />
                                ) : (
                                    <span style={{ width: '100%', textAlign: align || 'left' }}>{cellVal}</span>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatementPracticeSession() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [template, setTemplate] = useState<Template | null>(null);
    const [referenceGrid, setReferenceGrid] = useState<string[][]>(DEFAULT_GRID);
    const [isMarathi, setIsMarathi] = useState(false);
    const [merges, setMerges] = useState<MergeRange[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Practice state
    const [values, setValues] = useState<string[][]>(
        [...Array(20)].map(() => [...Array(10)].map(() => ''))
    );
    const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
    const [activeCell, setActiveCell] = useState<[number, number]>([0, 0]);
    const [sessionState, setSessionState] = useState<SessionState>('idle');
    const [activeTab, setActiveTab] = useState('Home');
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

                // Try to parse grid from template_content
                try {
                    const parsed = JSON.parse(found.template_content);
                    if (parsed.data) {
                        setReferenceGrid(parsed.data);
                        setMerges(parsed.merges || []);
                    } else if (Array.isArray(parsed)) {
                        setReferenceGrid(parsed);
                    }
                } catch {
                    // Fallback to default
                }
            } catch (e: any) { setError(e.message); }
            finally { setLoading(false); }
        }
        load();
    }, [id]);

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleValueChange = (r: number, c: number, val: string) => {
        if (sessionState === 'idle') {
            setSessionState('active');
            startTimeRef.current = Date.now();
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 500);
        }
        setValues(prev => {
            const next = [...prev];
            next[r] = [...next[r]];
            next[r][c] = val;
            return next;
        });
    };

    const updateStyle = (style: Partial<CellStyle>) => {
        const key = `${activeCell[0]}-${activeCell[1]}`;
        setCellStyles(prev => ({
            ...prev,
            [key]: { ...(prev[key] || {}), ...style }
        }));
    };

    const handleFinish = useCallback(async () => {
        stopTimer();
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
        setSessionState('finished');

        // Scoring: check every cell in reference against practice
        let correctCells = 0, totalCells = 0, mistakes = 0;
        let totalCharsTyped = 0;

        referenceGrid.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell.trim()) {
                    totalCells++;
                    const typed = (values[r]?.[c] ?? '').trim();
                    if (typed === cell.trim()) {
                        correctCells++;
                    } else {
                        mistakes++;
                    }
                }
                totalCharsTyped += (values[r]?.[c] ?? '').length;
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
    }, [referenceGrid, values, id, stopTimer]);

    const reset = () => {
        stopTimer(); setElapsed(0); setSessionState('idle');
        setValues([...Array(20)].map(() => [...Array(10)].map(() => '')));
        setResults(null); setActiveCell([0, 0]);
    };

    // Current WPM for live display
    const currentWpm = sessionState === 'active' ? Math.round((values.flat().join('').length / 5) / (elapsed / 60 || 0.01)) : 0;

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 4 }}><Alert severity="error" action={<Button onClick={() => router.back()}>Back</Button>}>{error}</Alert></Box>;
    if (!template) return null;

    const isPassed = (results?.accuracy ?? 0) >= 80;

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1400,
            bgcolor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* ── Excel Ribbon ── */}
            <Box sx={{ bgcolor: '#217346', px: 2, pt: 1, color: 'white' }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 0.5 }}>
                    <Button size="small" startIcon={<ArrowBack />} onClick={() => router.push('/student/practice/statement')}
                        sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined">
                        Exit
                    </Button>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: isMarathi ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit', fontSize: isMarathi ? 18 : 14 }}>
                        {template.title} — Excel Statement Practice
                    </Typography>
                    <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                    <Stack direction="row" spacing={3}>
                        <Box><Typography variant="caption" sx={{ opacity: 0.8 }}>Timer</Typography><Typography sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{timeStr}</Typography></Box>
                        <Box><Typography variant="caption" sx={{ opacity: 0.8 }}>WPM</Typography><Typography sx={{ fontWeight: 800, fontFamily: 'monospace' }}>{currentWpm}</Typography></Box>
                    </Stack>
                    <Button sx={{ ml: 'auto', bgcolor: '#fff', color: '#217346', '&:hover': { bgcolor: '#eee' }, px: 3, fontWeight: 700 }}
                        onClick={handleFinish} disabled={sessionState === 'finished'}>
                        Finish
                    </Button>
                </Stack>

                {/* Ribbon Tabs */}
                <Stack direction="row" spacing={0}>
                    {['File', 'Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map((tab) => (
                        <Box key={tab} onClick={() => setActiveTab(tab)} sx={{
                            px: 1.5, py: 0.5, fontSize: 12, borderRadius: '4px 4px 0 0', cursor: 'pointer',
                            bgcolor: activeTab === tab ? '#fff' : 'transparent',
                            color: activeTab === tab ? '#217346' : '#fff',
                            fontWeight: activeTab === tab ? 700 : 400,
                            '&:hover': { bgcolor: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.2)' },
                        }}>
                            {tab}
                        </Box>
                    ))}
                </Stack>
            </Box>

            {/* ── Ribbon Bar (per active tab) ── */}
            <Box sx={{ bgcolor: '#f3f3f3', borderBottom: '1px solid #ccc', px: 2, py: 0.5, display: 'flex', gap: 0.5, alignItems: 'center', overflowX: 'auto', minHeight: 44, flexWrap: 'nowrap' }}>

                {/* ── HOME (functional) ── */}
                {activeTab === 'Home' && <>
                    <Select value="Calibri" size="small" sx={{ height: 26, fontSize: 12, bgcolor: '#fff', minWidth: 100 }} readOnly>
                        <MenuItem value="Calibri">Calibri</MenuItem>
                    </Select>
                    <Select value={11} size="small" sx={{ height: 26, fontSize: 12, bgcolor: '#fff', minWidth: 50 }} readOnly>
                        <MenuItem value={11}>11</MenuItem>
                    </Select>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="Bold"><Button size="small" onClick={() => updateStyle({ bold: !cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.bold })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.bold ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatBold fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Italic"><Button size="small" onClick={() => updateStyle({ italic: !cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.italic })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.italic ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatItalic fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Underline"><Button size="small" onClick={() => updateStyle({ underline: !cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.underline })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.underline ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatUnderlined fontSize="small" /></Button></Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="Align Left"><Button size="small" onClick={() => updateStyle({ align: 'left' })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.align === 'left' ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatAlignLeft fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Align Center"><Button size="small" onClick={() => updateStyle({ align: 'center' })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.align === 'center' ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatAlignCenter fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Align Right"><Button size="small" onClick={() => updateStyle({ align: 'right' })} sx={{ minWidth: 28, height: 26, p: 0, bgcolor: cellStyles[`${activeCell[0]}-${activeCell[1]}`]?.align === 'right' ? '#dde8ff' : '#fff', border: '1px solid #ccc', color: '#333' }}><FormatAlignRight fontSize="small" /></Button></Tooltip>
                    <Tooltip title="Wrap Text"><span><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fff', border: '1px solid #ccc' }}><WrapText fontSize="small" /></Button></span></Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="All Borders"><span><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fff', border: '1px solid #ccc' }}><BorderAll fontSize="small" /></Button></span></Tooltip>
                </>}

                {/* ── FILE ── */}
                {activeTab === 'File' && [{ label: 'New' }, { label: 'Open' }, { label: 'Save' }, { label: 'Save As' }, { label: 'Print' }, { label: 'Share' }, { label: 'Export' }, { label: 'Close' }].map(({ label }) => (
                    <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 1, minWidth: 'unset' }}>{label}</Button>
                ))}

                {/* ── INSERT ── */}
                {activeTab === 'Insert' && <>
                    {[['PivotTable', 'Table'], ['Pictures', 'Shapes', 'Icons'], ['Bar Chart', 'Line Chart', 'Pie Chart', 'Scatter'], ['Hyperlink'], ['Text Box', 'Header & Footer', 'WordArt'], ['Symbol', 'Equation']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            {gi > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
                            {group.map(label => <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                </>}

                {/* ── PAGE LAYOUT ── */}
                {activeTab === 'Page Layout' && <>
                    {[['Margins', 'Orientation', 'Size', 'Print Area', 'Breaks', 'Print Titles'], ['Width', 'Height', 'Scale'], ['Gridlines', 'Headings'], ['Bring Forward', 'Send Backward', 'Align', 'Group', 'Rotate']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            {gi > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
                            {group.map(label => <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                </>}

                {/* ── FORMULAS ── */}
                {activeTab === 'Formulas' && <>
                    <Tooltip title="Insert Function"><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><Functions fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                    {[['AutoSum', 'Financial', 'Logical', 'Text', 'Date & Time', 'Math & Trig', 'More Functions'], ['Name Manager', 'Define Name', 'Use in Formula'], ['Trace Precedents', 'Trace Dependents', 'Show Formulas', 'Error Checking', 'Evaluate Formula'], ['Calculate Now', 'Calculate Sheet']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                            {group.map(label => <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="Calculate"><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><Calculate fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                </>}

                {/* ── DATA ── */}
                {activeTab === 'Data' && <>
                    {[['From File', 'From Web', 'From Table/Range', 'Recent Sources'], ['Refresh All', 'Properties', 'Edit Links'], ['Sort A→Z', 'Sort Z→A', 'Filter', 'Clear', 'Reapply', 'Advanced'], ['Flash Fill', 'Remove Duplicates', 'Data Validation', 'Consolidate', 'What-If Analysis'], ['Group', 'Ungroup', 'Subtotal']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            {gi > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
                            {group.map((label, li) => li === 0 && gi === 2
                                ? <Tooltip key={label} title={label}><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><Sort fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                                : li === 2 && gi === 2
                                    ? <Tooltip key={label} title={label}><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><FilterList fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                                    : <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                </>}

                {/* ── REVIEW ── */}
                {activeTab === 'Review' && <>
                    <Tooltip title="Spelling"><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><Spellcheck fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                    {[['Thesaurus', 'Smart Lookup', 'Translate'], ['New Comment', 'Delete', 'Previous', 'Next', 'Show Comments'], ['Track Changes', 'Accept', 'Reject'], ['Protect Sheet', 'Protect Workbook', 'Share Workbook']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                            {group.map((label, li) => li === 0 && gi === 1
                                ? <Tooltip key={label} title={label}><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><ModeComment fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                                : <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                </>}

                {/* ── VIEW ── */}
                {activeTab === 'View' && <>
                    {[['Normal', 'Page Break Preview', 'Page Layout', 'Full Screen'], ['Ruler', 'Gridlines', 'Formula Bar', 'Headings'], ['Zoom', '100%', 'Zoom to Selection'], ['New Window', 'Arrange All', 'Freeze Panes', 'Split', 'Hide', 'View Side by Side'], ['Macros']].map((group, gi) => (
                        <Stack key={gi} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            {gi > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
                            {group.map((label, li) => li === 0 && gi === 2
                                ? <Tooltip key={label} title={label}><Button size="small" disabled sx={{ minWidth: 28, height: 26, p: 0, bgcolor: '#fafafa', border: '1px solid #ddd' }}><ZoomIn fontSize="small" sx={{ color: '#aaa' }} /></Button></Tooltip>
                                : <Button key={label} size="small" disabled sx={{ fontSize: 11, height: 26, color: '#888', border: '1px solid #ddd', bgcolor: '#fafafa', textTransform: 'none', px: 0.8, minWidth: 'unset' }}>{label}</Button>)}
                        </Stack>
                    ))}
                </>}

            </Box>

            {/* Formula Bar */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: '#fff', borderBottom: '1px solid #ccc', px: 1, py: 0.3 }}>
                <Box sx={{ minWidth: 40, textAlign: 'center', fontWeight: 600, color: '#666', fontSize: 12 }}>
                    {COL_HEADERS[activeCell[1]]}{activeCell[0] + 1}
                </Box>
                <Divider orientation="vertical" flexItem />
                <Functions sx={{ color: '#666', fontSize: 18 }} />
                <Box sx={{ flex: 1, fontSize: 13, color: '#333', minHeight: '1.2em' }}>
                    {values[activeCell[0]]?.[activeCell[1]] || ''}
                </Box>
            </Stack>

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
            <Box sx={{ bgcolor: '#808080', p: 2, display: 'flex', gap: 2, height: 'calc(100vh - 180px)', overflow: 'auto' }}>
                {/* Reference Grid */}
                <Box sx={{ flex: 1, minWidth: 600 }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700, mb: 0.5 }}>REFERENCE SHEET (Look at this for formatting)</Typography>
                    <Box sx={{ bgcolor: '#fff', p: 1, boxShadow: 4, height: '100%', overflow: 'auto' }}>
                        <ExcelGrid grid={referenceGrid} isReference={true} merges={merges} />
                    </Box>
                </Box>

                {/* Practice Grid */}
                <Box sx={{ flex: 1, minWidth: 600 }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700, mb: 0.5 }}>YOUR WORK AREA (Use buttons above to format)</Typography>
                    <Box sx={{ bgcolor: '#fff', p: 1, boxShadow: 4, height: '100%', overflow: 'auto' }}>
                        <ExcelGrid
                            grid={referenceGrid}
                            isReference={false}
                            values={values}
                            merges={merges}
                            styles={cellStyles}
                            onChange={handleValueChange}
                            activeCell={activeCell}
                            setActiveCell={setActiveCell}
                            onStyleChange={(r, c, s) => {
                                setCellStyles(prev => ({
                                    ...prev,
                                    [`${r}-${c}`]: { ...(prev[`${r}-${c}`] || {}), ...s }
                                }));
                            }}
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
