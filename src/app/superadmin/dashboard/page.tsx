'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Paper, Stack,
    Skeleton, Chip, Divider, Alert, Table, TableHead, TableRow,
    TableCell, TableBody, TableContainer, Avatar,
} from '@mui/material';
import {
    Business, People, School, Layers, AccountBalance,
    HourglassEmpty, TrendingUp, SupportAgent, CheckCircle,
    FiberManualRecord, CurrencyRupee, CalendarMonth,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Stats {
    total_institutes: number; active_institutes: number;
    total_students: number; active_students: number;
    total_courses: number; total_batches: number;
    total_revenue: number; total_verified: number;
    total_pending: number; this_month_revenue: number;
    open_support_tickets: number;
}
interface RecentInstitute { id: string; name: string; code: string; city: string; state: string; created_at: string; is_active: boolean; }
interface RecentPayment { id: string; institute_name: string; institute_code: string; amount: number; payment_type: string; paid_at: string; is_verified: boolean; }
interface InstBreakdown { id: string; name: string; code: string; student_count: number; batch_count: number; revenue: number; }

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({
    label, value, sub, icon, color, bg, loading,
}: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string; bg: string; loading: boolean }) {
    return (
        <Card elevation={0} sx={{
            borderRadius: 3, border: '1px solid #e2e8f0',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.09)' },
        }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ width: 48, height: 48, borderRadius: 2.5, bgcolor: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {icon}
                    </Box>
                </Box>
                {loading
                    ? <Skeleton width={90} height={40} />
                    : <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1, mb: 0.5 }}>{value}</Typography>}
                <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ mb: 0.3 }}>{label}</Typography>
                {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
            </CardContent>
        </Card>
    );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentInstitutes, setRecentInstitutes] = useState<RecentInstitute[]>([]);
    const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
    const [breakdown, setBreakdown] = useState<InstBreakdown[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/dashboard');
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load dashboard.');
            setStats(json.stats);
            setRecentInstitutes(json.recent_institutes ?? []);
            setRecentPayments(json.recent_payments ?? []);
            setBreakdown(json.institute_breakdown ?? []);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const s = stats;
    const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const kpiCards = [
        { label: 'Total Institutes', value: loading ? '…' : String(s?.total_institutes ?? 0), sub: `${s?.active_institutes ?? 0} active`, icon: <Business />, color: '#2563eb', bg: '#eff6ff' },
        { label: 'Total Students', value: loading ? '…' : String(s?.total_students ?? 0), sub: `${s?.active_students ?? 0} active`, icon: <People />, color: '#7c3aed', bg: '#f5f3ff' },
        { label: 'Active Courses', value: loading ? '…' : String(s?.total_courses ?? 0), sub: 'Across all languages', icon: <School />, color: '#0891b2', bg: '#ecfeff' },
        { label: 'Active Batches', value: loading ? '…' : String(s?.total_batches ?? 0), sub: 'Currently running', icon: <Layers />, color: '#d97706', bg: '#fffbeb' },
        { label: 'Total Revenue', value: loading ? '…' : fmt(s?.total_verified ?? 0), sub: 'Verified payments only', icon: <AccountBalance />, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Pending Verification', value: loading ? '…' : fmt(s?.total_pending ?? 0), sub: 'Awaiting review', icon: <HourglassEmpty />, color: '#dc2626', bg: '#fef2f2' },
        { label: 'This Month', value: loading ? '…' : fmt(s?.this_month_revenue ?? 0), sub: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), icon: <CalendarMonth />, color: '#0d9488', bg: '#f0fdfa' },
        { label: 'Open Tickets', value: loading ? '…' : String(s?.open_support_tickets ?? 0), sub: 'Support requests', icon: <SupportAgent />, color: '#9333ea', bg: '#faf5ff' },
    ];

    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

            {/* ── Page Header ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={900} sx={{ lineHeight: 1.1 }}>Dashboard</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Platform overview — {today}</Typography>
                </Box>
                <Chip
                    label="Live Data"
                    size="small"
                    icon={<FiberManualRecord sx={{ fontSize: '10px !important', color: '#16a34a !important' }} />}
                    sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 700, border: '1px solid #bbf7d0' }}
                />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* ── KPI Cards ── */}
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
                {kpiCards.map(k => (
                    <Grid item xs={6} sm={4} md={3} key={k.label}>
                        <KpiCard {...k} loading={loading && !stats} />
                    </Grid>
                ))}
            </Grid>

            {/* ── Recent Activity Row ── */}
            <Grid container spacing={3} sx={{ mb: 4 }}>

                {/* Recent Institutes */}
                <Grid item xs={12} md={5}>
                    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', height: '100%' }}>
                        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Business fontSize="small" color="primary" />
                            <Typography fontWeight={700}>Recent Institutes</Typography>
                            <Chip label="Last 5" size="small" sx={{ ml: 'auto', fontSize: 10 }} />
                        </Box>
                        {loading
                            ? <Stack spacing={0}>{[...Array(5)].map((_, i) => <Box key={i} sx={{ px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9' }}><Skeleton height={22} /></Box>)}</Stack>
                            : recentInstitutes.length === 0
                                ? <Box sx={{ py: 6, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">No institutes yet</Typography></Box>
                                : recentInstitutes.map((inst, i) => (
                                    <Box key={inst.id} sx={{ px: 3, py: 1.8, borderBottom: i < recentInstitutes.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Avatar sx={{ width: 34, height: 34, bgcolor: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 800 }}>
                                            {inst.code?.slice(0, 2).toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight={700} noWrap>{inst.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{inst.city || inst.code} · {fmtDate(inst.created_at)}</Typography>
                                        </Box>
                                        <Chip size="small" label={inst.is_active ? 'Active' : 'Inactive'} color={inst.is_active ? 'success' : 'default'} variant="outlined" sx={{ fontSize: 10 }} />
                                    </Box>
                                ))
                        }
                    </Paper>
                </Grid>

                {/* Recent Payments */}
                <Grid item xs={12} md={7}>
                    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', height: '100%' }}>
                        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CurrencyRupee fontSize="small" color="success" />
                            <Typography fontWeight={700}>Recent Payments</Typography>
                            <Chip label="Last 5" size="small" sx={{ ml: 'auto', fontSize: 10 }} />
                        </Box>
                        {loading
                            ? <Stack spacing={0}>{[...Array(5)].map((_, i) => <Box key={i} sx={{ px: 3, py: 1.5, borderBottom: '1px solid #f1f5f9' }}><Skeleton height={22} /></Box>)}</Stack>
                            : recentPayments.length === 0
                                ? <Box sx={{ py: 6, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">No payments yet</Typography></Box>
                                : recentPayments.map((p, i) => (
                                    <Box key={p.id} sx={{ px: 3, py: 1.8, borderBottom: i < recentPayments.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: p.is_verified ? '#f0fdf4' : '#fffbeb', flexShrink: 0 }}>
                                            {p.is_verified
                                                ? <CheckCircle sx={{ color: '#16a34a', fontSize: 20 }} />
                                                : <HourglassEmpty sx={{ color: '#d97706', fontSize: 20 }} />}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight={700} noWrap>{p.institute_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {p.payment_type === 'exam_fee' ? 'Exam Fee' : 'Delivery'} · {p.paid_at ? fmtDate(p.paid_at) : '—'}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" fontWeight={800} color={p.is_verified ? 'success.dark' : 'warning.dark'}>
                                            {fmt(p.amount)}
                                        </Typography>
                                    </Box>
                                ))
                        }
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Institute Breakdown Table ── */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp fontSize="small" color="primary" />
                    <Typography fontWeight={700}>Institute Breakdown</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Active institutes only</Typography>
                </Box>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                {['Code', 'Institute Name', 'Students', 'Batches', 'Revenue Verified'].map(h => (
                                    <TableCell key={h} sx={{ fontWeight: 800, color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading
                                ? [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        {[...Array(5)].map((_, j) => <TableCell key={j}><Skeleton height={20} /></TableCell>)}
                                    </TableRow>
                                ))
                                : breakdown.length === 0
                                    ? <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: '#94a3b8' }}>No institutes found</TableCell></TableRow>
                                    : breakdown.map(inst => (
                                        <TableRow key={inst.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                            <TableCell>
                                                <Typography variant="caption" fontFamily="monospace" fontWeight={700} sx={{ bgcolor: '#eff6ff', color: '#2563eb', px: 1, py: 0.3, borderRadius: 1 }}>
                                                    {inst.code}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{inst.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={inst.student_count} icon={<People sx={{ fontSize: '13px !important' }} />} variant="outlined" sx={{ fontSize: 11 }} />
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={inst.batch_count} icon={<Layers sx={{ fontSize: '13px !important' }} />} variant="outlined" sx={{ fontSize: 11 }} />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={800} color={inst.revenue > 0 ? 'success.dark' : 'text.secondary'}>
                                                    {fmt(inst.revenue)}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

        </AdminLayout>
    );
}
