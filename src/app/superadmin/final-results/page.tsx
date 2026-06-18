'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Stack, Paper, Grid, Card, CardContent,
    FormControl, InputLabel, Select, MenuItem, TextField, Button,
    Chip, Alert, Skeleton, Table, TableHead, TableRow, TableCell,
    TableBody, TableContainer, TablePagination, Divider, InputAdornment,
    Checkbox, Tooltip, IconButton, Switch, FormControlLabel, Avatar,
} from '@mui/material';
import {
    EmojiEvents, Download, FilterList, Refresh, CheckCircle,
    Cancel, People, Search, PercentOutlined, PhotoLibrary,
    CheckBox as CheckBoxIcon, CheckBoxOutlineBlank, IndeterminateCheckBox,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import JSZip from 'jszip';

interface Institute { id: string; name: string; }
interface Course { id: string; name: string; code: string; }
interface Batch { id: string; batch_name: string; batch_code: string; }
interface ResultRow {
    id: string;
    student_id: string;
    student_name: string;
    email: string;
    enrollment_number: string;
    mother_name: string;
    photo_url: string | null;
    institute_name: string;
    course_name: string;
    batch_name: string;
    marks_obtained: number | null;
    total_marks: number;
    percentage: number | null;
    grade: string | null;
    result: 'pass' | 'fail' | null;
    exam_date: string;
    certificate_generated: boolean;
}

const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function gradeColor(grade: string | null) {
    if (!grade) return '#64748b';
    if (grade === 'A+' || grade === 'A') return '#16a34a';
    if (grade === 'B+' || grade === 'B') return '#2563eb';
    if (grade === 'C+') return '#d97706';
    if (grade === 'D') return '#ea580c';
    return '#dc2626';
}

function sanitizeFilename(name: string) {
    return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_');
}

function buildCsv(rows: ResultRow[]) {
    const headers = ['Sr.No', 'Student Name', 'Enrollment No', "Mother's Name", 'Institute', 'Course', 'Batch', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade', 'Result', 'Exam Date', 'Certificate Given'];
    const body = rows.map((r, i) => [
        i + 1,
        r.student_name,
        r.enrollment_number,
        r.mother_name,
        r.institute_name,
        r.course_name,
        r.batch_name,
        r.marks_obtained ?? '',
        r.total_marks,
        r.percentage != null ? `${r.percentage}%` : '',
        r.grade ?? '',
        r.result ? r.result.toUpperCase() : '',
        fmtDate(r.exam_date),
        r.certificate_generated ? 'Yes' : 'No',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [headers.map(h => `"${h}"`).join(','), ...body].join('\n');
}

function downloadCsvFile(rows: ResultRow[], filename = 'final-results') {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadPhotosZip(rows: ResultRow[], zipName = 'student-photos') {
    const zip = new JSZip();
    const folder = zip.folder('photos')!;

    const results = await Promise.allSettled(
        rows.map(async (r) => {
            if (!r.photo_url) return null;
            const res = await fetch(r.photo_url);
            if (!res.ok) return null;
            const blob = await res.blob();
            const ext = r.photo_url.split('?')[0].split('.').pop() || 'jpg';
            const roll = r.enrollment_number || r.student_id.slice(0, 8);
            const name = sanitizeFilename(r.student_name);
            folder.file(`${roll}_${name}.${ext}`, blob);
            return roll;
        })
    );

    const added = results.filter(r => r.status === 'fulfilled' && r.value).length;
    if (added === 0) throw new Error('No photos available for selected students');

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${zipName}-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    return added;
}

export default function FinalResultsPage() {
    const [institutes, setInstitutes] = useState<Institute[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedInstitute, setSelectedInstitute] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');

    const [results, setResults] = useState<ResultRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasFetched, setHasFetched] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Selection
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Download states
    const [zipLoading, setZipLoading] = useState(false);
    const [zipError, setZipError] = useState('');
    const [certUpdating, setCertUpdating] = useState<Set<string>>(new Set());

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/list-institutes').then(r => r.json()),
            fetch('/api/admin/courses').then(r => r.json()),
        ]).then(([instData, courseData]) => {
            setInstitutes(instData.institutes ?? []);
            setCourses(courseData.courses ?? []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        setBatches([]);
        setSelectedBatch('');
        if (!selectedInstitute && !selectedCourse) return;
        const params = new URLSearchParams();
        if (selectedInstitute) params.set('institute_id', selectedInstitute);
        if (selectedCourse) params.set('course_id', selectedCourse);
        fetch(`/api/admin/batches?${params}`)
            .then(r => r.json())
            .then(d => setBatches(d.batches ?? []))
            .catch(() => {});
    }, [selectedInstitute, selectedCourse]);

    const fetchResults = useCallback(async () => {
        setLoading(true);
        setError('');
        setSelected(new Set());
        try {
            const params = new URLSearchParams();
            if (selectedInstitute) params.set('institute_id', selectedInstitute);
            if (selectedCourse) params.set('course_id', selectedCourse);
            if (selectedBatch) params.set('batch_id', selectedBatch);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (search) params.set('search', search);
            const res = await fetch(`/api/admin/final-results?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch results');
            setResults(json.results ?? []);
            setHasFetched(true);
            setPage(0);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [selectedInstitute, selectedCourse, selectedBatch, dateFrom, dateTo, search]);

    const handleClear = () => {
        setSelectedInstitute(''); setSelectedCourse(''); setSelectedBatch('');
        setDateFrom(''); setDateTo(''); setSearch('');
        setResults([]); setHasFetched(false); setError(''); setSelected(new Set());
    };

    // Selection helpers
    const displayRows = results.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    const allDisplaySelected = displayRows.length > 0 && displayRows.every(r => selected.has(r.id));
    const someDisplaySelected = displayRows.some(r => selected.has(r.id)) && !allDisplaySelected;

    const toggleSelectAll = () => {
        if (allDisplaySelected) {
            const next = new Set(selected);
            displayRows.forEach(r => next.delete(r.id));
            setSelected(next);
        } else {
            const next = new Set(selected);
            displayRows.forEach(r => next.add(r.id));
            setSelected(next);
        }
    };

    const toggleRow = (id: string) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    const selectAll = () => setSelected(new Set(results.map(r => r.id)));
    const clearSelection = () => setSelected(new Set());

    const selectedRows = results.filter(r => selected.has(r.id));
    const targetRows = selected.size > 0 ? selectedRows : results;
    const targetLabel = selected.size > 0 ? `${selected.size} selected` : `all ${results.length}`;

    // Certificate toggle
    const toggleCertificate = async (row: ResultRow) => {
        setCertUpdating(prev => new Set(prev).add(row.id));
        try {
            const res = await fetch('/api/admin/final-results', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [row.id], certificate_generated: !row.certificate_generated }),
            });
            if (!res.ok) throw new Error('Update failed');
            setResults(prev => prev.map(r => r.id === row.id ? { ...r, certificate_generated: !r.certificate_generated } : r));
        } catch {
            // silently fail — user can retry
        } finally {
            setCertUpdating(prev => { const n = new Set(prev); n.delete(row.id); return n; });
        }
    };

    // Bulk certificate mark
    const markCertificatesBulk = async (value: boolean) => {
        if (selected.size === 0) return;
        const ids = [...selected];
        setCertUpdating(new Set(ids));
        try {
            const res = await fetch('/api/admin/final-results', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, certificate_generated: value }),
            });
            if (!res.ok) throw new Error('Update failed');
            setResults(prev => prev.map(r => ids.includes(r.id) ? { ...r, certificate_generated: value } : r));
        } catch {
            setError('Certificate update failed.');
        } finally {
            setCertUpdating(new Set());
        }
    };

    // Download photos ZIP
    const handleDownloadPhotos = async () => {
        setZipLoading(true);
        setZipError('');
        try {
            const added = await downloadPhotosZip(targetRows, 'student-photos');
            if (added === 0) setZipError('No photos available for selected students.');
        } catch (e: any) {
            setZipError(e.message || 'Failed to create ZIP');
        } finally {
            setZipLoading(false);
        }
    };

    const passed = results.filter(r => r.result === 'pass').length;
    const failed = results.filter(r => r.result === 'fail').length;
    const certGiven = results.filter(r => r.certificate_generated).length;
    const withPct = results.filter(r => r.percentage != null);
    const avgPct = withPct.length > 0
        ? Math.round(withPct.reduce((s, r) => s + (r.percentage ?? 0), 0) / withPct.length * 10) / 10
        : null;

    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                    <EmojiEvents sx={{ color: 'primary.main', fontSize: 32 }} />
                    <Typography variant="h4" fontWeight={900}>Final Results</Typography>
                </Stack>
                <Typography color="text.secondary">
                    View completed exam results. Select rows for targeted downloads.
                </Typography>
            </Box>

            {/* Filters */}
            <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <FilterList sx={{ color: '#64748b', fontSize: 20 }} />
                    <Typography fontWeight={700} color="text.secondary" variant="body2" sx={{ letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        Filters
                    </Typography>
                </Stack>
                <Grid container spacing={2} alignItems="flex-end">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Institute</InputLabel>
                            <Select value={selectedInstitute} label="Institute" onChange={e => setSelectedInstitute(e.target.value)}>
                                <MenuItem value=""><em>All Institutes</em></MenuItem>
                                {institutes.map(i => <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Course</InputLabel>
                            <Select value={selectedCourse} label="Course" onChange={e => setSelectedCourse(e.target.value)}>
                                <MenuItem value=""><em>All Courses</em></MenuItem>
                                {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small" disabled={batches.length === 0 && !selectedInstitute && !selectedCourse}>
                            <InputLabel>Batch</InputLabel>
                            <Select value={selectedBatch} label="Batch" onChange={e => setSelectedBatch(e.target.value)}>
                                <MenuItem value=""><em>All Batches</em></MenuItem>
                                {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.batch_name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth size="small" label="Search Student"
                            value={search} onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') fetchResults(); }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment> }}
                            placeholder="Name, email, or enroll no"
                        />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                        <TextField fullWidth size="small" label="From Date" type="date"
                            value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                        <TextField fullWidth size="small" label="To Date" type="date"
                            value={dateTo} onChange={e => setDateTo(e.target.value)}
                            InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={8}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                            <Button variant="contained" onClick={fetchResults} disabled={loading} startIcon={<Refresh />}>
                                {loading ? 'Loading…' : 'Load Results'}
                            </Button>
                            <Button variant="outlined" color="inherit" onClick={handleClear} disabled={loading}>Clear</Button>
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>

            {/* Stats */}
            {hasFetched && !loading && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {([
                        { label: 'Total Results', value: results.length, icon: <People />, color: '#2563eb', bg: '#eff6ff' },
                        { label: 'Passed', value: passed, icon: <CheckCircle />, color: '#16a34a', bg: '#f0fdf4' },
                        { label: 'Failed', value: failed, icon: <Cancel />, color: '#dc2626', bg: '#fef2f2' },
                        { label: 'Avg Score', value: avgPct != null ? `${avgPct}%` : '—', icon: <PercentOutlined />, color: '#d97706', bg: '#fffbeb' },
                        { label: 'Cert Given', value: certGiven, icon: <EmojiEvents />, color: '#7c3aed', bg: '#f5f3ff' },
                    ] as const).map(stat => (
                        <Grid item xs={6} md={2.4} key={stat.label}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: '14px !important' }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {stat.icon}
                                        </Box>
                                        <Box>
                                            <Typography variant="h6" fontWeight={800} lineHeight={1.1}>{stat.value}</Typography>
                                            <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {zipError && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setZipError('')}>{zipError}</Alert>}

            {loading && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    {[...Array(8)].map((_, i) => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
                </Paper>
            )}

            {!loading && hasFetched && (
                <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    {/* Toolbar */}
                    <Box sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1} flexWrap="wrap" gap={1}>
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" gap={1}>
                                <Typography fontWeight={700}>
                                    {results.length} result{results.length !== 1 ? 's' : ''}
                                </Typography>
                                {results.length > 0 && (
                                    <>
                                        <Chip size="small" label={`${passed} Passed`} color="success" variant="outlined" />
                                        <Chip size="small" label={`${failed} Failed`} color="error" variant="outlined" />
                                        <Chip size="small" label={`${certGiven} Cert Given`} sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', border: '1px solid #c4b5fd' }} />
                                    </>
                                )}
                            </Stack>

                            {results.length > 0 && (
                                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} alignItems="center">
                                    {/* Selection helpers */}
                                    {selected.size > 0 && (
                                        <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ alignSelf: 'center' }}>
                                            {selected.size} selected
                                        </Typography>
                                    )}
                                    <Tooltip title="Select all loaded results">
                                        <Button size="small" variant="outlined" color="inherit" onClick={selectAll}
                                            startIcon={<CheckBoxIcon fontSize="small" />} sx={{ fontSize: 11 }}>
                                            All
                                        </Button>
                                    </Tooltip>
                                    {selected.size > 0 && (
                                        <Button size="small" variant="outlined" color="inherit" onClick={clearSelection} sx={{ fontSize: 11 }}>
                                            Clear
                                        </Button>
                                    )}

                                    <Divider orientation="vertical" flexItem />

                                    {/* Bulk cert actions (only when selection exists) */}
                                    {selected.size > 0 && (
                                        <>
                                            <Button size="small" variant="outlined" color="success"
                                                onClick={() => markCertificatesBulk(true)}
                                                disabled={certUpdating.size > 0}
                                                sx={{ fontSize: 11 }}>
                                                Mark Cert Given ({selected.size})
                                            </Button>
                                            <Button size="small" variant="outlined" color="error"
                                                onClick={() => markCertificatesBulk(false)}
                                                disabled={certUpdating.size > 0}
                                                sx={{ fontSize: 11 }}>
                                                Unmark Cert
                                            </Button>
                                            <Divider orientation="vertical" flexItem />
                                        </>
                                    )}

                                    {/* Download CSV */}
                                    <Button size="small" variant="outlined" startIcon={<Download />}
                                        onClick={() => downloadCsvFile(targetRows, `results-${targetLabel.replace(/\s/g, '-')}`)}
                                        sx={{ fontSize: 11 }}>
                                        CSV ({targetLabel})
                                    </Button>

                                    {/* Download Photos ZIP */}
                                    <Button size="small" variant="outlined" color="secondary"
                                        startIcon={<PhotoLibrary />}
                                        onClick={handleDownloadPhotos}
                                        disabled={zipLoading}
                                        sx={{ fontSize: 11 }}>
                                        {zipLoading ? 'Zipping…' : `Photos ZIP (${targetLabel})`}
                                    </Button>
                                </Stack>
                            )}
                        </Stack>
                    </Box>

                    {results.length === 0 ? (
                        <Box sx={{ py: 10, textAlign: 'center' }}>
                            <EmojiEvents sx={{ fontSize: 52, color: '#cbd5e1', mb: 1.5 }} />
                            <Typography color="text.secondary" fontWeight={600}>No completed exam results found</Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox" sx={{ bgcolor: '#f8fafc' }}>
                                                <Checkbox
                                                    size="small"
                                                    checked={allDisplaySelected}
                                                    indeterminate={someDisplaySelected}
                                                    onChange={toggleSelectAll}
                                                />
                                            </TableCell>
                                            {['Photo', 'Student', 'Enroll No', "Mother's Name", 'Institute', 'Course', 'Batch', 'Marks', '%', 'Grade', 'Result', 'Exam Date', 'Cert Given'].map(h => (
                                                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: 11, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                                    {h}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayRows.map((row, i) => {
                                            const isSelected = selected.has(row.id);
                                            const certBusy = certUpdating.has(row.id);
                                            return (
                                                <TableRow key={row.id} hover selected={isSelected}
                                                    sx={{ bgcolor: isSelected ? '#eff6ff' : undefined }}>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox size="small" checked={isSelected} onChange={() => toggleRow(row.id)} />
                                                    </TableCell>
                                                    <TableCell sx={{ width: 44 }}>
                                                        <Avatar
                                                            src={row.photo_url ?? undefined}
                                                            alt={row.student_name}
                                                            sx={{ width: 32, height: 32, fontSize: 13 }}
                                                        >
                                                            {row.student_name[0]}
                                                        </Avatar>
                                                    </TableCell>
                                                    <TableCell sx={{ minWidth: 150 }}>
                                                        <Typography variant="body2" fontWeight={600} noWrap>{row.student_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary" noWrap>{row.email}</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                        {row.enrollment_number || '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.mother_name || '—'}</TableCell>
                                                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.institute_name}</TableCell>
                                                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.course_name}</TableCell>
                                                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.batch_name}</TableCell>
                                                    <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        {row.marks_obtained != null ? `${row.marks_obtained}/${row.total_marks}` : '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        {row.percentage != null ? `${row.percentage}%` : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.grade ? (
                                                            <Chip size="small" label={row.grade} sx={{ fontSize: 11, fontWeight: 700, bgcolor: `${gradeColor(row.grade)}18`, color: gradeColor(row.grade), border: `1px solid ${gradeColor(row.grade)}40` }} />
                                                        ) : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {row.result === 'pass' ? (
                                                            <Chip size="small" label="PASS" color="success" sx={{ fontWeight: 700, fontSize: 11 }} />
                                                        ) : row.result === 'fail' ? (
                                                            <Chip size="small" label="FAIL" color="error" sx={{ fontWeight: 700, fontSize: 11 }} />
                                                        ) : '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(row.exam_date)}</TableCell>
                                                    <TableCell>
                                                        <Tooltip title={row.certificate_generated ? 'Certificate given — click to unmark' : 'Certificate not given — click to mark'}>
                                                            <Switch
                                                                size="small"
                                                                checked={row.certificate_generated}
                                                                onChange={() => toggleCertificate(row)}
                                                                disabled={certBusy}
                                                                color="success"
                                                            />
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <TablePagination
                                component="div"
                                count={results.length}
                                page={page}
                                onPageChange={(_, p) => setPage(p)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                                rowsPerPageOptions={[10, 25, 50, 100]}
                            />
                        </>
                    )}
                </Paper>
            )}

            {!loading && !hasFetched && (
                <Paper elevation={0} sx={{ py: 12, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    <EmojiEvents sx={{ fontSize: 60, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>
                        Apply filters and click "Load Results"
                    </Typography>
                </Paper>
            )}
        </AdminLayout>
    );
}
