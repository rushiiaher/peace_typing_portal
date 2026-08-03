'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Chip, Tooltip, Paper, Snackbar, Alert, Divider, Stack,
    Skeleton, InputAdornment, IconButton, Card, CardContent, Grid, Autocomplete,
    Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Collapse,
    Badge,
} from '@mui/material';
import {
    SwapHoriz, AddCircleOutline, DeleteOutline, EditOutlined, Search,
    Refresh, ExpandMore, ExpandLess, Business, School, CheckCircle, Cancel,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Institute { id: string; name: string; code: string; city: string; }
interface Course { id: string; name: string; code: string; base_course_fee: number; exam_fee: number; }
interface Allocation {
    id: string;
    institute_id: string; institute_name: string; institute_code: string; institute_city: string;
    course_id: string; course_name: string; course_code: string;
    base_fee: number; exam_fee: number;
    is_active: boolean; assigned_at: string;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

/* ─── Section header ─────────────────────────────────────────────────────── */
function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">{label}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
        </Box>
    );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function CourseAllocationPage() {
    const [institutes, setInstitutes] = useState<Institute[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [loading, setLoading] = useState(true);

    /* Filters */
    const [filterInstitute, setFilterInstitute] = useState<Institute | null>(null);
    const [search, setSearch] = useState('');

    /* Expanded accordion rows */
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    /* Assign dialog */
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignInstitute, setAssignInstitute] = useState<Institute | null>(null);
    const [assignCourse, setAssignCourse] = useState<Course | null>(null);
    const [assigning, setAssigning] = useState(false);

    /* Edit dialog (status only) */
    const [editOpen, setEditOpen] = useState(false);
    const [editAlloc, setEditAlloc] = useState<Allocation | null>(null);
    const [editActive, setEditActive] = useState('true');
    const [saving, setSaving] = useState(false);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
        ({ open: false, message: '', severity: 'success' });
    const showSnackbar = (msg: string, sev: 'success' | 'error') =>
        setSnackbar({ open: true, message: msg, severity: sev });

    /* ─── Fetch ── */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [iRes, cRes, aRes] = await Promise.all([
            fetch('/api/admin/institutes'),
            fetch('/api/admin/courses'),
            fetch('/api/admin/course-allocation'),
        ]);
        if (iRes.ok) { const j = await iRes.json(); setInstitutes(j.institutes ?? []); }
        if (cRes.ok) { const j = await cRes.json(); setCourses(j.courses ?? []); }
        if (aRes.ok) { const j = await aRes.json(); setAllocations(j.allocations ?? []); }
        setLoading(false);
    }, []);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ─── Assign ── */
    const handleAssign = async () => {
        if (!assignInstitute || !assignCourse) {
            showSnackbar('Select an institute and a course.', 'error'); return;
        }
        setAssigning(true);
        try {
            const res = await fetch('/api/admin/course-allocation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ institute_id: assignInstitute.id, course_id: assignCourse.id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showSnackbar(`"${assignCourse.name}" assigned to "${assignInstitute.name}".`, 'success');
            setAssignOpen(false); setAssignInstitute(null); setAssignCourse(null);
            fetchAll();
        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setAssigning(false); }
    };

    /* ─── Edit (toggle active status) ── */
    const openEdit = (a: Allocation) => {
        setEditAlloc(a);
        setEditActive(a.is_active ? 'true' : 'false');
        setEditOpen(true);
    };
    const handleSaveEdit = async () => {
        if (!editAlloc) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/course-allocation?id=${editAlloc.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: editActive === 'true' }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showSnackbar('Allocation updated.', 'success');
            setEditOpen(false); fetchAll();
        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setSaving(false); }
    };

    /* ─── Delete ── */
    const handleDelete = async (a: Allocation) => {
        if (!confirm(`Remove "${a.course_name}" from "${a.institute_name}"?\nInstitute will no longer be able to enroll students in this course.`)) return;
        const res = await fetch(`/api/admin/course-allocation?id=${a.id}`, { method: 'DELETE' });
        if (res.ok) { showSnackbar('Course unallocated.', 'success'); fetchAll(); }
        else { const j = await res.json(); showSnackbar(j.error, 'error'); }
    };

    /* ─── Helpers ── */
    const filtered = allocations.filter(a => {
        const matchInst = !filterInstitute || a.institute_id === filterInstitute.id;
        const matchSearch = !search || [a.institute_name, a.course_name, a.course_code, a.institute_code]
            .join(' ').toLowerCase().includes(search.toLowerCase());
        return matchInst && matchSearch;
    });

    const byInstitute = institutes.map(inst => ({
        institute: inst,
        allocs: filtered.filter(a => a.institute_id === inst.id),
    })).filter(g => {
        if (filterInstitute) return g.institute.id === filterInstitute.id;
        return g.allocs.length > 0 || !search;
    });

    const unassignedCourses = (instId: string) => {
        const assigned = new Set(allocations.filter(a => a.institute_id === instId).map(a => a.course_id));
        return courses.filter(c => !assigned.has(c.id));
    };

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const openAssignFor = (inst: Institute) => {
        setAssignInstitute(inst); setAssignCourse(null); setAssignOpen(true);
    };

    /* Stats */
    const activeCount = allocations.filter(a => a.is_active).length;
    const instsWithCourses = new Set(allocations.map(a => a.institute_id)).size;

    /* ─────────────────────────────────────────── Render ─ */
    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Global Course Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Allocate courses to institutes — fees are taken directly from the course settings
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Refresh">
                        <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchAll}>Refresh</Button>
                    </Tooltip>
                    <Button variant="contained" startIcon={<AddCircleOutline />}
                        onClick={() => { setAssignInstitute(null); setAssignCourse(null); setAssignOpen(true); }}>
                        Assign Course
                    </Button>
                </Stack>
            </Box>

            {/* Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Total Allocations', value: allocations.length, icon: <SwapHoriz />, color: 'primary.main' },
                    { label: 'Active Allocations', value: activeCount, icon: <CheckCircle />, color: 'success.main' },
                    { label: 'Institutes with Courses', value: instsWithCourses, icon: <Business />, color: 'info.main' },
                    { label: 'Available Courses', value: courses.length, icon: <School />, color: 'warning.main' },
                ].map(s => (
                    <Grid item xs={6} md={3} key={s.label}>
                        <Card variant="outlined">
                            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Box sx={{ color: s.color, display: 'flex' }}>{s.icon}</Box>
                                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                                </Box>
                                <Typography variant="h4" fontWeight={700}>{s.value}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Filters */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Autocomplete
                    options={institutes}
                    getOptionLabel={o => `${o.name} (${o.code})`}
                    value={filterInstitute}
                    onChange={(_, v) => setFilterInstitute(v)}
                    renderInput={params => <TextField {...params} label="Filter by Institute" size="small" />}
                    sx={{ width: 300 }}
                    clearOnEscape
                />
                <TextField size="small" placeholder="Search courses, institutes…"
                    value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 280 }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                    }} />
                {(filterInstitute || search) &&
                    <Button size="small" onClick={() => { setFilterInstitute(null); setSearch(''); }}>Clear</Button>}
                <Box sx={{ ml: 'auto' }}>
                    <Typography variant="body2" color="text.secondary">
                        {filtered.length} allocation{filtered.length !== 1 ? 's' : ''}
                    </Typography>
                </Box>
            </Paper>

            {/* Institute-grouped accordion */}
            {loading
                ? <Stack spacing={1.5}>
                    {[...Array(4)].map((_, i) => <Skeleton key={i} height={64} variant="rectangular" sx={{ borderRadius: 1 }} />)}
                </Stack>
                : byInstitute.length === 0
                    ? <Paper variant="outlined" sx={{ p: 8, textAlign: 'center' }}>
                        <SwapHoriz sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography color="text.secondary" gutterBottom>No allocations found.</Typography>
                        <Button sx={{ mt: 1 }} variant="contained" startIcon={<AddCircleOutline />}
                            onClick={() => setAssignOpen(true)}>
                            Assign First Course
                        </Button>
                    </Paper>
                    : <Stack spacing={1.5}>
                        {byInstitute.map(({ institute, allocs }) => {
                            const isExp = expanded.has(institute.id);
                            const activeAllocs = allocs.filter(a => a.is_active).length;
                            return (
                                <Paper key={institute.id} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                    {/* Institute header row */}
                                    <Box
                                        onClick={() => toggleExpand(institute.id)}
                                        sx={{
                                            display: 'flex', alignItems: 'center', px: 2.5, py: 1.5,
                                            cursor: 'pointer',
                                            bgcolor: isExp ? 'primary.50' : 'background.paper',
                                            borderBottom: isExp ? '1px solid' : 'none',
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                    >
                                        <Business sx={{ mr: 1.5, color: 'primary.main' }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography fontWeight={600}>{institute.name}</Typography>
                                                <Chip label={institute.code} size="small" variant="outlined" color="primary" />
                                                {institute.city &&
                                                    <Typography variant="body2" color="text.secondary">· {institute.city}</Typography>}
                                            </Box>
                                        </Box>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip
                                                icon={<School fontSize="small" />}
                                                label={`${activeAllocs} active course${activeAllocs !== 1 ? 's' : ''}`}
                                                size="small"
                                                color={allocs.length ? 'primary' : 'default'}
                                                variant={allocs.length ? 'filled' : 'outlined'}
                                            />
                                            <Tooltip title="Assign a course to this institute">
                                                <IconButton size="small" color="primary"
                                                    onClick={e => { e.stopPropagation(); openAssignFor(institute); }}>
                                                    <AddCircleOutline fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <IconButton size="small">
                                                {isExp ? <ExpandLess /> : <ExpandMore />}
                                            </IconButton>
                                        </Stack>
                                    </Box>

                                    {/* Courses table */}
                                    <Collapse in={isExp}>
                                        {allocs.length === 0
                                            ? <Box sx={{ p: 4, textAlign: 'center' }}>
                                                <Typography color="text.secondary" variant="body2" gutterBottom>
                                                    No courses assigned to this institute yet.
                                                </Typography>
                                                <Button size="small" startIcon={<AddCircleOutline />}
                                                    onClick={() => openAssignFor(institute)}>
                                                    Assign a Course
                                                </Button>
                                            </Box>
                                            : <TableContainer>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                            <TableCell sx={{ fontWeight: 600 }}>Course Name</TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>Course Fee</TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>Exam Fee</TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>Assigned On</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {allocs.map(a => (
                                                            <TableRow key={a.id} hover>
                                                                <TableCell>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                        <School fontSize="small" color="action" />
                                                                        <Typography variant="body2" fontWeight={500}>{a.course_name}</Typography>
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip label={a.course_code} size="small" variant="outlined" />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Typography variant="body2" fontWeight={600} color="success.main">
                                                                        {fmt(a.base_fee)}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {fmt(a.exam_fee)}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        size="small"
                                                                        label={a.is_active ? 'Active' : 'Inactive'}
                                                                        color={a.is_active ? 'success' : 'default'}
                                                                        variant="outlined"
                                                                        icon={a.is_active
                                                                            ? <CheckCircle sx={{ fontSize: '14px !important' }} />
                                                                            : <Cancel sx={{ fontSize: '14px !important' }} />}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('en-IN') : '—'}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                                        <Tooltip title="Enable / Disable">
                                                                            <IconButton size="small" color="primary" onClick={() => openEdit(a)}>
                                                                                <EditOutlined fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title="Remove from institute">
                                                                            <IconButton size="small" color="error" onClick={() => handleDelete(a)}>
                                                                                <DeleteOutline fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>}
                                    </Collapse>
                                </Paper>
                            );
                        })}
                    </Stack>}

            {/* ════ Assign Course Dialog ════ */}
            <Dialog open={assignOpen} onClose={() => setAssignOpen(false)}
                maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                    <SwapHoriz color="primary" /> Assign Course to Institute
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3}>
                        <Autocomplete
                            options={institutes}
                            getOptionLabel={o => `${o.name} (${o.code})`}
                            value={assignInstitute}
                            onChange={(_, v) => { setAssignInstitute(v); setAssignCourse(null); }}
                            renderInput={params => <TextField {...params} label="Select Institute *" size="small" />}
                        />

                        <Autocomplete
                            options={assignInstitute ? unassignedCourses(assignInstitute.id) : courses}
                            getOptionLabel={o => `${o.name} (${o.code})`}
                            value={assignCourse}
                            onChange={(_, v) => setAssignCourse(v)}
                            disabled={!assignInstitute}
                            renderInput={params =>
                                <TextField {...params} label="Select Course *" size="small"
                                    helperText={
                                        !assignInstitute ? 'Select an institute first.' :
                                            unassignedCourses(assignInstitute.id).length === 0
                                                ? 'All courses are already assigned to this institute.'
                                                : `${unassignedCourses(assignInstitute.id).length} course(s) available`
                                    } />}
                        />

                        {/* Show course fee info (read-only) */}
                        {assignCourse && (
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                    Fees from course settings (applied automatically)
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">Course Fee</Typography>
                                        <Typography fontWeight={700} color="primary.main">{fmt(assignCourse.base_course_fee)}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">Exam Fee</Typography>
                                        <Typography fontWeight={700}>{fmt(assignCourse.exam_fee)}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        )}
                    </Stack>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                    <Button onClick={() => setAssignOpen(false)} variant="outlined" disabled={assigning}>Cancel</Button>
                    <Button variant="contained" onClick={handleAssign}
                        disabled={assigning || !assignInstitute || !assignCourse}
                        startIcon={<SwapHoriz />}>
                        {assigning ? 'Assigning…' : 'Assign Course'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ════ Edit Status Dialog ════ */}
            <Dialog open={editOpen} onClose={() => setEditOpen(false)}
                maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                    <EditOutlined color="primary" /> Edit Allocation
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    {editAlloc && (
                        <Stack spacing={2.5}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="body2" color="text.secondary">Institute</Typography>
                                <Typography fontWeight={600}>{editAlloc.institute_name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Course</Typography>
                                <Typography fontWeight={600}>{editAlloc.course_name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Fees (from course)</Typography>
                                <Typography variant="body2">
                                    Course: <strong>{fmt(editAlloc.base_fee)}</strong> &nbsp;|&nbsp; Exam: <strong>{fmt(editAlloc.exam_fee)}</strong>
                                </Typography>
                            </Paper>
                            <TextField select label="Status" size="small" fullWidth
                                value={editActive} onChange={e => setEditActive(e.target.value)}>
                                <MenuItem value="true">Active — Institute can enrol students</MenuItem>
                                <MenuItem value="false">Inactive — Enrolment paused</MenuItem>
                            </TextField>
                        </Stack>
                    )}
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                    <Button onClick={() => setEditOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveEdit} disabled={saving} startIcon={<EditOutlined />}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={5000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snackbar.severity} variant="filled"
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </AdminLayout>
    );
}
