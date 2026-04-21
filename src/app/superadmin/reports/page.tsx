'use client';

import { useState, useCallback } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Paper, Stack,
    Button, Chip, Divider, Alert, Skeleton, Table, TableHead,
    TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material';
import {
    Assessment, Download, Business, People, School,
    CurrencyRupee, Refresh, TableChart,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface ReportRow { [key: string]: string | number }

interface ReportDef {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    apiPath: string;
    columns: { key: string; label: string }[];
    transform: (data: any) => ReportRow[];
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function downloadCsv(rows: ReportRow[], columns: { key: string; label: string }[], filename: string) {
    const header = columns.map(c => `"${c.label}"`).join(',');
    const body = rows.map(r => columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

/* ─── Report Definitions ────────────────────────────────────────────────── */
const REPORTS: ReportDef[] = [
    {
        id: 'revenue',
        title: 'Institute-wise Revenue',
        description: 'Verified payment collection breakdown per institute',
        icon: <CurrencyRupee />, color: '#16a34a', bg: '#f0fdf4',
        apiPath: '/api/admin/payments',
        columns: [
            { key: 'institute', label: 'Institute' },
            { key: 'exam_fee', label: 'Exam Fees (₹)' },
            { key: 'delivery', label: 'Delivery Charges (₹)' },
            { key: 'total', label: 'Total Revenue (₹)' },
        ],
        transform: (data: any) => {
            const payments: any[] = data.payments ?? [];
            const map: Record<string, { institute: string; exam_fee: number; delivery: number }> = {};
            for (const p of payments) {
                if (!p.is_verified) continue;
                const key = p.institute_name || 'Unknown';
                if (!map[key]) map[key] = { institute: key, exam_fee: 0, delivery: 0 };
                if (p.payment_type === 'exam_fee') map[key].exam_fee += Number(p.amount ?? 0);
                else map[key].delivery += Number(p.amount ?? 0);
            }
            return Object.values(map).map(r => ({ ...r, total: r.exam_fee + r.delivery }))
                .sort((a, b) => (b.total as number) - (a.total as number));
        },
    },
    {
        id: 'enrollment',
        title: 'Course Enrollment Analytics',
        description: 'Student enrollment count grouped by course',
        icon: <School />, color: '#2563eb', bg: '#eff6ff',
        apiPath: '/api/admin/course-allocation',
        columns: [
            { key: 'course', label: 'Course' },
            { key: 'code', label: 'Code' },
            { key: 'institutes', label: 'Institutes' },
            { key: 'batches', label: 'Batches' },
        ],
        transform: (data: any) => {
            const allocs: any[] = data.allocations ?? [];
            const map: Record<string, { course: string; code: string; institutes: number; batches: number }> = {};
            for (const a of allocs) {
                const key = a.course_name || 'Unknown';
                if (!map[key]) map[key] = { course: key, code: a.course_code || '', institutes: 0, batches: 0 };
                map[key].institutes++;
                map[key].batches += Number(a.batch_count ?? 0);
            }
            return Object.values(map).sort((a, b) => (b.institutes as number) - (a.institutes as number));
        },
    },
    {
        id: 'payment-summary',
        title: 'Payment Collection Summary',
        description: 'All payments with verification status',
        icon: <TableChart />, color: '#d97706', bg: '#fffbeb',
        apiPath: '/api/admin/payments',
        columns: [
            { key: 'date', label: 'Date' },
            { key: 'institute', label: 'Institute' },
            { key: 'type', label: 'Type' },
            { key: 'amount', label: 'Amount (₹)' },
            { key: 'status', label: 'Status' },
            { key: 'reference', label: 'Reference' },
        ],
        transform: (data: any) => (data.payments ?? []).map((p: any) => ({
            date: fmtDate(p.paid_at),
            institute: p.institute_name || '—',
            type: p.payment_type === 'exam_fee' ? 'Exam Fee' : 'Delivery',
            amount: Number(p.amount ?? 0),
            status: p.is_verified ? 'Verified' : 'Pending',
            reference: p.payment_reference || '—',
        })),
    },
    {
        id: 'institutes',
        title: 'Institute Directory',
        description: 'All registered institutes with contact details',
        icon: <Business />, color: '#7c3aed', bg: '#f5f3ff',
        apiPath: '/api/admin/list-institutes',
        columns: [
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Institute Name' },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' },
        ],
        transform: (data: any) => (data.institutes ?? []).map((inst: any) => ({
            code: inst.code || '—',
            name: inst.name || '—',
            city: inst.city || '—',
            state: inst.state || '—',
            phone: inst.phone || '—',
            email: inst.email || '—',
            status: inst.is_active ? 'Active' : 'Inactive',
        })),
    },
];

/* ─── Report Card ────────────────────────────────────────────────────────── */
function ReportCard({ report }: { report: ReportDef }) {
    const [rows, setRows] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState('');

    const generate = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch(report.apiPath);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load data');
            setRows(report.transform(json));
            setLoaded(true);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [report]);

    const handleDownload = () => {
        downloadCsv(rows, report.columns, `${report.id}-report-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    return (
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: report.bg, color: report.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {report.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={700}>{report.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{report.description}</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexShrink={0}>
                    <Button
                        size="small" variant="outlined" startIcon={loading ? undefined : <Refresh />}
                        onClick={generate} disabled={loading}
                    >
                        {loading ? 'Loading…' : loaded ? 'Refresh' : 'Generate'}
                    </Button>
                    {loaded && rows.length > 0 && (
                        <Button size="small" variant="contained" startIcon={<Download />} onClick={handleDownload}
                            sx={{ bgcolor: report.color, '&:hover': { bgcolor: report.color, opacity: 0.88 } }}>
                            CSV
                        </Button>
                    )}
                </Stack>
            </Box>

            {/* Error */}
            {error && <Alert severity="error" sx={{ mx: 3, mb: 2 }}>{error}</Alert>}

            {/* Skeleton while loading */}
            {loading && (
                <Box sx={{ px: 3, pb: 3 }}>
                    {[...Array(4)].map((_, i) => <Skeleton key={i} height={32} sx={{ mb: 0.5 }} />)}
                </Box>
            )}

            {/* Data table */}
            {loaded && !loading && (
                <>
                    <Divider />
                    <Box sx={{ px: 3, py: 1.5, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {rows.length} row{rows.length !== 1 ? 's' : ''}
                        </Typography>
                        {rows.length > 0 && (
                            <Chip size="small" label="Ready to Download" color="success" variant="outlined" sx={{ fontSize: 10 }} />
                        )}
                    </Box>
                    {rows.length === 0
                        ? <Box sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">No data available</Typography></Box>
                        : <TableContainer sx={{ maxHeight: 280 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        {report.columns.map(c => (
                                            <TableCell key={c.key} sx={{ fontWeight: 700, bgcolor: '#f8fafc', fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>
                                                {c.label}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.slice(0, 10).map((row, i) => (
                                        <TableRow key={i} hover>
                                            {report.columns.map(c => (
                                                <TableCell key={c.key} sx={{ fontSize: 12 }}>
                                                    {typeof row[c.key] === 'number' && c.key !== 'batches' && c.key !== 'institutes'
                                                        ? fmt(row[c.key] as number)
                                                        : String(row[c.key] ?? '—')}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    {rows.length > 10 && (
                                        <TableRow>
                                            <TableCell colSpan={report.columns.length} sx={{ textAlign: 'center', py: 1.5, color: '#94a3b8', fontSize: 12 }}>
                                                + {rows.length - 10} more rows — download CSV for full data
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    }
                </>
            )}
        </Paper>
    );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ReportsPage() {
    return (
        <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                    <Assessment sx={{ color: 'primary.main', fontSize: 32 }} />
                    <Typography variant="h4" fontWeight={900}>Reports</Typography>
                </Stack>
                <Typography color="text.secondary">
                    Generate and download reports as CSV. Click <strong>Generate</strong> on any report to load live data.
                </Typography>
            </Box>

            <Stack spacing={3}>
                {REPORTS.map(report => (
                    <ReportCard key={report.id} report={report} />
                ))}
            </Stack>

        </AdminLayout>
    );
}
