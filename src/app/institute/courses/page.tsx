'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Chip, Tooltip, Paper, Snackbar, Alert, Divider, Stack,
    Skeleton, InputAdornment, Card, CardContent, Grid, Table, TableHead,
    TableRow, TableCell, TableBody, TableContainer, IconButton,
} from '@mui/material';
import {
    School, EditOutlined, Refresh, CurrencyRupee, Lock, CheckCircle,
    InfoOutlined,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface AllocatedCourse {
    id: string;
    course_id: string; course_name: string; course_code: string; duration_months: number;
    institute_course_fee: number;
    exam_fee: number;       // fixed by super admin
    delivery_fee: number;   // fixed by super admin
    student_total: number;
    is_active: boolean;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export default function InstituteCourseManagementPage() {
    const [courses, setCourses] = useState<AllocatedCourse[]>([]);
    const [loading, setLoading] = useState(true);

    const [editOpen, setEditOpen] = useState(false);
    const [editCourse, setEditCourse] = useState<AllocatedCourse | null>(null);
    const [editFee, setEditFee] = useState('');
    const [saving, setSaving] = useState(false);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
        ({ open: false, message: '', severity: 'success' });
    const showSnackbar = (msg: string, sev: 'success' | 'error') =>
        setSnackbar({ open: true, message: msg, severity: sev });

    const fetchCourses = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/institute/my-courses');
        if (res.ok) { const j = await res.json(); setCourses(j.courses ?? []); }
        setLoading(false);
    }, []);
    useEffect(() => { fetchCourses(); }, [fetchCourses]);

    const openEdit = (c: AllocatedCourse) => {
        setEditCourse(c); setEditFee(String(c.institute_course_fee)); setEditOpen(true);
    };

    const handleSave = async () => {
        if (!editCourse) return;
        if (!editFee || Number(editFee) < 0) { showSnackbar('Enter a valid fee.', 'error'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/institute/my-courses', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editCourse.id, institute_course_fee: Number(editFee) }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showSnackbar(`Course fee updated to ${fmt(Number(editFee))}.`, 'success');
            setEditOpen(false); fetchCourses();
        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setSaving(false); }
    };

    return (
        <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Course Management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Set your institute's course fee — exam fee and delivery charge are fixed by Super Admin
                    </Typography>
                </Box>
                <Tooltip title="Refresh">
                    <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchCourses}>Refresh</Button>
                </Tooltip>
            </Box>

            {/* Info banner */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.50', borderColor: 'info.200', display: 'flex', gap: 1 }}>
                <InfoOutlined color="info" sx={{ mt: 0.2 }} />
                <Box>
                    <Typography variant="body2" fontWeight={600} color="info.dark">How fees work</Typography>
                    <Typography variant="body2" color="info.dark">
                        You can set your own <strong>Course Fee</strong> that students pay.
                        The <strong>Exam Fee</strong> and <strong>Delivery Charge</strong> (shown with 🔒) are set by Super Admin and cannot be changed.
                        Students pay: <strong>Course Fee + Exam Fee</strong>.
                    </Typography>
                </Box>
            </Paper>

            {/* Courses table */}
            {loading
                ? <Stack spacing={1.5}>{[...Array(3)].map((_, i) => <Skeleton key={i} height={72} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
                : courses.length === 0
                    ? <Paper variant="outlined" sx={{ p: 8, textAlign: 'center' }}>
                        <School sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                        <Typography color="text.secondary">No courses allocated to your institute yet.</Typography>
                        <Typography variant="body2" color="text.disabled">Contact Super Admin to assign courses.</Typography>
                    </Paper>
                    : <Paper variant="outlined">
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            Your Course Fee
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                (you set this)
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Lock fontSize="small" color="action" /> Exam Fee
                                            </Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                fixed by Super Admin
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Lock fontSize="small" color="action" /> Delivery Fee
                                            </Box>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                fixed by Super Admin
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Student Pays Total</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Edit</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {courses.map(c => (
                                        <TableRow key={c.id} hover>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <School fontSize="small" color="primary" />
                                                    <Typography fontWeight={600}>{c.course_name}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell><Chip label={c.course_code} size="small" variant="outlined" /></TableCell>
                                            <TableCell>{c.duration_months} month{c.duration_months !== 1 ? 's' : ''}</TableCell>
                                            <TableCell>
                                                <Typography fontWeight={700} color="primary.main" fontSize={16}>
                                                    {fmt(c.institute_course_fee)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Lock fontSize="small" color="action" />
                                                    <Typography color="text.secondary">{fmt(c.exam_fee)}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Lock fontSize="small" color="action" />
                                                    <Typography color="text.secondary">{fmt(c.delivery_fee)}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography fontWeight={700} color="success.main" fontSize={16}>
                                                    {fmt(c.student_total)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    = {fmt(c.institute_course_fee)} + {fmt(c.exam_fee)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit course fee">
                                                    <IconButton color="primary" onClick={() => openEdit(c)}>
                                                        <EditOutlined />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>}

            {/* Edit Fee Dialog */}
            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                    <EditOutlined color="primary" /> Set Course Fee
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    {editCourse && (
                        <Stack spacing={2.5}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="body2" color="text.secondary">Course</Typography>
                                <Typography fontWeight={600}>{editCourse.course_name} ({editCourse.course_code})</Typography>
                                <Divider sx={{ my: 1 }} />
                                <Grid container spacing={1}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Exam Fee (fixed)</Typography>
                                        <Typography variant="body2" fontWeight={600}>{fmt(editCourse.exam_fee)}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" color="text.secondary">Delivery Fee (fixed)</Typography>
                                        <Typography variant="body2" fontWeight={600}>{fmt(editCourse.delivery_fee)}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                            <TextField
                                label="Your Course Fee (₹) *"
                                type="number"
                                size="small"
                                fullWidth
                                value={editFee}
                                onChange={e => setEditFee(e.target.value)}
                                helperText="This is what students pay for the course portion."
                                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            />
                            {editFee && (
                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'success.50' }}>
                                    <Typography variant="body2" color="success.dark">
                                        Student total: <strong>{fmt(Number(editFee) + editCourse.exam_fee)}</strong>
                                        <Typography component="span" variant="caption" color="text.secondary">
                                            {' '}({fmt(Number(editFee))} course + {fmt(editCourse.exam_fee)} exam)
                                        </Typography>
                                    </Typography>
                                </Paper>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                    <Button onClick={() => setEditOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving || !editFee} startIcon={<CheckCircle />}>
                        {saving ? 'Saving…' : 'Update Fee'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000}
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
