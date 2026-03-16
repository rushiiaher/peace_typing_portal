'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Chip, Tooltip, Paper,
  Snackbar, Alert, Divider, Stack, Skeleton, InputAdornment,
  Drawer, List, ListItem, ListItemText, ListItemAvatar, Avatar,
  ListItemSecondaryAction, IconButton, Badge, CircularProgress,
  Tab, Tabs, InputBase,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import {
  Add, EditOutlined, DeleteOutline, School, Search, Refresh,
  CalendarMonth, PeopleAlt, PersonAdd, PersonRemove, Close, AutoAwesome,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface Batch {
  id: string; batch_name: string; batch_code: string; course_id: string;
  course_name: string; course_code: string; start_date: string;
  end_date: string; is_active: boolean; student_count: number; created_at: string;
}
interface Course { id: string; name: string; code: string; duration_months: number; }
interface Student { id: string; name: string; enrollment_number: string; batch_id?: string | null; }

const EMPTY = { batch_name: '', batch_code: '', course_id: '', start_date: '', end_date: '', is_active: true };

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Auto-generate batch name & code ──────────────────────────────────────────
function generateBatch(
  courses: Course[],
  courseId: string,
  startDate: string,
  existingBatches: Batch[],
): { batch_name: string; batch_code: string } {
  const course = courses.find(c => c.id === courseId);
  if (!course || !startDate) return { batch_name: '', batch_code: '' };

  const date = new Date(startDate);
  const month = date.toLocaleString('en', { month: 'short' }).toUpperCase(); // JAN
  const year = date.getFullYear();                                            // 2025
  const yr2 = String(year).slice(-2);                                        // 25

  // Count existing batches for the same course to determine sequence number
  const seq = existingBatches.filter(b => b.course_id === courseId).length + 1;
  const seqStr = String(seq).padStart(2, '0');                                 // 01

  const courseName = course.name;                                               // Diploma in Computer Applications
  const code = course.code.toUpperCase();                                 // DCA

  const batch_name = `${courseName} – ${month} ${year}`;                       // Diploma in Computer Applications – JAN 2025
  const batch_code = `${code}-${month}${yr2}-${seqStr}`;                       // DCA-JAN25-01

  return { batch_name, batch_code };
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Manage Students drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [studentsTab, setStudentsTab] = useState(0); // 0=enrolled, 1=available
  const [enrolled, setEnrolled] = useState<Student[]>([]);
  const [available, setAvailable] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  // ─── Fetch batches ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bRes, cRes] = await Promise.all([
      fetch('/api/institute/batches'),
      fetch('/api/institute/courses'),
    ]);
    if (bRes.ok) { const j = await bRes.json(); setBatches(j.batches ?? []); }
    if (cRes.ok) { const j = await cRes.json(); setCourses(j.courses ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Fetch students for drawer ────────────────────────────────────────────

  const fetchBatchStudents = useCallback(async (batchId: string) => {
    setStudentsLoading(true);
    const res = await fetch(`/api/institute/batch-students?batch_id=${batchId}`);
    if (res.ok) {
      const j = await res.json();
      setEnrolled(j.enrolled ?? []);
      setAvailable(j.available ?? []);
    }
    setStudentsLoading(false);
  }, []);

  const openStudentsDrawer = (batch: Batch) => {
    setSelectedBatch(batch);
    setStudentsTab(0);
    setStudentSearch('');
    setDrawerOpen(true);
    fetchBatchStudents(batch.id);
  };

  // ─── Assign student to batch ──────────────────────────────────────────────

  const assignStudent = async (studentId: string) => {
    if (!selectedBatch) return;
    setActioningId(studentId);
    try {
      const res = await fetch('/api/institute/batch-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatch.id, student_id: studentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await fetchBatchStudents(selectedBatch.id);
      // Update student_count in local batches list
      setBatches(bs => bs.map(b => b.id === selectedBatch.id
        ? { ...b, student_count: b.student_count + 1 }
        : b));
      setSelectedBatch(b => b ? { ...b, student_count: b.student_count + 1 } : b);
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setActioningId(null); }
  };

  // ─── Remove student from batch ────────────────────────────────────────────

  const removeStudent = async (studentId: string) => {
    if (!selectedBatch) return;
    setActioningId(studentId);
    try {
      const res = await fetch(`/api/institute/batch-students?student_id=${studentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await fetchBatchStudents(selectedBatch.id);
      setBatches(bs => bs.map(b => b.id === selectedBatch.id
        ? { ...b, student_count: Math.max(0, b.student_count - 1) }
        : b));
      setSelectedBatch(b => b ? { ...b, student_count: Math.max(0, b.student_count - 1) } : b);
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setActioningId(null); }
  };

  // ─── Batch CRUD ───────────────────────────────────────────────────────────

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (row: Batch) => {
    setEditingId(row.id);
    setForm({ batch_name: row.batch_name, batch_code: row.batch_code, course_id: row.course_id, start_date: row.start_date?.slice(0, 10) ?? '', end_date: row.end_date?.slice(0, 10) ?? '', is_active: row.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.batch_name || !form.batch_code || !form.course_id || !form.start_date) {
      showSnackbar('Batch name, code, course and start date are required.', 'error'); return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/institute/batches/${editingId}` : '/api/institute/batches';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showSnackbar(editingId ? 'Batch updated.' : 'Batch created.', 'success');
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row: Batch) => {
    if (row.student_count > 0) { showSnackbar(`Cannot delete — ${row.student_count} student(s) are in this batch.`, 'error'); return; }
    if (!confirm(`Delete batch "${row.batch_name}"?`)) return;
    const res = await fetch(`/api/institute/batches/${row.id}`, { method: 'DELETE' });
    if (res.ok) { showSnackbar('Batch deleted.', 'success'); fetchAll(); }
    else { const j = await res.json(); showSnackbar(j.error, 'error'); }
  };

  // ─── Grid ─────────────────────────────────────────────────────────────────

  const cols: GridColDef[] = [
    { field: 'batch_code', headerName: 'Code', width: 110 },
    { field: 'batch_name', headerName: 'Batch Name', width: 190 },
    { field: 'course_name', headerName: 'Course', width: 180 },
    {
      field: 'student_count', headerName: 'Students', width: 100, type: 'number',
      renderCell: p => (
        <Chip size="small" icon={<PeopleAlt sx={{ fontSize: 13 }} />}
          label={p.value} variant="outlined"
          color={p.value > 0 ? 'primary' : 'default'} />
      ),
    },
    {
      field: 'start_date', headerName: 'Start Date', width: 115,
      valueGetter: (_: any, r: Batch) => r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'end_date', headerName: 'End Date', width: 115,
      valueGetter: (_: any, r: Batch) => r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'is_active', headerName: 'Status', width: 95,
      renderCell: p => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 130,
      getActions: (p: GridRowParams<Batch>) => [
        <GridActionsCellItem key="students"
          icon={<Tooltip title="Manage Students">
            <Badge badgeContent={p.row.student_count} color="primary" max={99}>
              <PeopleAlt />
            </Badge>
          </Tooltip>}
          label="Manage Students" onClick={() => openStudentsDrawer(p.row)} color="primary" />,
        <GridActionsCellItem key="edit" icon={<Tooltip title="Edit"><EditOutlined /></Tooltip>} label="Edit" onClick={() => openEdit(p.row)} color="inherit" />,
        <GridActionsCellItem key="del" icon={<Tooltip title="Delete"><DeleteOutline /></Tooltip>} label="Delete" onClick={() => handleDelete(p.row)} color="error" />,
      ],
    },
  ];

  const filtered = batches.filter(b =>
    [b.batch_name, b.batch_code, b.course_name].join(' ').toLowerCase().includes(search.toLowerCase()));

  // Filtered student lists for drawer search
  const filteredEnrolled = enrolled.filter(s =>
    `${s.name} ${s.enrollment_number}`.toLowerCase().includes(studentSearch.toLowerCase()));
  const filteredAvailable = available.filter(s =>
    `${s.name} ${s.enrollment_number}`.toLowerCase().includes(studentSearch.toLowerCase()));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Batch Management</Typography>
          <Typography variant="body2" color="text.secondary">Manage course batches and enrol students</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchAll}>Refresh</Button></Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create Batch</Button>
        </Stack>
      </Box>

      {/* Search */}
      <TextField size="small" placeholder="Search batches…" value={search} onChange={e => setSearch(e.target.value)}
        sx={{ mb: 2, width: 340 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      {/* Grid */}
      {loading
        ? <Stack spacing={1}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
        : <Paper variant="outlined">
          <DataGrid rows={filtered} columns={cols} autoHeight getRowId={r => r.id}
            pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} />
        </Paper>}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <School color="primary" fontSize="small" />
          {editingId ? 'Edit Batch' : 'Create New Batch'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            {/* Auto-generate button — only shown during Create */}
            {!editingId && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: 'primary.50', borderRadius: 2, border: '1px dashed', borderColor: 'primary.200' }}>
                <Box>
                  <Typography variant="body2" fontWeight={700} color="primary.main">Auto Generate Name & Code</Typography>
                  <Typography variant="caption" color="text.secondary">Select a course and start date first, then click generate.</Typography>
                </Box>
                <Button
                  size="small" variant="contained" startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}
                  disabled={!form.course_id || !form.start_date}
                  onClick={() => {
                    const generated = generateBatch(courses, form.course_id, form.start_date, batches);
                    setForm(f => ({ ...f, ...generated }));
                  }}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0, ml: 2 }}
                >
                  Generate
                </Button>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Batch Name *" fullWidth size="small" value={form.batch_name} onChange={e => setForm({ ...form, batch_name: e.target.value })} placeholder="e.g. DCA Batch Jan 2025" />
              <TextField label="Batch Code *" size="small" sx={{ width: 180 }} value={form.batch_code} onChange={e => setForm({ ...form, batch_code: e.target.value.toUpperCase() })} placeholder="e.g. DCA-JAN25-01" inputProps={{ style: { textTransform: 'uppercase' } }} />
            </Box>
            <TextField select label="Course *" fullWidth size="small" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
              <MenuItem value=""><em>Select a course</em></MenuItem>
              {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code}) — {c.duration_months}mo</MenuItem>)}
            </TextField>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Start Date *" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
                value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonth fontSize="small" /></InputAdornment> }} />
              <TextField label="End Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
                value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </Box>
            {editingId && (
              <TextField select label="Status" fullWidth size="small" value={form.is_active ? 'active' : 'inactive'}
                onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Batch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ Manage Students Drawer ══ */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Drawer Header */}
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography fontWeight={700} variant="h6">Manage Students</Typography>
            {selectedBatch && (
              <Typography variant="body2" color="text.secondary">
                {selectedBatch.batch_name} ({selectedBatch.batch_code}) · {selectedBatch.student_count} enrolled
              </Typography>
            )}
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} size="small"><Close /></IconButton>
        </Box>

        {/* Tabs */}
        <Tabs value={studentsTab} onChange={(_, v) => setStudentsTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              Enrolled
              <Chip size="small" label={enrolled.length} color="primary" sx={{ height: 18, fontSize: 11 }} />
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              Add Students
              <Chip size="small" label={available.length} color="default" sx={{ height: 18, fontSize: 11 }} />
            </Box>
          } />
        </Tabs>

        {/* Search bar */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', px: 1.5, borderRadius: 2 }}>
            <Search fontSize="small" sx={{ color: 'text.disabled', mr: 1 }} />
            <InputBase
              fullWidth
              placeholder="Search by name or enrollment no…"
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              sx={{ py: 0.7, fontSize: 14 }}
            />
            {studentSearch && (
              <IconButton size="small" onClick={() => setStudentSearch('')}><Close fontSize="small" /></IconButton>
            )}
          </Paper>
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {studentsLoading
            ? <Stack spacing={1} sx={{ p: 2 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height={56} variant="rectangular" sx={{ borderRadius: 1 }} />)}
            </Stack>
            : studentsTab === 0
              /* ── Enrolled students ── */
              ? filteredEnrolled.length === 0
                ? <Box sx={{ py: 6, textAlign: 'center' }}>
                  <PeopleAlt sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.disabled">{studentSearch ? 'No matches found.' : 'No students enrolled yet.'}</Typography>
                  {!studentSearch && <Typography variant="body2" color="text.disabled">Switch to "Add Students" tab to enrol them.</Typography>}
                </Box>
                : <List disablePadding>
                  {filteredEnrolled.map((s, i) => (
                    <ListItem key={s.id} divider={i < filteredEnrolled.length - 1}
                      sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 13 }}>{initials(s.name)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{s.name}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">{s.enrollment_number}</Typography>}
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Remove from batch">
                          <span>
                            <IconButton size="small" color="error" disabled={actioningId === s.id}
                              onClick={() => removeStudent(s.id)}>
                              {actioningId === s.id ? <CircularProgress size={16} /> : <PersonRemove fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>

              /* ── Available students ── */
              : filteredAvailable.length === 0
                ? <Box sx={{ py: 6, textAlign: 'center' }}>
                  <PeopleAlt sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.disabled">{studentSearch ? 'No matches found.' : 'All students are already enrolled.'}</Typography>
                </Box>
                : <List disablePadding>
                  {filteredAvailable.map((s, i) => (
                    <ListItem key={s.id} divider={i < filteredAvailable.length - 1}
                      sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'grey.300', color: 'text.primary', width: 36, height: 36, fontSize: 13 }}>{initials(s.name)}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{s.name}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {s.enrollment_number}
                            {s.batch_id ? ' · currently in another batch' : ' · unassigned'}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Add to this batch">
                          <span>
                            <IconButton size="small" color="primary" disabled={actioningId === s.id}
                              onClick={() => assignStudent(s.id)}>
                              {actioningId === s.id ? <CircularProgress size={16} /> : <PersonAdd fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
          }
        </Box>

        {/* Drawer footer */}
        <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => setDrawerOpen(false)}>Close</Button>
        </Box>
      </Drawer>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </AdminLayout>
  );
}
