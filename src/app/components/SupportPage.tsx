'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Stack, Paper, Button, Chip, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, Alert, Skeleton, Divider, Tooltip, Card, CardContent, Grid,
} from '@mui/material';
import {
    Add, SupportAgent, CheckCircle, HourglassTop, Schedule,
    Cancel, Refresh, Circle, EmojiEvents, Inbox,
} from '@mui/icons-material';

interface Ticket {
    id: string;
    created_at: string;
    subject: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    admin_reply: string | null;
    resolved_at: string | null;
    updated_at: string;
}

const CATEGORIES = [
    { value: 'technical', label: 'Technical Issue' },
    { value: 'payment', label: 'Payment / Fees' },
    { value: 'account', label: 'Account / Login' },
    { value: 'exam', label: 'Exam Related' },
    { value: 'content', label: 'Course Content' },
    { value: 'other', label: 'Other' },
];

const PRIORITIES = [
    { value: 'low', label: 'Low', color: '#64748b' },
    { value: 'medium', label: 'Medium', color: '#d97706' },
    { value: 'high', label: 'High', color: '#dc2626' },
    { value: 'urgent', label: 'Urgent', color: '#7c2d12' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    open: { label: 'Open', color: '#2563eb', bg: '#eff6ff', icon: <Schedule sx={{ fontSize: 14 }} /> },
    in_progress: { label: 'In Progress', color: '#d97706', bg: '#fffbeb', icon: <HourglassTop sx={{ fontSize: 14 }} /> },
    resolved: { label: 'Resolved', color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
    closed: { label: 'Closed', color: '#64748b', bg: '#f1f5f9', icon: <Cancel sx={{ fontSize: 14 }} /> },
};

const PRIORITY_COLOR: Record<string, string> = {
    low: '#64748b', medium: '#d97706', high: '#dc2626', urgent: '#7c2d12',
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface SupportPageProps {
    accentColor: string;
    gradientFrom: string;
    gradientTo: string;
}

export default function SupportPage({ accentColor, gradientFrom, gradientTo }: SupportPageProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Form state
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState('medium');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/support/tickets');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setTickets(json.tickets ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSubmit = async () => {
        if (!subject.trim() || !description.trim() || !category) {
            setSubmitError('Please fill in all required fields.'); return;
        }
        setSubmitting(true); setSubmitError('');
        try {
            const res = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, description, category, priority }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setSubmitSuccess(true);
            setSubject(''); setDescription(''); setCategory(''); setPriority('medium');
            setTimeout(() => {
                setOpenDialog(false);
                setSubmitSuccess(false);
                load();
            }, 1500);
        } catch (e: any) { setSubmitError(e.message); }
        finally { setSubmitting(false); }
    };

    const openCount = tickets.filter(t => t.status === 'open').length;
    const inProgCount = tickets.filter(t => t.status === 'in_progress').length;
    const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

    return (
        <Box>
            {/* ── Hero Header ── */}
            <Box sx={{
                background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
                borderRadius: 4, p: 4, mb: 4, color: 'white', position: 'relative', overflow: 'hidden',
            }}>
                <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)', top: -50, right: -30 }} />
                <Box sx={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)', bottom: -40, right: 180 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: 'relative', zIndex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SupportAgent sx={{ fontSize: 32, color: 'white' }} />
                        </Box>
                        <Box>
                            <Typography variant="h4" fontWeight={900} color="white">Support Center</Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.75)', mt: 0.5 }}>
                                Raise a ticket for any issue — our team will respond promptly
                            </Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                        <Button variant="outlined" startIcon={<Refresh />} onClick={load}
                            sx={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                            Refresh
                        </Button>
                        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}
                            sx={{ bgcolor: 'white', color: gradientFrom, fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}>
                            New Ticket
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            {/* ── Stats ── */}
            {!loading && (
                <Grid container spacing={2.5} sx={{ mb: 4 }}>
                    {[
                        { label: 'Total Tickets', value: tickets.length, color: accentColor, bg: '#f8fafc', icon: <Inbox sx={{ fontSize: 26 }} /> },
                        { label: 'Open', value: openCount, color: '#2563eb', bg: '#eff6ff', icon: <Schedule sx={{ fontSize: 26 }} /> },
                        { label: 'In Progress', value: inProgCount, color: '#d97706', bg: '#fffbeb', icon: <HourglassTop sx={{ fontSize: 26 }} /> },
                        { label: 'Resolved', value: resolvedCount, color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle sx={{ fontSize: 26 }} /> },
                    ].map(s => (
                        <Grid item xs={6} md={3} key={s.label}>
                            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
                                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>{s.icon}</Box>
                                    <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                                    <Typography variant="body2" fontWeight={600} color="text.secondary">{s.label}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* ── Ticket List ── */}
            {loading
                ? <Stack spacing={2}>{[...Array(3)].map((_, i) => <Skeleton key={i} height={100} sx={{ borderRadius: 3, transform: 'none' }} />)}</Stack>
                : tickets.length === 0
                    ? <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 4, border: '2px dashed #e2e8f0' }}>
                        <SupportAgent sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} color="text.secondary">No tickets yet</Typography>
                        <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
                            Click "New Ticket" to raise your first support request.
                        </Typography>
                        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}
                            sx={{ bgcolor: accentColor }}>
                            Raise a Ticket
                        </Button>
                    </Paper>
                    : <Stack spacing={2}>
                        {tickets.map(t => {
                            const st = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
                            const pColor = PRIORITY_COLOR[t.priority] ?? '#64748b';
                            return (
                                <Paper key={t.id} elevation={0} sx={{
                                    borderRadius: 3, border: '1px solid',
                                    borderColor: t.status === 'resolved' ? '#bbf7d0' : t.status === 'open' ? '#bfdbfe' : '#e2e8f0',
                                    overflow: 'hidden', cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                                    '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,0.09)', transform: 'translateY(-2px)' },
                                }} onClick={() => setSelectedTicket(t)}>
                                    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                                        <Box sx={{ width: 6, flexShrink: 0, bgcolor: st.color }} />
                                        <Box sx={{ flex: 1, p: 2.5 }}>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" sx={{ mb: 0.8 }}>
                                                        <Typography variant="body1" fontWeight={700} noWrap>{t.subject}</Typography>
                                                        <Chip size="small" label={st.label} icon={st.icon as any}
                                                            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: st.bg, color: st.color, '& .MuiChip-icon': { color: st.color } }} />
                                                        <Chip size="small" label={t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                                                            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: pColor + '15', color: pColor }} />
                                                        <Chip size="small" label={CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}
                                                            variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                                                    </Stack>
                                                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {t.description}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.8 }}>
                                                    <Typography variant="caption" color="text.disabled">{formatDate(t.created_at)}</Typography>
                                                    {t.admin_reply && (
                                                        <Chip size="small" label="Reply received" color="success" sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
                                                    )}
                                                </Box>
                                            </Stack>
                                        </Box>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>
            }

            {/* ── New Ticket Dialog ── */}
            <Dialog open={openDialog} onClose={() => !submitting && setOpenDialog(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ pb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Add sx={{ color: 'white' }} />
                        </Box>
                        <Box>
                            <Typography fontWeight={800}>Raise a Support Ticket</Typography>
                            <Typography variant="caption" color="text.secondary">We'll get back to you as soon as possible</Typography>
                        </Box>
                    </Stack>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    {submitSuccess
                        ? <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                            <CheckCircle sx={{ fontSize: 56, color: '#16a34a' }} />
                            <Typography variant="h6" fontWeight={700} color="success.main">Ticket Submitted!</Typography>
                            <Typography color="text.secondary" textAlign="center">Your ticket has been raised. We'll respond shortly.</Typography>
                        </Stack>
                        : <Stack spacing={2.5}>
                            {submitError && <Alert severity="error" onClose={() => setSubmitError('')}>{submitError}</Alert>}

                            <TextField label="Subject *" value={subject} onChange={e => setSubject(e.target.value)}
                                fullWidth size="small" placeholder="Briefly describe your issue"
                                inputProps={{ maxLength: 120 }} helperText={`${subject.length}/120`}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />

                            <Stack direction="row" spacing={2}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Category *</InputLabel>
                                    <Select value={category} onChange={e => setCategory(e.target.value)} label="Category *"
                                        sx={{ borderRadius: 2 }}>
                                        {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Priority</InputLabel>
                                    <Select value={priority} onChange={e => setPriority(e.target.value)} label="Priority"
                                        sx={{ borderRadius: 2 }}>
                                        {PRIORITIES.map(p => (
                                            <MenuItem key={p.value} value={p.value}>
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Circle sx={{ fontSize: 10, color: p.color }} />
                                                    <span>{p.label}</span>
                                                </Stack>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Stack>

                            <TextField label="Description *" value={description} onChange={e => setDescription(e.target.value)}
                                fullWidth multiline minRows={5} placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or relevant context."
                                inputProps={{ maxLength: 2000 }} helperText={`${description.length}/2000`}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                        </Stack>
                    }
                </DialogContent>
                {!submitSuccess && (
                    <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
                        <Button onClick={() => setOpenDialog(false)} disabled={submitting} variant="outlined" sx={{ borderRadius: 2 }}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={submitting} variant="contained" sx={{ borderRadius: 2, bgcolor: accentColor, px: 3, fontWeight: 700 }}>
                            {submitting ? 'Submitting…' : 'Submit Ticket'}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>

            {/* ── Ticket Detail Dialog ── */}
            <Dialog open={!!selectedTicket} onClose={() => setSelectedTicket(null)} maxWidth="md" fullWidth
                PaperProps={{ sx: { borderRadius: 4 } }}>
                {selectedTicket && (() => {
                    const st = STATUS_CONFIG[selectedTicket.status] ?? STATUS_CONFIG.open;
                    return (
                        <>
                            <DialogTitle sx={{ pb: 1 }}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography fontWeight={800} variant="h6">{selectedTicket.subject}</Typography>
                                    <Chip size="small" label={st.label} icon={st.icon as any}
                                        sx={{ fontSize: 12, fontWeight: 700, bgcolor: st.bg, color: st.color, '& .MuiChip-icon': { color: st.color } }} />
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                    <Chip size="small" label={CATEGORIES.find(c => c.value === selectedTicket.category)?.label ?? selectedTicket.category} variant="outlined" sx={{ fontSize: 11 }} />
                                    <Chip size="small" label={selectedTicket.priority.charAt(0).toUpperCase() + selectedTicket.priority.slice(1)} sx={{ fontSize: 11, bgcolor: PRIORITY_COLOR[selectedTicket.priority] + '15', color: PRIORITY_COLOR[selectedTicket.priority] }} />
                                    <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 2.2 }}>{formatDate(selectedTicket.created_at)}</Typography>
                                </Stack>
                            </DialogTitle>
                            <Divider />
                            <DialogContent>
                                <Stack spacing={3} sx={{ pt: 1 }}>
                                    <Box>
                                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Your Message</Typography>
                                        <Paper elevation={0} sx={{ mt: 1, p: 2.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedTicket.description}</Typography>
                                        </Paper>
                                    </Box>
                                    {selectedTicket.admin_reply ? (
                                        <Box>
                                            <Typography variant="caption" fontWeight={700} color="success.main" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Admin Reply</Typography>
                                            <Paper elevation={0} sx={{ mt: 1, p: 2.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedTicket.admin_reply}</Typography>
                                            </Paper>
                                            {selectedTicket.resolved_at && (
                                                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                                    ✓ Resolved on {formatDate(selectedTicket.resolved_at)}
                                                </Typography>
                                            )}
                                        </Box>
                                    ) : (
                                        <Alert severity="info" icon={<HourglassTop />}>
                                            Your ticket is {st.label.toLowerCase()}. Our support team will respond as soon as possible.
                                        </Alert>
                                    )}
                                </Stack>
                            </DialogContent>
                            <DialogActions sx={{ px: 3, pb: 3 }}>
                                <Button onClick={() => setSelectedTicket(null)} variant="outlined" sx={{ borderRadius: 2 }}>Close</Button>
                            </DialogActions>
                        </>
                    );
                })()}
            </Dialog>
        </Box>
    );
}
