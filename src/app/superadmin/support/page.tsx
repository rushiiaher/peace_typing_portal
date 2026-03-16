'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Stack, Paper, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, Alert, Skeleton, Divider, Grid, Card, CardContent,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
} from '@mui/material';
import {
    SupportAgent, CheckCircle, HourglassTop, Schedule, Cancel,
    Refresh, Inbox, FilterList, ReplyAll, Circle,
} from '@mui/icons-material';
import AdminLayout from '@/app/components/AdminLayout';
import { superAdminMenuItems } from '@/app/components/menuItems';

interface Ticket {
    id: string;
    created_at: string;
    updated_at: string;
    user_email: string;
    user_role: string;
    institute_name: string;
    subject: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    admin_reply: string | null;
    resolved_at: string | null;
}

const CATEGORIES = [
    { value: 'all', label: 'All Categories' },
    { value: 'technical', label: 'Technical' },
    { value: 'payment', label: 'Payment' },
    { value: 'account', label: 'Account' },
    { value: 'exam', label: 'Exam' },
    { value: 'content', label: 'Content' },
    { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
    { value: 'all', label: 'All Status' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: 'Open', color: '#2563eb', bg: '#eff6ff' },
    in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
    resolved: { label: 'Resolved', color: '#16a34a', bg: '#f0fdf4' },
    closed: { label: 'Closed', color: '#64748b', bg: '#f1f5f9' },
};

const PRIORITY_COLOR: Record<string, string> = {
    low: '#64748b', medium: '#d97706', high: '#dc2626', urgent: '#7c2d12',
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SuperAdminSupportPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [selected, setSelected] = useState<Ticket | null>(null);
    const [reply, setReply] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (categoryFilter !== 'all') params.set('category', categoryFilter);
            const res = await fetch(`/api/admin/support?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setTickets(json.tickets ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [statusFilter, categoryFilter]);

    useEffect(() => { load(); }, [load]);

    const openTicket = (t: Ticket) => {
        setSelected(t);
        setReply(t.admin_reply ?? '');
        setNewStatus(t.status);
        setSaveError('');
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true); setSaveError('');
        try {
            const res = await fetch('/api/admin/support', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket_id: selected.id, status: newStatus, admin_reply: reply }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setSelected(null);
            load();
        } catch (e: any) { setSaveError(e.message); }
        finally { setSaving(false); }
    };

    const openCount = tickets.filter(t => t.status === 'open').length;
    const inProgCount = tickets.filter(t => t.status === 'in_progress').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
    const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status === 'open').length;

    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
            <Box>
                {/* ── Hero Header ── */}
                <Box sx={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', borderRadius: 4, p: 4, mb: 4, color: 'white', position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', top: -60, right: -40 }} />
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SupportAgent sx={{ fontSize: 32, color: 'white' }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" fontWeight={900} color="white">Support Tickets</Typography>
                                <Typography sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
                                    Manage and respond to tickets from institutes and students
                                </Typography>
                            </Box>
                        </Stack>
                        <Button variant="outlined" startIcon={<Refresh />} onClick={load}
                            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                            Refresh
                        </Button>
                    </Stack>
                </Box>

                {/* ── Stats ── */}
                <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    {[
                        { label: 'Total', value: tickets.length, color: '#1a1a2e', bg: '#f1f5f9', icon: <Inbox sx={{ fontSize: 26 }} /> },
                        { label: 'Open', value: openCount, color: '#2563eb', bg: '#eff6ff', icon: <Schedule sx={{ fontSize: 26 }} /> },
                        { label: 'In Progress', value: inProgCount, color: '#d97706', bg: '#fffbeb', icon: <HourglassTop sx={{ fontSize: 26 }} /> },
                        { label: 'Resolved', value: resolvedCount, color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle sx={{ fontSize: 26 }} /> },
                    ].map(s => (
                        <Grid item xs={6} md={3} key={s.label}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>{s.icon}</Box>
                                    <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">{s.label}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {urgentCount > 0 && (
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
                        ⚠️ <strong>{urgentCount} urgent ticket{urgentCount > 1 ? 's' : ''}</strong> need{urgentCount === 1 ? 's' : ''} immediate attention.
                    </Alert>
                )}

                {/* ── Filters ── */}
                <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 2.5, mb: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                        <FilterList sx={{ color: 'text.secondary' }} />
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel>Status</InputLabel>
                            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: 2 }}>
                                {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Category</InputLabel>
                            <Select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} label="Category" sx={{ borderRadius: 2 }}>
                                {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                        </Typography>
                    </Stack>
                </Paper>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {/* ── Table ── */}
                {loading
                    ? <Stack spacing={2}>{[...Array(4)].map((_, i) => <Skeleton key={i} height={60} sx={{ borderRadius: 2, transform: 'none' }} />)}</Stack>
                    : tickets.length === 0
                        ? <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 4, border: '2px dashed #e2e8f0' }}>
                            <SupportAgent sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                            <Typography variant="h6" fontWeight={700} color="text.secondary">No tickets found</Typography>
                            <Typography variant="body2" color="text.disabled">Try changing the filters above.</Typography>
                        </Paper>
                        : <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        {['#', 'Date', 'From', 'Role / Institute', 'Subject', 'Category', 'Priority', 'Status', 'Action'].map(h => (
                                            <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tickets.map((t, i) => {
                                        const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
                                        const pColor = PRIORITY_COLOR[t.priority] ?? '#64748b';
                                        return (
                                            <TableRow key={t.id} hover sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }} onClick={() => openTicket(t)}>
                                                <TableCell sx={{ color: '#94a3b8', fontSize: 12 }}>#{i + 1}</TableCell>
                                                <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(t.created_at)}</TableCell>
                                                <TableCell sx={{ fontSize: 12, maxWidth: 160 }}>
                                                    <Tooltip title={t.user_email}><Typography variant="caption" noWrap sx={{ display: 'block', maxWidth: 140 }}>{t.user_email}</Typography></Tooltip>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: 12 }}>
                                                    <Stack spacing={0.4}>
                                                        <Chip size="small" label={t.user_role === 'institute_admin' ? 'Institute' : 'Student'} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                                                        {t.institute_name !== '—' && <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120, display: 'block' }}>{t.institute_name}</Typography>}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 200 }}><Typography variant="body2" fontWeight={600} noWrap>{t.subject}</Typography></TableCell>
                                                <TableCell><Chip size="small" label={CATEGORIES.find(c => c.value === t.category)?.label ?? t.category} variant="outlined" sx={{ fontSize: 10, height: 20 }} /></TableCell>
                                                <TableCell>
                                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                                        <Circle sx={{ fontSize: 8, color: pColor }} />
                                                        <Typography variant="caption" fontWeight={700} sx={{ color: pColor }}>{t.priority}</Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={st.label} sx={{ fontSize: 10, height: 20, fontWeight: 700, bgcolor: st.bg, color: st.color }} />
                                                </TableCell>
                                                <TableCell>
                                                    <Button size="small" variant="outlined" startIcon={<ReplyAll sx={{ fontSize: 14 }} />} sx={{ fontSize: 11, py: 0.4, borderRadius: 1.5 }}>
                                                        Reply
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                }

                {/* ── Reply Dialog ── */}
                <Dialog open={!!selected} onClose={() => !saving && setSelected(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                    {selected && (
                        <>
                            <DialogTitle sx={{ pb: 1 }}>
                                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography fontWeight={800} variant="h6">{selected.subject}</Typography>
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
                                            <Chip size="small" label={selected.user_email} variant="outlined" sx={{ fontSize: 11 }} />
                                            <Chip size="small" label={selected.user_role === 'institute_admin' ? 'Institute Admin' : 'Student'} sx={{ fontSize: 11 }} />
                                            {selected.institute_name !== '—' && <Chip size="small" label={selected.institute_name} variant="outlined" sx={{ fontSize: 11 }} />}
                                            <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 2.2 }}>{formatDate(selected.created_at)}</Typography>
                                        </Stack>
                                    </Box>
                                </Stack>
                            </DialogTitle>
                            <Divider />
                            <DialogContent>
                                <Stack spacing={3} sx={{ pt: 1.5 }}>
                                    <Box>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>User Message</Typography>
                                        <Paper elevation={0} sx={{ mt: 1, p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selected.description}</Typography>
                                        </Paper>
                                    </Box>
                                    {saveError && <Alert severity="error">{saveError}</Alert>}
                                    <FormControl size="small" sx={{ maxWidth: 220 }}>
                                        <InputLabel>Update Status</InputLabel>
                                        <Select value={newStatus} onChange={e => setNewStatus(e.target.value)} label="Update Status" sx={{ borderRadius: 2 }}>
                                            {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Your Reply"
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        fullWidth multiline minRows={5}
                                        placeholder="Type your reply to the user here…"
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                                <Button onClick={() => setSelected(null)} disabled={saving} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving} variant="contained" startIcon={<ReplyAll />}
                                    sx={{ borderRadius: 2, bgcolor: '#1a1a2e', px: 3, fontWeight: 700 }}>
                                    {saving ? 'Saving…' : 'Save Reply & Status'}
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </Dialog>
            </Box>
        </AdminLayout>
    );
}
