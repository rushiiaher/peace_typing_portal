'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, Paper, Stack, Skeleton, Alert,
  TextField, MenuItem, InputAdornment, Card, CardContent,
  Grid, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, Tooltip, Button, Snackbar, IconButton, Divider,
} from '@mui/material';
import {
  Search, AccountBalance, CheckCircle, HourglassEmpty,
  Refresh, FilterList, TrendingUp, Person, Group,
  VerifiedUser, Payments,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

interface Payment {
  id: string;
  payment_type: 'exam_fee' | 'delivery_charge';
  amount: number;
  payment_mode: string;
  payment_reference: string | null;
  is_verified: boolean;
  paid_at: string | null;
  notes: string | null;
  institute_id: string;
  institute_name: string;
  institute_code: string;
  student_id: string | null;
  student_name: string | null;
  student_enrollment: string | null;
  batch_id: string | null;
  batch_name: string | null;
  batch_code: string | null;
  course_id: string | null;
  course_name: string | null;
}

interface Stats {
  totalReceived: number;
  totalVerified: number;
  totalPending: number;
  thisMonth: number;
}

interface FilterOptions {
  institutes: { id: string; name: string; code: string }[];
  courses: { id: string; name: string }[];
  batches: { id: string; batch_name: string; batch_code: string }[];
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export default function SuperAdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>({ totalReceived: 0, totalVerified: 0, totalPending: 0, thisMonth: 0 });
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({ institutes: [], courses: [], batches: [] });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterInstitute, setFilterInstitute] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterBatch, setFilterBatch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' });
  const showSnackbar = (msg: string, sev: 'success' | 'error') => setSnackbar({ open: true, msg, sev });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPayments(json.payments ?? []);
      setStats(json.stats ?? {});
      setFilterOpts(json.filters ?? { institutes: [], courses: [], batches: [] });
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);


  const filtered = useMemo(() => {
    return payments.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || p.institute_name?.toLowerCase().includes(q)
        || p.student_name?.toLowerCase().includes(q)
        || p.student_enrollment?.toLowerCase().includes(q)
        || p.batch_name?.toLowerCase().includes(q)
        || p.payment_reference?.toLowerCase().includes(q)
        || false;
      const matchInstitute = !filterInstitute || p.institute_id === filterInstitute;
      const matchCourse = !filterCourse || p.course_id === filterCourse;
      const matchBatch = !filterBatch || p.batch_id === filterBatch;
      const matchType = !filterType || p.payment_type === filterType;
      const matchStatus = !filterStatus
        || (filterStatus === 'verified' && p.is_verified)
        || (filterStatus === 'pending' && !p.is_verified);
      return matchSearch && matchInstitute && matchCourse && matchBatch && matchType && matchStatus;
    });
  }, [payments, search, filterInstitute, filterCourse, filterBatch, filterType, filterStatus]);

  const clearFilters = () => {
    setSearch(''); setFilterInstitute(''); setFilterCourse('');
    setFilterBatch(''); setFilterType(''); setFilterStatus('');
  };

  const hasActiveFilters = search || filterInstitute || filterCourse || filterBatch || filterType || filterStatus;

  const statCards = [
    { label: 'Total Received', value: fmt(stats.totalReceived), icon: <AccountBalance />, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Verified', value: fmt(stats.totalVerified), icon: <VerifiedUser />, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Awaiting Verification', value: fmt(stats.totalPending), icon: <HourglassEmpty />, color: '#d97706', bg: '#fffbeb' },
    { label: 'This Month', value: fmt(stats.thisMonth), icon: <TrendingUp />, color: '#7c3aed', bg: '#f5f3ff' },
  ];

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      {/* ─── Page Header ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
            <Payments sx={{ color: 'primary.main', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={900}>Payments Received</Typography>
          </Stack>
          <Typography color="text.secondary">
            All exam fee & delivery charge payments made by institute admins
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchAll} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {/* ─── Stats Cards ─────────────────────────────────────────────── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-3px)' } }}>
              <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: 2, bgcolor: s.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
                  color: s.color
                }}>
                  {s.icon}
                </Box>
                {loading
                  ? <Skeleton width={80} height={36} />
                  : <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                }
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterList fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography fontWeight={700} variant="body2">Filters</Typography>
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} sx={{ ml: 'auto', fontSize: 12 }}>
              Clear All
            </Button>
          )}
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth size="small"
              placeholder="Search by institute, student, ref..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Institute" value={filterInstitute} onChange={e => setFilterInstitute(e.target.value)}>
              <MenuItem value=""><em>All Institutes</em></MenuItem>
              {filterOpts.institutes.map(i => (
                <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Course" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <MenuItem value=""><em>All Courses</em></MenuItem>
              {filterOpts.courses.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField select fullWidth size="small" label="Batch" value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
              <MenuItem value=""><em>All Batches</em></MenuItem>
              {filterOpts.batches.map(b => (
                <MenuItem key={b.id} value={b.id}>{b.batch_name} {b.batch_code ? `(${b.batch_code})` : ''}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={1}>
            <TextField select fullWidth size="small" label="Type" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <MenuItem value=""><em>All</em></MenuItem>
              <MenuItem value="exam_fee">Exam Fee</MenuItem>
              <MenuItem value="delivery_charge">Delivery</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} md={1}>
            <TextField select fullWidth size="small" label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <MenuItem value=""><em>All</em></MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* ─── Payments Table ───────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography fontWeight={700}>
              {loading ? 'Loading...' : `${filtered.length} Payment${filtered.length !== 1 ? 's' : ''}`}
            </Typography>
            {hasActiveFilters && (
              <Chip
                size="small"
                label={`${filtered.length} of ${payments.length} shown`}
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>

        {loading
          ? <Stack spacing={0} sx={{ px: 0 }}>
            {[...Array(6)].map((_, i) => (
              <Box key={i} sx={{ px: 3, py: 2, borderBottom: '1px solid #f1f5f9' }}>
                <Skeleton height={24} />
              </Box>
            ))}
          </Stack>
          : filtered.length === 0
            ? <Box sx={{ py: 10, textAlign: 'center' }}>
              <Payments sx={{ fontSize: 56, color: '#94a3b8', mb: 2 }} />
              <Typography variant="h6" fontWeight={700} color="text.primary">No payments found</Typography>
              <Typography color="text.secondary">
                {hasActiveFilters ? 'Try adjusting your filters.' : 'No payments have been submitted yet.'}
              </Typography>
            </Box>
            : <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>Institute</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>For (Student / Batch)</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>Course</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', color: '#64748b' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow
                      key={p.id}
                      hover
                      sx={{ '&:hover': { bgcolor: '#fafafa' }, bgcolor: p.is_verified ? 'transparent' : '#fffbeb' }}
                    >
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {p.paid_at
                            ? new Date(p.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="primary.main">{p.institute_name}</Typography>
                        {p.institute_code && (
                          <Typography variant="caption" color="text.secondary">{p.institute_code}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={p.payment_type === 'exam_fee' ? <Person sx={{ fontSize: '13px !important' }} /> : <Group sx={{ fontSize: '13px !important' }} />}
                          label={p.payment_type === 'exam_fee' ? 'Exam Fee' : 'Delivery'}
                          color={p.payment_type === 'exam_fee' ? 'error' : 'warning'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {p.student_name
                          ? <>
                            <Typography variant="body2" fontWeight={600}>{p.student_name}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">{p.student_enrollment}</Typography>
                          </>
                          : <>
                            <Typography variant="body2" fontWeight={600}>{p.batch_name ?? '—'}</Typography>
                            {p.batch_code && <Typography variant="caption" color="text.secondary">{p.batch_code}</Typography>}
                          </>
                        }
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.course_name ?? '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={800} color={p.is_verified ? 'success.dark' : 'text.primary'}>
                          {fmt(p.amount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
        }
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.sev} variant="filled" onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </AdminLayout>
  );
}
