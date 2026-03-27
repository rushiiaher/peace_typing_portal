'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, Tooltip, Paper, Snackbar, Alert, Divider, Stack,
  Skeleton, InputAdornment, Card, CardContent, Grid, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, LinearProgress,
} from '@mui/material';
import { Payment, Search, Refresh, CheckCircle, HourglassEmpty, Warning, Print, Receipt } from '@mui/icons-material';
import { generateFeeReceiptHtml, ReceiptData } from '../../../utils/generateFeeReceiptHtml';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface StudentFeeRow {
  id: string; enrollment_number: string; name: string; email: string;
  batch_name: string; course_name: string;
  institute_course_fee: number; exam_fee: number; total_due: number;
  total_paid: number; balance: number;
  fee_status: 'paid' | 'partial' | 'pending';
  is_active: boolean;
  batch_id: string;
  latest_receipt: string;
  payment_count: number;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const STATUS_COLOR = { paid: 'success', partial: 'warning', pending: 'error' } as const;
const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', pending: 'Pending' };

/** Unique receipt number: RCP-YYYYMMDD-HHMMSS-XXXX */
function genReceiptNo() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${date}-${time}-${rand}`;
}

export default function FeeCollectionPage() {
  const [students, setStudents] = useState<StudentFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Collect fee dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<StudentFeeRow | null>(null);
  const [form, setForm] = useState({
    amount_collected: '',
    payment_mode: 'cash',
    receipt_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (msg: string, sev: 'success' | 'error') =>
    setSnackbar({ open: true, message: msg, severity: sev });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/institute/fee-collection');
    if (res.ok) { const j = await res.json(); setStudents(j.students ?? []); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const openDialog = (row: StudentFeeRow) => {
    setSelected(row);
    setForm({
      amount_collected: String(Math.max(row.balance, 0)),
      payment_mode: 'cash', receipt_number: genReceiptNo(), notes: '',
    });
    setDialogOpen(true);
  };

  /* ── Print receipt for a student ── */
  const printReceipt = async (studentId: string) => {
    try {
      const res = await fetch(`/api/institute/fee-collection/receipt?student_id=${studentId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch receipt data');
      const r = j.receipt;
      if (!r.payments?.length) { showSnackbar('No payments recorded yet for this student.', 'error'); return; }
      // Build receipt for the latest payment
      const latestPayment = r.payments[r.payments.length - 1];
      const receiptData: ReceiptData = {
        receiptNo: latestPayment.receiptNo || genReceiptNo(),
        receiptDate: latestPayment.date,
        studentName: r.studentName,
        rollNo: r.rollNo,
        courseName: r.courseName,
        courseCode: r.courseCode,
        batchName: r.batchName,
        admissionMonth: r.admissionMonth,
        courseDuration: r.courseDuration,
        paymentMode: latestPayment.paymentMode,
        paymentDate: latestPayment.date,
        currentAmount: latestPayment.amount,
        installments: r.payments.map((p: any) => ({ label: p.label, amount: p.amount })),
        totalFee: r.totalFee,
        totalPaid: r.totalPaid,
        balance: r.balance,
        instituteName: r.instituteName,
        instituteAddress: r.instituteAddress,
        institutePhone: r.institutePhone,
        instituteEmail: r.instituteEmail,
      };
      const html = generateFeeReceiptHtml(receiptData);
      const win = window.open('', '_blank');
      if (!win) { alert('Pop-up blocked! Please allow pop-ups.'); return; }
      win.document.write(html);
      win.document.close();
    } catch (e: any) {
      showSnackbar('Receipt error: ' + e.message, 'error');
    }
  };

  const handleCollect = async () => {
    if (!selected) return;
    const amount = Number(form.amount_collected);
    if (!amount || amount <= 0) { showSnackbar('Enter a valid amount to collect.', 'error'); return; }
    if (amount > selected.balance + 0.01) { showSnackbar(`Amount exceeds balance of ${fmt(selected.balance)}.`, 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/institute/fee-collection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selected.id,
          batch_id: selected.batch_id,
          course_fee_collected: amount,
          exam_fee_collected: 0,
          payment_mode: form.payment_mode,
          receipt_number: form.receipt_number,
          notes: form.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showSnackbar(`${ordinal(selected.payment_count + 1)} installment collected from ${selected.name}.`, 'success');
      setDialogOpen(false); fetchStudents();
      // Auto-print receipt after successful collection
      setTimeout(() => printReceipt(selected.id), 500);
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const filtered = students.filter(s =>
    [s.name, s.email, s.enrollment_number, s.batch_name, s.course_name]
      .join(' ').toLowerCase().includes(search.toLowerCase()));

  // Summary stats
  const totalCollected = students.reduce((s, r) => s + r.total_paid, 0);
  const totalPending = students.reduce((s, r) => s + Math.max(r.balance, 0), 0);
  const paidCount = students.filter(s => s.fee_status === 'paid').length;

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Fee Collection</Typography>
          <Typography variant="body2" color="text.secondary">
            Collect course + exam fees from students
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchStudents}>Refresh</Button>
        </Tooltip>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Collected', value: fmt(totalCollected), icon: <CheckCircle />, color: 'success.main' },
          { label: 'Total Pending', value: fmt(totalPending), icon: <HourglassEmpty />, color: 'error.main' },
          { label: 'Fully Paid Students', value: `${paidCount} / ${students.length}`, icon: <Payment />, color: 'primary.main' },
        ].map(s => (
          <Grid item xs={12} md={4} key={s.label}>
            <Card variant="outlined">
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ color: s.color, display: 'flex' }}>{s.icon}</Box>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                </Box>
                <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Search */}
      <TextField size="small" placeholder="Search by name, roll no, batch…"
        value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      {/* Table */}
      {loading
        ? <Stack spacing={1}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={56} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
        : <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Roll No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Course / Batch</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Course Fee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Exam Fee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Total Due</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Collected</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0
                  ? <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>No students found.</TableCell></TableRow>
                  : filtered.map(row => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">{row.enrollment_number}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.course_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.batch_name}</Typography>
                      </TableCell>
                      <TableCell>{fmt(row.institute_course_fee)}</TableCell>
                      <TableCell>{fmt(row.exam_fee)}</TableCell>
                      <TableCell><Typography fontWeight={700}>{fmt(row.total_due)}</Typography></TableCell>
                      <TableCell>
                        <Typography fontWeight={600} color="success.main">{fmt(row.total_paid)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600} color={row.balance > 0 ? 'error.main' : 'text.secondary'}>
                          {row.balance > 0 ? fmt(row.balance) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={STATUS_LABEL[row.fee_status]}
                          color={STATUS_COLOR[row.fee_status]}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {row.fee_status !== 'paid' && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<Payment />}
                              onClick={() => openDialog(row)}
                            >
                              Collect
                            </Button>
                          )}
                          {row.payment_count > 0 && (
                            <Tooltip title="Print Fee Receipt">
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<Print />}
                                onClick={() => printReceipt(row.id)}
                                sx={{ minWidth: 0 }}
                              >
                                Receipt
                              </Button>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>}

      {/* ════ Collect Fee Dialog ════ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Payment color="primary" /> Collect Fee
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          {selected && (
            <Stack spacing={2.5}>
              {/* Fee summary */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Student</Typography>
                    <Typography fontWeight={600}>{selected.name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Roll No</Typography>
                    <Typography fontWeight={600}>{selected.enrollment_number}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Course</Typography>
                    <Typography variant="body2">{selected.course_name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Batch</Typography>
                    <Typography variant="body2">{selected.batch_name}</Typography>
                  </Grid>
                </Grid>

                {/* Fee breakdown row */}
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={1}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Total Fee</Typography>
                    <Typography fontWeight={700}>{fmt(selected.total_due)}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      Course {fmt(selected.institute_course_fee)} + Exam {fmt(selected.exam_fee)}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Collected</Typography>
                    <Typography fontWeight={700} color="success.main">{fmt(selected.total_paid)}</Typography>
                    {selected.payment_count > 0 && (
                      <Typography variant="caption" color="text.disabled">{selected.payment_count} payment{selected.payment_count > 1 ? 's' : ''}</Typography>
                    )}
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">Balance</Typography>
                    <Typography fontWeight={700} color={selected.balance > 0 ? 'error.main' : 'text.secondary'}>
                      {selected.balance > 0 ? fmt(selected.balance) : '—'}
                    </Typography>
                  </Grid>
                </Grid>

                {selected.total_paid > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((selected.total_paid / selected.total_due) * 100, 100)}
                      color="success"
                      sx={{ borderRadius: 1, height: 6 }}
                    />
                  </Box>
                )}
              </Paper>

              {/* Installment field */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Chip
                    label={`${ordinal(selected.payment_count + 1)} Installment`}
                    color="primary" size="small"
                    sx={{ fontWeight: 700, fontSize: 12 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Balance remaining: {fmt(Math.max(selected.balance, 0))}
                  </Typography>
                </Box>
                <TextField
                  label="Amount to Collect (₹)" type="number" size="small" fullWidth
                  value={form.amount_collected}
                  onChange={e => setForm({ ...form, amount_collected: e.target.value })}
                  helperText={`Max collectible: ${fmt(Math.max(selected.balance, 0))}`}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Box>

              <TextField select label="Payment Mode" size="small" fullWidth
                value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                {['cash', 'online', 'upi', 'cheque', 'neft'].map(m =>
                  <MenuItem key={m} value={m}>{m.toUpperCase()}</MenuItem>)}
              </TextField>

              <TextField label="Receipt / Reference Number" size="small" fullWidth
                value={form.receipt_number} onChange={e => setForm({ ...form, receipt_number: e.target.value })} />

              <TextField label="Notes (optional)" size="small" fullWidth multiline rows={2}
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

              {/* Total preview */}
              {Number(form.amount_collected) > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'primary.50' }}>
                  <Typography variant="body2" color="primary.dark" fontWeight={700}>
                    Collecting now: {fmt(Number(form.amount_collected))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Remaining after this: {fmt(Math.max(selected.balance - Number(form.amount_collected), 0))}
                  </Typography>
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCollect} disabled={saving} startIcon={<Payment />}>
            {saving ? 'Saving…' : 'Collect Fee'}
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
