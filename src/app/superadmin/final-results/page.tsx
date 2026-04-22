'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Stack, Paper, Grid, Card, CardContent,
    FormControl, InputLabel, Select, MenuItem, TextField, Button,
    Chip, Alert, Skeleton, Table, TableHead, TableRow, TableCell,
    TableBody, TableContainer, TablePagination, Divider, InputAdornment,
} from '@mui/material';
import {
    EmojiEvents, Download, FilterList, Refresh, CheckCircle,
    Cancel, People, Search, PercentOutlined,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

interface Institute { id: string; name: string; }
interface Course { id: string; name: string; code: string; }
interface Batch { id: string; batch_name: string; batch_code: string; }
interface ResultRow {
    id: string;
    student_name: string;
    email: string;
    enrollment_number: string;
    mother_name: string;
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

function downloadCsv(rows: ResultRow[]) {
    const headers = ['Sr.No', 'Student Name', 'Enrollment No', 'Mother Name', 'Institute', 'Course', 'Batch', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade', 'Result', 'Exam Date', 'Certificate'];
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
    const csv = [headers.map(h => `"${h}"`).join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        setSelectedInstitute('');
        setSelectedCourse('');
        setSelectedBatch('');
        setDateFrom('');
        setDateTo('');
        setSearch('');
        setResults([]);
        setHasFetched(false);
        setError('');
    };

    const passed = results.filter(r => r.result === 'pass').length;
    const failed = results.filter(r => r.result === 'fail').length;
    const withPct = results.filter(r => r.percentage != null);
    const avgPct = withPct.length > 0
        ? Math.round(withPct.reduce((s, r) => s + (r.percentage ?? 0), 0) / withPct.length * 10) / 10
        : null;

    const displayRows = results.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                    <EmojiEvents sx={{ color: 'primary.main', fontSize: 32 }} />
                    <Typography variant="h4" fontWeight={900}>Final Results</Typography>
                </Stack>
                <Typography color="text.secondary">
                    View completed exam results across all institutes, courses, and batches.
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
                                {institutes.map(i => (
                                    <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Course</InputLabel>
                            <Select value={selectedCourse} label="Course" onChange={e => setSelectedCourse(e.target.value)}>
                                <MenuItem value=""><em>All Courses</em></MenuItem>
                                {courses.map(c => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small" disabled={batches.length === 0 && !selectedInstitute && !selectedCourse}>
                            <InputLabel>Batch</InputLabel>
                            <Select value={selectedBatch} label="Batch" onChange={e => setSelectedBatch(e.target.value)}>
                                <MenuItem value=""><em>All Batches</em></MenuItem>
                                {batches.map(b => (
                                    <MenuItem key={b.id} value={b.id}>{b.batch_name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth size="small" label="Search Student"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') fetchResults(); }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
                                    </InputAdornment>
                                ),
                            }}
                            placeholder="Name, email, or enroll no"
                        />
                    </Grid>

                    <Grid item xs={6} sm={3} md={2}>
                        <TextField
                            fullWidth size="small" label="From Date" type="date"
                            value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    <Grid item xs={6} sm={3} md={2}>
                        <TextField
                            fullWidth size="small" label="To Date" type="date"
                            value={dateTo} onChange={e => setDateTo(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={8}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                            <Button
                                variant="contained" onClick={fetchResults} disabled={loading}
                                startIcon={<Refresh />}
                            >
                                {loading ? 'Loading…' : 'Load Results'}
                            </Button>
                            <Button variant="outlined" color="inherit" onClick={handleClear} disabled={loading}>
                                Clear
                            </Button>
                            {results.length > 0 && (
                                <Button
                                    variant="outlined" startIcon={<Download />}
                                    onClick={() => downloadCsv(results)}
                                    sx={{ ml: { sm: 'auto' } }}
                                >
                                    Export CSV ({results.length})
                                </Button>
                            )}
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
                    ] as const).map(stat => (
                        <Grid item xs={6} md={3} key={stat.label}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: '16px !important' }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <Box sx={{
                                            width: 40, height: 40, borderRadius: 2,
                                            bgcolor: stat.bg, color: stat.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            {stat.icon}
                                        </Box>
                                        <Box>
                                            <Typography variant="h5" fontWeight={800} lineHeight={1.1}>
                                                {stat.value}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {stat.label}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Error */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Skeleton */}
            {loading && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    {[...Array(8)].map((_, i) => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
                </Paper>
            )}

            {/* Results table */}
            {!loading && hasFetched && (
                <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc' }}>
                        <Typography fontWeight={700}>
                            {results.length} result{results.length !== 1 ? 's' : ''} found
                        </Typography>
                        {results.length > 0 && (
                            <Stack direction="row" spacing={1}>
                                <Chip size="small" label={`${passed} Passed`} color="success" variant="outlined" />
                                <Chip size="small" label={`${failed} Failed`} color="error" variant="outlined" />
                            </Stack>
                        )}
                    </Box>
                    <Divider />

                    {results.length === 0 ? (
                        <Box sx={{ py: 10, textAlign: 'center' }}>
                            <EmojiEvents sx={{ fontSize: 52, color: '#cbd5e1', mb: 1.5 }} />
                            <Typography color="text.secondary" fontWeight={600}>No completed exam results found</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Try adjusting your filters or load all results without filters.
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <TableContainer>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            {['#', 'Student', 'Enroll No', "Mother's Name", 'Institute', 'Course', 'Batch', 'Marks', '%', 'Grade', 'Result', 'Exam Date'].map(h => (
                                                <TableCell key={h} sx={{
                                                    fontWeight: 700, bgcolor: '#f8fafc', fontSize: 11,
                                                    color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                                }}>
                                                    {h}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayRows.map((row, i) => (
                                            <TableRow key={row.id} hover>
                                                <TableCell sx={{ color: '#94a3b8', fontSize: 12 }}>
                                                    {page * rowsPerPage + i + 1}
                                                </TableCell>
                                                <TableCell sx={{ minWidth: 160 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap>
                                                        {row.student_name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {row.email}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                    {row.enrollment_number || '—'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {row.mother_name || '—'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {row.institute_name}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {row.course_name}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {row.batch_name}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    {row.marks_obtained != null
                                                        ? `${row.marks_obtained}/${row.total_marks}`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {row.percentage != null ? `${row.percentage}%` : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {row.grade ? (
                                                        <Chip
                                                            size="small" label={row.grade}
                                                            sx={{
                                                                fontSize: 11, fontWeight: 700,
                                                                bgcolor: `${gradeColor(row.grade)}18`,
                                                                color: gradeColor(row.grade),
                                                                border: `1px solid ${gradeColor(row.grade)}40`,
                                                            }}
                                                        />
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {row.result === 'pass' ? (
                                                        <Chip size="small" label="PASS" color="success" sx={{ fontWeight: 700, fontSize: 11 }} />
                                                    ) : row.result === 'fail' ? (
                                                        <Chip size="small" label="FAIL" color="error" sx={{ fontWeight: 700, fontSize: 11 }} />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                                    {fmtDate(row.exam_date)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
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

            {/* Initial empty state */}
            {!loading && !hasFetched && (
                <Paper elevation={0} sx={{ py: 12, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    <EmojiEvents sx={{ fontSize: 60, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>
                        Apply filters and click "Load Results"
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Select institute, course, or batch — or load all results at once.
                    </Typography>
                </Paper>
            )}
        </AdminLayout>
    );
}
