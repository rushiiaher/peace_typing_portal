'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    Chip, Tooltip, Paper, Snackbar, Alert, Stack, Skeleton, Card, CardContent,
    Grid, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
    Tabs, Tab, Checkbox, FormControl, InputLabel, Select, MenuItem,
    Divider, LinearProgress,
} from '@mui/material';
import {
    AccountBalance, Refresh, CheckCircle, HourglassEmpty, Warning,
    Person, Group, History, LockOpen, SelectAll, ClearAll, Payment,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface ExamFeeRow {
    id: string; enrollment_number: string; student_name: string;
    email?: string; phone?: string;
    batch_name: string; batch_id: string; course_name: string; exam_fee: number;
    is_paid: boolean; student_is_active: boolean;
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

    // Single-pay state
    const [payingId, setPayingId] = useState<string | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchFilter, setBatchFilter] = useState<string>('__all__');

    // Bulk pay dialog
    const [bulkPayDialog, setBulkPayDialog] = useState(false);
    const [bulkPaying, setBulkPaying] = useState(false);
    const [bulkProgress, setBulkProgress] = useState(0);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
        ({ open: false, message: '', severity: 'success' });
    const showSnackbar = (msg: string, sev: 'success' | 'error') =>
        setSnackbar({ open: true, message: msg, severity: sev });

    const loadRazorpay = () => new Promise((resolve) => {
        if ((window as any).Razorpay) { resolve(true); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setSelectedIds(new Set());
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

    // ── Derived values ────────────────────────────────────────────────────────
    const pendingExam = useMemo(() => examFees.filter(e => !e.is_paid), [examFees]);
    const pendingDelivery = useMemo(() => delivery.filter(d => !d.is_paid), [delivery]);
    const totalPendingExam = pendingExam.reduce((s, r) => s + r.exam_fee, 0);
    const totalPendingDelivery = pendingDelivery.reduce((s, r) => s + r.delivery_fee, 0);

    // Unique batches from pending exam fees for filter dropdown
    const batchOptions = useMemo(() => {
        const map = new Map<string, string>();
        pendingExam.forEach(r => { if (!map.has(r.batch_id)) map.set(r.batch_id, r.batch_name); });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [pendingExam]);

    // Filtered pending rows by batch
    const filteredPending = useMemo(() =>
        batchFilter === '__all__'
            ? pendingExam
            : pendingExam.filter(r => r.batch_id === batchFilter),
        [pendingExam, batchFilter]
    );

    // Selected rows (only from pending)
    const selectedRows = useMemo(() =>
        pendingExam.filter(r => selectedIds.has(r.id)),
        [pendingExam, selectedIds]
    );
    const totalSelected = selectedRows.reduce((s, r) => s + r.exam_fee, 0);

    // Checkbox helpers
    const visiblePendingIds = filteredPending.map(r => r.id);
    const allFilteredSelected = visiblePendingIds.length > 0 && visiblePendingIds.every(id => selectedIds.has(id));
    const someFilteredSelected = visiblePendingIds.some(id => selectedIds.has(id));

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAllFiltered = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                visiblePendingIds.forEach(id => next.delete(id));
            } else {
                visiblePendingIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const selectAllPending = () => setSelectedIds(new Set(pendingExam.map(r => r.id)));
    const clearSelection = () => setSelectedIds(new Set());

    // ── Single student Razorpay ───────────────────────────────────────────────
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

            if (amount === 0) {
                const bodyObj: any = {
                    payment_type: type, amount: 0,
                    payment_mode: 'online', payment_reference: 'FREE_ACTIVATION',
                    notes: 'Zero fee auto-activation',
                };
                if (type === 'exam_fee') bodyObj.student_id = target.id;
                else bodyObj.batch_id = target.id;
                const res = await fetch('/api/institute/payment-to-admin', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyObj),
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to process free activation');
                showSnackbar('Activation successful for free fee.', 'success');
                fetchAll();
                return;
            }

            const shortId = target.id.substring(0, 8);
            const orderRes = await fetch('/api/razorpay/order', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    receipt: `rcpt_${shortId}_${Date.now()}`.substring(0, 40),
                    notes: { payment_type: type, id: target.id },
                }),
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
                description: type === 'exam_fee'
                    ? `Exam Fee: ${(target as ExamFeeRow).student_name}`
                    : `Delivery: ${(target as DeliveryRow).batch_name}`,
                order_id: order.id,
                handler: async (response: any) => {
                    const verifyRes = await fetch('/api/razorpay/verify', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            ...response, payment_type: type,
                            student_id: type === 'exam_fee' ? target.id : null,
                            batch_id: type === 'delivery_charge' ? target.id : null,
                            amount, notes: 'Online Payment',
                        }),
                    });
                    const verJson = await verifyRes.json();
                    if (verJson.success) { showSnackbar('Payment successful!', 'success'); fetchAll(); }
                    else throw new Error(verJson.error || 'Verification failed');
                },
                prefill: {
                    name: type === 'exam_fee' ? (target as ExamFeeRow).student_name : adminInfo?.name || '',
                    email: (type === 'exam_fee' ? (target as ExamFeeRow).email : adminInfo?.email) || adminInfo?.email || '',
                    contact: adminInfo?.phone || '',
                },
                theme: { color: '#2563eb' },
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (resp: any) => showSnackbar(resp.error.description, 'error'));
            rzp.open();
        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setPayingId(null); }
    };

    // ── Bulk Razorpay ─────────────────────────────────────────────────────────
    const triggerBulkRazorpay = async () => {
        if (selectedRows.length === 0) return;
        const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!rzpKey || rzpKey.includes('your_key_id')) {
            showSnackbar('Razorpay Key is missing. Update NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local', 'error');
            return;
        }

        setBulkPaying(true);
        setBulkProgress(10);

        try {
            // Build amount_per_student map
            const amountMap: Record<string, number> = {};
            selectedRows.forEach(r => { amountMap[r.id] = r.exam_fee; });
            const studentIds = selectedRows.map(r => r.id);

            // If ALL are zero-fee, bypass Razorpay
            if (totalSelected === 0) {
                setBulkProgress(50);
                const res = await fetch('/api/institute/payment-to-admin/bulk', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_ids: studentIds,
                        amount_per_student: amountMap,
                        payment_mode: 'online',
                        payment_reference: 'FREE_ACTIVATION',
                        notes: 'Zero fee bulk activation',
                    }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Bulk activation failed');
                setBulkProgress(100);
                showSnackbar(`${j.processed} student(s) activated successfully.`, 'success');
                setBulkPayDialog(false);
                clearSelection();
                fetchAll();
                return;
            }

            // Create a single Razorpay order for the total amount
            setBulkProgress(20);
            const receipt = `bulk_${Date.now()}`.substring(0, 40);
            const orderRes = await fetch('/api/razorpay/order', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: totalSelected,
                    receipt,
                    notes: { payment_type: 'exam_fee_bulk', student_count: studentIds.length },
                }),
            });
            const order = await orderRes.json();
            if (!orderRes.ok) throw new Error(order.error || 'Order creation failed');
            setBulkProgress(40);

            const loaded = await loadRazorpay();
            if (!loaded) throw new Error('Razorpay SDK failed to load.');

            const options = {
                key: rzpKey,
                amount: order.amount,
                currency: order.currency,
                name: 'PEACE TYPING PORTAL',
                description: `Bulk Exam Fee — ${studentIds.length} student${studentIds.length !== 1 ? 's' : ''}`,
                order_id: order.id,
                handler: async (response: any) => {
                    setBulkProgress(70);
                    // Verify signature server-side and record bulk payments
                    const verifyRes = await fetch('/api/institute/payment-to-admin/bulk', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            student_ids: studentIds,
                            amount_per_student: amountMap,
                            payment_mode: 'razorpay',
                            payment_reference: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            notes: `Bulk Razorpay Order: ${response.razorpay_order_id}`,
                        }),
                    });
                    const verJson = await verifyRes.json();
                    if (!verifyRes.ok) throw new Error(verJson.error || 'Bulk verification failed');
                    setBulkProgress(100);
                    showSnackbar(`${verJson.processed} student(s) paid & activated successfully!`, 'success');
                    setBulkPayDialog(false);
                    clearSelection();
                    fetchAll();
                },
                prefill: {
                    name: adminInfo?.name || '',
                    email: adminInfo?.email || '',
                    contact: adminInfo?.phone || '',
                },
                theme: { color: '#2563eb' },
                modal: {
                    ondismiss: () => {
                        setBulkPaying(false);
                        setBulkProgress(0);
                    },
                },
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (resp: any) => {
                showSnackbar(resp.error.description, 'error');
                setBulkPaying(false);
                setBulkProgress(0);
            });
            rzp.open();

        } catch (e: any) {
            showSnackbar(e.message, 'error');
            setBulkPaying(false);
            setBulkProgress(0);
        }
    };

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

            <Tabs value={tab} onChange={(_, v) => { setTab(v); clearSelection(); }} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Tab label={`Exam Fees (${pendingExam.length} pending)`} icon={<Person />} iconPosition="start" />
                <Tab label={`Delivery Charges (${pendingDelivery.length} pending)`} icon={<Group />} iconPosition="start" />
                <Tab label="Payment History" icon={<History />} iconPosition="start" />
            </Tabs>

            {loading
                ? <Stack spacing={1}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={56} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
                : <>
                    {/* ── Tab 0: Exam Fees ── */}
                    {tab === 0 && (
                        <Box>
                            {/* Toolbar: filter + bulk actions */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                                {/* Batch filter */}
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel>Filter by Batch</InputLabel>
                                    <Select
                                        value={batchFilter}
                                        label="Filter by Batch"
                                        onChange={e => { setBatchFilter(e.target.value); }}
                                    >
                                        <MenuItem value="__all__">All Batches</MenuItem>
                                        {batchOptions.map(b => (
                                            <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {/* Quick selection helpers */}
                                {pendingExam.length > 0 && (
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            size="small" variant="outlined" startIcon={<SelectAll />}
                                            onClick={selectAllPending}
                                            disabled={selectedIds.size === pendingExam.length}
                                        >
                                            Select All Pending ({pendingExam.length})
                                        </Button>
                                        {selectedIds.size > 0 && (
                                            <Button
                                                size="small" variant="outlined" color="inherit"
                                                startIcon={<ClearAll />}
                                                onClick={clearSelection}
                                            >
                                                Clear ({selectedIds.size})
                                            </Button>
                                        )}
                                    </Stack>
                                )}
                            </Box>

                            <Paper variant="outlined">
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                                                {/* Select-all checkbox for visible filtered rows */}
                                                <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                                    {filteredPending.length > 0 && (
                                                        <Tooltip title={allFilteredSelected ? 'Deselect all visible' : 'Select all visible'}>
                                                            <Checkbox
                                                                size="small"
                                                                checked={allFilteredSelected}
                                                                indeterminate={someFilteredSelected && !allFilteredSelected}
                                                                onChange={toggleAllFiltered}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
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
                                                ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>No students found.</TableCell></TableRow>
                                                : examFees.map(row => {
                                                    const isPending = !row.is_paid;
                                                    const isSelected = selectedIds.has(row.id);
                                                    const isHidden = batchFilter !== '__all__' && row.batch_id !== batchFilter && isPending;
                                                    if (isHidden) return null;
                                                    return (
                                                        <TableRow
                                                            key={row.id}
                                                            hover
                                                            selected={isSelected}
                                                            sx={{
                                                                bgcolor: row.is_paid
                                                                    ? 'success.50'
                                                                    : isSelected
                                                                        ? 'primary.50'
                                                                        : 'inherit',
                                                                cursor: isPending ? 'pointer' : 'default',
                                                            }}
                                                            onClick={() => { if (isPending) toggleOne(row.id); }}
                                                        >
                                                            <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                                                {isPending && (
                                                                    <Checkbox
                                                                        size="small"
                                                                        checked={isSelected}
                                                                        onChange={() => toggleOne(row.id)}
                                                                        onClick={e => e.stopPropagation()}
                                                                    />
                                                                )}
                                                            </TableCell>
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
                                                            <TableCell align="right" onClick={e => e.stopPropagation()}>
                                                                {row.is_paid
                                                                    ? <CheckCircle color="success" />
                                                                    : <Button
                                                                        size="small" variant="outlined" color="error"
                                                                        startIcon={<AccountBalance />}
                                                                        disabled={payingId === row.id || bulkPaying}
                                                                        onClick={() => triggerRazorpay('exam_fee', row)}
                                                                    >
                                                                        {payingId === row.id ? 'Processing...' : `Pay ${fmt(row.exam_fee)}`}
                                                                    </Button>}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>

                            {/* ── Bulk Pay Sticky Bar ── */}
                            {selectedIds.size > 0 && (
                                <Paper
                                    elevation={6}
                                    sx={{
                                        position: 'sticky', bottom: 16, mt: 2,
                                        p: 2, borderRadius: 2,
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        bgcolor: 'primary.main', color: 'white',
                                        flexWrap: 'wrap', gap: 1.5,
                                    }}
                                >
                                    <Box>
                                        <Typography variant="body1" fontWeight={700}>
                                            {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
                                        </Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                            Total: {fmt(totalSelected)} exam fee
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1.5}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                                            onClick={clearSelection}
                                        >
                                            Clear
                                        </Button>
                                        <Button
                                            variant="contained"
                                            size="medium"
                                            startIcon={<Payment />}
                                            sx={{
                                                bgcolor: 'white', color: 'primary.main',
                                                fontWeight: 700,
                                                '&:hover': { bgcolor: 'grey.100' },
                                            }}
                                            onClick={() => setBulkPayDialog(true)}
                                        >
                                            Pay {fmt(totalSelected)} for {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}
                                        </Button>
                                    </Stack>
                                </Paper>
                            )}
                        </Box>
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
                                                            icon={h.is_verified
                                                                ? <CheckCircle sx={{ fontSize: '14px !important' }} />
                                                                : <HourglassEmpty sx={{ fontSize: '14px !important' }} />}
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

            {/* ── Bulk Pay Confirmation Dialog ── */}
            <Dialog open={bulkPayDialog} onClose={() => { if (!bulkPaying) setBulkPayDialog(false); }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Payment color="primary" />
                    Confirm Bulk Exam Fee Payment
                </DialogTitle>
                <DialogContent>
                    {bulkPaying && (
                        <Box sx={{ mb: 2 }}>
                            <LinearProgress variant="determinate" value={bulkProgress} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                Processing payment…
                            </Typography>
                        </Box>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        You are about to pay exam fees for <strong>{selectedRows.length} student{selectedRows.length !== 1 ? 's' : ''}</strong>.
                        Each student will be activated immediately after payment.
                    </Typography>

                    {/* Summary table */}
                    <Paper variant="outlined" sx={{ mb: 2, maxHeight: 280, overflow: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                                    <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Exam Fee</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedRows.map((r, idx) => (
                                    <TableRow key={r.id}>
                                        <TableCell>{idx + 1}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{r.student_name}</Typography>
                                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{r.enrollment_number}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{r.batch_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{r.course_name}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ textAlign: 'right' }}>
                                            <Typography fontWeight={700} color="error.main">{fmt(r.exam_fee)}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Paper>

                    <Divider sx={{ mb: 1.5 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" fontWeight={700}>Total Amount</Typography>
                        <Typography variant="h6" fontWeight={700} color="error.main">{fmt(totalSelected)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        A single Razorpay payment of {fmt(totalSelected)} will be made. Individual payment records will be created for each student.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button
                        onClick={() => setBulkPayDialog(false)}
                        disabled={bulkPaying}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Payment />}
                        disabled={bulkPaying}
                        onClick={triggerBulkRazorpay}
                    >
                        {bulkPaying ? 'Processing…' : `Pay ${fmt(totalSelected)}`}
                    </Button>
                </DialogActions>
            </Dialog>

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
