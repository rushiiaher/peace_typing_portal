'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Chip, Tooltip, Paper, Snackbar, Alert, Divider, Stack,
    Skeleton, InputAdornment, Card, CardContent, Grid, Table, TableHead,
    TableRow, TableCell, TableBody, TableContainer, Tabs, Tab,
} from '@mui/material';
import {
    AccountBalance, Refresh, CheckCircle, HourglassEmpty, Warning,
    Person, Group, History, LockOpen,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface ExamFeeRow {
    id: string; enrollment_number: string; student_name: string;
    email?: string; phone?: string;
    batch_name: string; course_name: string; exam_fee: number;
    is_paid: boolean; student_is_active: boolean; batch_id: string;
}

interface DeliveryRow {
    id: string; batch_name: string; batch_code: string;
    course_name: string; delivery_fee: number;
    student_count: number; is_paid: boolean;
}

interface HistoryRow {
    id: string; payment_type: string; amount: number;
    payment_mode: string; payment_reference: string;
    is_verified: boolean; paid_at: string;
    student_name?: string; student_enrollment?: string; batch_name?: string;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export default function PaymentToAdminPage() {
    const [tab, setTab] = useState(0);
    const [examFees, setExamFees] = useState<ExamFeeRow[]>([]);
    const [delivery, setDelivery] = useState<DeliveryRow[]>([]);
    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [adminInfo, setAdminInfo] = useState<{ name: string; email: string; phone: string } | null>(null);
    const [loading, setLoading] = useState(true);

    // Pay state
    const [payingId, setPayingId] = useState<string | null>(null);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
        ({ open: false, message: '', severity: 'success' });
    const showSnackbar = (msg: string, sev: 'success' | 'error') =>
        setSnackbar({ open: true, message: msg, severity: sev });

    // Load Razorpay Script
    const loadRazorpay = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/institute/payment-to-admin');
        if (res.ok) {
            const j = await res.json();
            setAdminInfo(j.admin_info ?? null);
            setExamFees(j.exam_fees ?? []);
            setDelivery(j.delivery_charges ?? []);
            setHistory(j.history ?? []);
        }
        setLoading(false);
    }, []);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const triggerRazorpay = async (type: 'exam_fee' | 'delivery_charge', target: ExamFeeRow | DeliveryRow) => {
        const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!rzpKey || rzpKey.includes('your_key_id')) {
            showSnackbar('Razorpay Key is missing. Update NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local', 'error');
            return;
        }

        setPayingId(target.id);
        try {
            const amount = type === 'exam_fee'
                ? (target as ExamFeeRow).exam_fee
                : (target as DeliveryRow).delivery_fee;

            const shortId = target.id.substring(0, 8); // use first 8 chars of uuid

            if (amount === 0) {
                // Bypass Razorpay entirely for free items
                const body: any = {
                    payment_type: type,
                    amount: 0,
                    payment_mode: 'online', // Or free
                    payment_reference: 'FREE_ACTIVATION',
                    notes: 'Zero fee auto-activation'
                };
                if (type === 'exam_fee') body.student_id = target.id;
                else body.batch_id = target.id;

                const res = await fetch('/api/institute/payment-to-admin', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                if (!res.ok) throw new Error((await res.json()).error || 'Failed to process free activation');

                showSnackbar(`Activation successful for free fee.`, 'success');
                fetchAll();
                return;
            }

            const orderRes = await fetch('/api/razorpay/order', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, receipt: `rcpt_${shortId}_${Date.now()}`.substring(0, 40), notes: { payment_type: type, id: target.id } })
            });

            const order = await orderRes.json();
            if (!orderRes.ok) throw new Error(order.error || 'Order creation failed');

            const loaded = await loadRazorpay();
            if (!loaded) throw new Error('Razorpay SDK failed to load.');

            const options = {
                key: rzpKey,
                amount: order.amount,
                currency: order.currency,
                name: 'PEACE TYPING PORTAL',
                description: type === 'exam_fee' ? `Exam Fee: ${(target as ExamFeeRow).student_name}` : `Delivery: ${(target as DeliveryRow).batch_name}`,
                order_id: order.id,
                handler: async (response: any) => {
                    const verifyRes = await fetch('/api/razorpay/verify', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...response,
                            payment_type: type,
                            student_id: type === 'exam_fee' ? target.id : null,
                            batch_id: type === 'delivery_charge' ? target.id : null,
                            amount: amount,
                            notes: `Online Payment`
                        })
                    });

                    const verJson = await verifyRes.json();
                    if (verJson.success) {
                        showSnackbar('Payment successful!', 'success');
                        fetchAll();
                    } else throw new Error(verJson.error || 'Verification failed');
                },
                prefill: {
                    name: type === 'exam_fee' ? (target as ExamFeeRow).student_name : adminInfo?.name || '',
                    email: (type === 'exam_fee' ? (target as ExamFeeRow).email : adminInfo?.email) || adminInfo?.email || '',
                    contact: (type === 'exam_fee' ? (target as ExamFeeRow).phone : adminInfo?.phone) || adminInfo?.phone || '',
                },
                theme: { color: '#2563eb' }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (resp: any) => showSnackbar(resp.error.description, 'error'));
            rzp.open();

        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setPayingId(null); }
    };

    const pendingExam = examFees.filter(e => !e.is_paid);
    const pendingDelivery = delivery.filter(d => !d.is_paid);
    const totalPendingExam = pendingExam.reduce((s, r) => s + r.exam_fee, 0);
    const totalPendingDelivery = pendingDelivery.reduce((s, r) => s + r.delivery_fee, 0);

    return (
        <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Pay to Super Admin</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Pay exam fees (per student) and delivery charges (per batch) · Students are activated after exam fee payment
                    </Typography>
                </Box>
                <Tooltip title="Refresh">
                    <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchAll}>Refresh</Button>
                </Tooltip>
            </Box>

            {/* Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Exam Fee Pending', value: fmt(totalPendingExam), sub: `${pendingExam.length} students`, icon: <Person />, color: 'error.main' },
                    { label: 'Delivery Charge Pending', value: fmt(totalPendingDelivery), sub: `${pendingDelivery.length} batch${pendingDelivery.length !== 1 ? 'es' : ''}`, icon: <Group />, color: 'warning.main' },
                    { label: 'Total Due to Admin', value: fmt(totalPendingExam + totalPendingDelivery), sub: 'exam + delivery', icon: <AccountBalance />, color: 'primary.main' },
                    { label: 'Payments Made', value: history.length.toString(), sub: 'lifetime', icon: <History />, color: 'success.main' },
                ].map(s => (
                    <Grid item xs={6} md={3} key={s.label}>
                        <Card variant="outlined">
                            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Box sx={{ color: s.color, display: 'flex' }}>{s.icon}</Box>
                                    <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                                </Box>
                                <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Important note */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, bgcolor: 'warning.50', borderColor: 'warning.300', display: 'flex', gap: 1.5 }}>
                <LockOpen color="warning" sx={{ mt: 0.2 }} />
                <Box>
                    <Typography variant="body2" fontWeight={700} color="warning.dark">Student Login Activation</Typography>
                    <Typography variant="body2" color="warning.dark">
                        Students are created with login <strong>disabled</strong>. When you pay the exam fee (per student) here,
                        that student's account is <strong>automatically activated</strong> and they can log in to appear for the exam.
                    </Typography>
                </Box>
            </Paper>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label={`Exam Fees (${pendingExam.length} pending)`} icon={<Person />} iconPosition="start" />
                <Tab label={`Delivery Charges (${pendingDelivery.length} pending)`} icon={<Group />} iconPosition="start" />
                <Tab label="Payment History" icon={<History />} iconPosition="start" />
            </Tabs>

            {loading
                ? <Stack spacing={1}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={56} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
                : <>
                    {/* ── Tab 0: Exam Fees ── */}
                    {tab === 0 && (
                        <Paper variant="outlined">
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>Roll No</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Exam Fee</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Login Status</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {examFees.length === 0
                                            ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No students found.</TableCell></TableRow>
                                            : examFees.map(row => (
                                                <TableRow key={row.id} hover
                                                    sx={{ bgcolor: row.is_paid ? 'success.50' : 'inherit' }}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontFamily="monospace">{row.enrollment_number}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{row.student_name}</Typography>
                                                    </TableCell>
                                                    <TableCell><Typography variant="body2">{row.course_name}</Typography></TableCell>
                                                    <TableCell><Typography variant="body2">{row.batch_name}</Typography></TableCell>
                                                    <TableCell>
                                                        <Typography fontWeight={700} color={row.is_paid ? 'text.secondary' : 'error.main'}>
                                                            {fmt(row.exam_fee)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            icon={row.student_is_active
                                                                ? <CheckCircle sx={{ fontSize: '14px !important' }} />
                                                                : <Warning sx={{ fontSize: '14px !important' }} />}
                                                            label={row.student_is_active ? 'Active' : 'Locked'}
                                                            color={row.student_is_active ? 'success' : 'error'}
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={row.is_paid ? 'Paid' : 'Unpaid'}
                                                            color={row.is_paid ? 'success' : 'default'}
                                                            variant={row.is_paid ? 'filled' : 'outlined'}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {row.is_paid
                                                            ? <CheckCircle color="success" />
                                                            : <Button size="small" variant="contained" color="error"
                                                                startIcon={<AccountBalance />}
                                                                disabled={payingId === row.id}
                                                                onClick={() => triggerRazorpay('exam_fee', row)}>
                                                                {payingId === row.id ? 'Processing...' : `Pay ${fmt(row.exam_fee)}`}
                                                            </Button>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {/* ── Tab 1: Delivery Charges ── */}
                    {tab === 1 && (
                        <Paper variant="outlined">
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Students</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Delivery Charge</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {delivery.length === 0
                                            ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No batches found.</TableCell></TableRow>
                                            : delivery.map(row => (
                                                <TableRow key={row.id} hover sx={{ bgcolor: row.is_paid ? 'success.50' : 'inherit' }}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{row.batch_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{row.batch_code}</Typography>
                                                    </TableCell>
                                                    <TableCell><Typography variant="body2">{row.course_name}</Typography></TableCell>
                                                    <TableCell>
                                                        <Chip label={`${row.student_count} student${row.student_count !== 1 ? 's' : ''}`} size="small" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography fontWeight={700} color={row.is_paid ? 'text.secondary' : 'warning.dark'}>
                                                            {fmt(row.delivery_fee)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={row.is_paid ? 'Paid' : 'Pending'}
                                                            color={row.is_paid ? 'success' : 'warning'}
                                                            variant={row.is_paid ? 'filled' : 'outlined'}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {row.is_paid
                                                            ? <CheckCircle color="success" />
                                                            : <Button size="small" variant="contained" color="warning"
                                                                startIcon={<AccountBalance />}
                                                                disabled={payingId === row.id}
                                                                onClick={() => triggerRazorpay('delivery_charge', row)}>
                                                                {payingId === row.id ? 'Processing...' : `Pay ${fmt(row.delivery_fee)}`}
                                                            </Button>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}

                    {/* ── Tab 2: History ── */}
                    {tab === 2 && (
                        <Paper variant="outlined">
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'grey.50' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>For</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Mode</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Verified</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {history.length === 0
                                            ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No payment history yet.</TableCell></TableRow>
                                            : history.map(h => (
                                                <TableRow key={h.id} hover>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={h.payment_type === 'exam_fee' ? 'Exam Fee' : 'Delivery'}
                                                            color={h.payment_type === 'exam_fee' ? 'error' : 'warning'}
                                                            variant="outlined"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {h.student_name
                                                            ? <><Typography variant="body2" fontWeight={600}>{h.student_name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">{h.student_enrollment}</Typography></>
                                                            : <Typography variant="body2">{h.batch_name}</Typography>}
                                                    </TableCell>
                                                    <TableCell><Typography fontWeight={700}>{fmt(h.amount)}</Typography></TableCell>
                                                    <TableCell>
                                                        <Chip label={h.payment_mode?.toUpperCase()} size="small" variant="outlined" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                                                            {h.payment_reference || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={h.is_verified ? 'Verified' : 'Pending'}
                                                            color={h.is_verified ? 'success' : 'default'}
                                                            icon={h.is_verified ? <CheckCircle sx={{ fontSize: '14px !important' }} /> : <HourglassEmpty sx={{ fontSize: '14px !important' }} />}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {h.paid_at ? new Date(h.paid_at).toLocaleDateString('en-IN') : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    )}
                </>}



            <Snackbar open={snackbar.open} autoHideDuration={6000}
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
