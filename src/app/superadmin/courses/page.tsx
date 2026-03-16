'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Divider, Chip, Paper,
  Snackbar, Alert, Stack, Skeleton, Tooltip, InputAdornment, Grid,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import { Add, EditOutlined, DeleteOutline, School, Search, Refresh } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  language_id: string;
  language_name: string;
  name: string;
  code: string;
  description: string;
  duration_months: number;
  base_course_fee: number;
  exam_fee: number;
  delivery_fee: number;
  passing_criteria_wpm: number;
  is_active: boolean;
  created_at: string;
}
interface Language { id: string; name: string; code: string; }

const EMPTY = {
  language_id: '', name: '', code: '', description: '',
  duration_months: '', base_course_fee: '', exam_fee: '',
  delivery_fee: '', passing_criteria_wpm: '', is_active: true,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, lRes] = await Promise.all([
      fetch('/api/admin/courses'),
      fetch('/api/admin/languages'),
    ]);
    if (cRes.ok) { const j = await cRes.json(); setCourses(j.courses ?? []); }
    if (lRes.ok) { const j = await lRes.json(); setLanguages(j.languages ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Dialog open ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: Course) => {
    setEditingId(row.id);
    setForm({
      language_id: row.language_id,
      name: row.name,
      code: row.code,
      description: row.description ?? '',
      duration_months: String(row.duration_months),
      base_course_fee: String(row.base_course_fee),
      exam_fee: String(row.exam_fee),
      delivery_fee: String(row.delivery_fee),
      passing_criteria_wpm: String(row.passing_criteria_wpm),
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const { language_id, name, code, duration_months, base_course_fee, exam_fee, delivery_fee, passing_criteria_wpm } = form;
    if (!language_id || !name || !code || !duration_months || !base_course_fee || !exam_fee || !delivery_fee || !passing_criteria_wpm) {
      showSnackbar('Please fill in all required fields.', 'error');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/admin/courses/${editingId}` : '/api/admin/courses';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed.');
      showSnackbar(editingId ? `Course "${form.name}" updated.` : `Course "${form.name}" created.`, 'success');
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      showSnackbar(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (row: Course) => {
    if (!confirm(`Delete course "${row.name}"?\n\nThis may fail if batches are using this course.`)) return;
    const res = await fetch(`/api/admin/courses/${row.id}`, { method: 'DELETE' });
    if (res.ok) { showSnackbar('Course deleted.', 'success'); fetchAll(); }
    else { const j = await res.json(); showSnackbar(j.error, 'error'); }
  };

  // ─── Columns ──────────────────────────────────────────────────────────────

  const cols: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Course Name', width: 220 },
    { field: 'language_name', headerName: 'Language', width: 130 },
    { field: 'duration_months', headerName: 'Duration', width: 100, valueGetter: (_: any, r: Course) => `${r.duration_months} mo` },
    { field: 'base_course_fee', headerName: 'Base Fee', width: 110, valueGetter: (_: any, r: Course) => `₹${r.base_course_fee}` },
    { field: 'exam_fee', headerName: 'Exam Fee', width: 100, valueGetter: (_: any, r: Course) => `₹${r.exam_fee}` },
    { field: 'passing_criteria_wpm', headerName: 'Pass WPM', width: 100, valueGetter: (_: any, r: Course) => `${r.passing_criteria_wpm} wpm` },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: p => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 90,
      getActions: (p: GridRowParams<Course>) => [
        <GridActionsCellItem key="edit" icon={<Tooltip title="Edit course"><EditOutlined /></Tooltip>} label="Edit" onClick={() => openEdit(p.row)} color="primary" />,
        <GridActionsCellItem key="del" icon={<Tooltip title="Delete course"><DeleteOutline /></Tooltip>} label="Delete" onClick={() => handleDelete(p.row)} color="error" />,
      ],
    },
  ];

  const filtered = courses.filter(c =>
    [c.name, c.code, c.language_name].join(' ').toLowerCase().includes(search.toLowerCase()));

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const f = (field: keyof typeof form) => ({
    value: form[field] as string,
    size: 'small' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value }),
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Course Management</Typography>
          <Typography variant="body2" color="text.secondary">Define typing courses, fees, and WPM requirements</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchAll}>Refresh</Button>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Course</Button>
        </Stack>
      </Box>

      {/* Search */}
      <TextField size="small" placeholder="Search by name, code, language…" value={search}
        onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      {/* Grid */}
      {loading
        ? <Stack spacing={1}>{[...Array(5)].map((_, i) => <Skeleton key={i} height={52} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
        : <Paper variant="outlined">
          <DataGrid rows={filtered} columns={cols} autoHeight getRowId={r => r.id}
            pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} />
        </Paper>}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <School color="primary" fontSize="small" />
          {editingId ? 'Edit Course' : 'Add New Course'}
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={3}>

            {/* Basic Info */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>BASIC INFORMATION</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Language *" fullWidth {...f('language_id')}>
                    <MenuItem value=""><em>Select language</em></MenuItem>
                    {languages.map(l => <MenuItem key={l.id} value={l.id}>{l.name} ({l.code})</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Course Name *" fullWidth {...f('name')} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Course Code *" fullWidth {...f('code')} helperText="e.g. HIN-TYP-01" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Duration (months) *" type="number" fullWidth {...f('duration_months')} />
                </Grid>
                <Grid item xs={12} sm={4}>
                  {editingId && (
                    <TextField select label="Status" fullWidth size="small"
                      value={form.is_active ? 'active' : 'inactive'}
                      onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })}>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </TextField>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Description" multiline rows={2} fullWidth {...f('description')} />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Fee Structure */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>FEE STRUCTURE</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField label="Base Course Fee (₹) *" type="number" fullWidth {...f('base_course_fee')}
                    helperText="Institute can adjust" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Exam Fee (₹) *" type="number" fullWidth {...f('exam_fee')}
                    helperText="Fixed per student" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField label="Delivery Fee (₹) *" type="number" fullWidth {...f('delivery_fee')}
                    helperText="One-time per batch" />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* WPM */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>WPM REQUIREMENTS</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField label="Passing Criteria WPM *" type="number" fullWidth {...f('passing_criteria_wpm')}
                    helperText="Minimum WPM to pass exam" />
                </Grid>
              </Grid>
            </Box>

          </Stack>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={<School />}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Course'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
