'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Tabs, Tab, Box, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, InputAdornment,
  IconButton, Chip, Alert, Snackbar, Paper, Divider, Tooltip,
  CircularProgress, Skeleton, Stack,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import {
  PersonAdd, Search, AdminPanelSettings, Business, Person,
  Refresh, Visibility, VisibilityOff, DeleteOutline, EditOutlined,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  institute_id: string;
  institute_name: string;
  enrollment_number: string;
  batch_name: string;
  is_active: boolean;
  created_at: string;
}

interface Institute {
  id: string;
  name: string;
}

const EMPTY_FORM = { full_name: '', email: '', password: '', phone: '', institute_id: '' };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [students, setStudents] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<UserRow[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<typeof EMPTY_FORM>>({});
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', institute_id: '', new_password: '' });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from our API route which uses the service role key
      const [usersRes, instsRes] = await Promise.all([
        fetch('/api/admin/list-users'),
        fetch('/api/admin/list-institutes'),
      ]);

      if (usersRes.ok) {
        const { users } = await usersRes.json();
        setStudents((users as UserRow[]).filter(u => u.role === 'student'));
        setAdmins((users as UserRow[]).filter(u => u.role === 'institute_admin'));
      } else {
        const j = await usersRes.json();
        showSnackbar(j.error ?? 'Failed to load users.', 'error');
      }

      if (instsRes.ok) {
        const { institutes: insts } = await instsRes.json();
        setInstitutes(insts ?? []);
      }
    } catch (err: any) {
      showSnackbar('Network error loading data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Validate ─────────────────────────────────────────────────────────────

  const validate = () => {
    const errs: Partial<typeof EMPTY_FORM> = {};
    if (!form.full_name.trim()) errs.full_name = 'Name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!form.password) errs.password = 'Password is required.';
    else if (form.password.length < 8) errs.password = 'Minimum 8 characters.';
    if (!form.institute_id) errs.institute_id = 'Select an institute.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Create Institute Admin ───────────────────────────────────────────────

  const handleCreate = async () => {
    if (!validate()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'institute_admin' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to create user.');
      showSnackbar(`Institute Admin "${form.full_name}" created successfully.`, 'success');
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await fetchData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Delete User ─────────────────────────────────────────────────────────

  const handleDeleteUser = async (row: UserRow) => {
    if (!confirm(`Permanently delete "${row.full_name}" (${row.email})?\n\nThis will remove them from authentication AND all database tables. This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Delete failed.');
      showSnackbar(`"${row.full_name}" deleted successfully.`, 'success');
      await fetchData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // ─── Edit User ───────────────────────────────────────────────────────────

  const handleEditUser = (row: UserRow) => {
    setEditingUser(row);
    setEditForm({ full_name: row.full_name, phone: row.phone, institute_id: row.institute_id, new_password: '' });
    setShowEditPassword(false);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    if (!editForm.full_name.trim()) { showSnackbar('Name is required.', 'error'); return; }
    if (editForm.new_password && editForm.new_password.length < 8) {
      showSnackbar('New password must be at least 8 characters.', 'error'); return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          full_name: editForm.full_name,
          phone: editForm.phone,
          institute_id: editForm.institute_id,
          password: editForm.new_password || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Update failed.');
      showSnackbar(`"${editForm.full_name}" updated successfully.`, 'success');
      setEditDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Column Defs ──────────────────────────────────────────────────────────

  const studentCols: GridColDef[] = [
    { field: 'enrollment_number', headerName: 'Enrollment No.', width: 150, valueGetter: (_: any, r: UserRow) => r.enrollment_number || '—' },
    { field: 'full_name', headerName: 'Name', width: 180 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'phone', headerName: 'Phone', width: 130, valueGetter: (_: any, r: UserRow) => r.phone || '—' },
    { field: 'institute_name', headerName: 'Institute', width: 180, valueGetter: (_: any, r: UserRow) => r.institute_name || '—' },
    { field: 'batch_name', headerName: 'Batch', width: 150, valueGetter: (_: any, r: UserRow) => r.batch_name || '—' },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: (p) => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
  ];

  const adminCols: GridColDef[] = [
    { field: 'full_name', headerName: 'Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 230 },
    { field: 'phone', headerName: 'Phone', width: 140, valueGetter: (_: any, r: UserRow) => r.phone || '—' },
    { field: 'institute_name', headerName: 'Institute', width: 220, valueGetter: (_: any, r: UserRow) => r.institute_name || '—' },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: (p) => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'created_at', headerName: 'Created', width: 130,
      valueGetter: (_: any, r: UserRow) => r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 110,
      getActions: (params: GridRowParams<UserRow>) => [
        <GridActionsCellItem
          key="edit"
          icon={<Tooltip title="Edit profile & password"><EditOutlined /></Tooltip>}
          label="Edit"
          onClick={() => handleEditUser(params.row)}
          color="primary"
        />,
        <GridActionsCellItem
          key="delete"
          icon={<Tooltip title="Delete user permanently"><DeleteOutline /></Tooltip>}
          label="Delete"
          onClick={() => handleDeleteUser(params.row)}
          color="error"
        />,
      ],
    },
  ];

  // ─── Filtering ────────────────────────────────────────────────────────────

  const q = searchQuery.toLowerCase();
  const filteredStudents = students.filter(s =>
    [s.full_name, s.email, s.institute_name].join(' ').toLowerCase().includes(q));
  const filteredAdmins = admins.filter(a =>
    [a.full_name, a.email, a.institute_name].join(' ').toLowerCase().includes(q));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">User Management</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <Button variant="outlined" size="small" onClick={fetchData} startIcon={<Refresh />}>Refresh</Button>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<PersonAdd />}
            onClick={() => { setForm(EMPTY_FORM); setFormErrors({}); setShowPassword(false); setDialogOpen(true); }}
          >
            Create Institute Admin
          </Button>
        </Stack>
      </Box>

      {/* Search */}
      <TextField
        size="small" placeholder="Search by name, email, institute…"
        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
        sx={{ mb: 2, width: 380 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
      />

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab icon={<Person fontSize="small" />} iconPosition="start" label={`Students (${students.length})`} />
        <Tab icon={<AdminPanelSettings fontSize="small" />} iconPosition="start" label={`Institute Admins (${admins.length})`} />
      </Tabs>

      {/* Grids */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1 }} />)}
        </Box>
      ) : (
        <>
          {tab === 0 && (
            <Paper variant="outlined">
              <DataGrid rows={filteredStudents} columns={studentCols} autoHeight
                pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                getRowId={r => r.id} />
            </Paper>
          )}
          {tab === 1 && (
            <Paper variant="outlined">
              <DataGrid rows={filteredAdmins} columns={adminCols} autoHeight
                pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                getRowId={r => r.id} />
            </Paper>
          )}
        </>
      )}

      {/* ══ Create Institute Admin Dialog ══ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AdminPanelSettings color="primary" /> Create Institute Admin
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Fixed role badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Role:</Typography>
              <Chip icon={<AdminPanelSettings fontSize="small" />} label="Institute Admin" color="primary" size="small" />
            </Box>

            <TextField label="Full Name *" fullWidth size="small" autoFocus
              value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
              error={!!formErrors.full_name} helperText={formErrors.full_name} />

            <TextField label="Email Address *" type="email" fullWidth size="small"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              error={!!formErrors.email} helperText={formErrors.email} />

            <TextField
              label="Password *" type={showPassword ? 'text' : 'password'} fullWidth size="small"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              error={!!formErrors.password} helperText={formErrors.password ?? 'Minimum 8 characters'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword(s => !s)} edge="end">
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField label="Phone Number" fullWidth size="small" placeholder="Optional"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />

            <TextField select label="Institute *" fullWidth size="small"
              value={form.institute_id} onChange={e => setForm({ ...form, institute_id: e.target.value })}
              error={!!formErrors.institute_id} helperText={formErrors.institute_id ?? 'This admin will manage the selected institute'}
              InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }}
            >
              <MenuItem value=""><em>Select an institute</em></MenuItem>
              {institutes.map(inst => <MenuItem key={inst.id} value={inst.id}>{inst.name}</MenuItem>)}
            </TextField>

            {form.full_name && form.email && form.institute_id && (
              <Alert severity="info" icon={<AdminPanelSettings />}>
                <strong>{form.full_name}</strong> ({form.email}) will be created as Institute Admin for{' '}
                <strong>{institutes.find(i => i.id === form.institute_id)?.name}</strong>.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={isCreating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={isCreating}
            startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}>
            {isCreating ? 'Creating…' : 'Create Institute Admin'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══ Edit Institute Admin Dialog ══ */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EditOutlined color="primary" /> Edit Institute Admin
        </DialogTitle>
        <Divider />

        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {/* Read-only email */}
            <TextField
              label="Email Address"
              fullWidth size="small"
              value={editingUser?.email ?? ''}
              disabled
              helperText="Email cannot be changed"
            />

            <TextField
              label="Full Name *" fullWidth size="small" autoFocus
              value={editForm.full_name}
              onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
            />

            <TextField
              label="Phone Number" fullWidth size="small" placeholder="Optional"
              value={editForm.phone}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
            />

            <TextField
              select label="Institute" fullWidth size="small"
              value={editForm.institute_id}
              onChange={e => setEditForm({ ...editForm, institute_id: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" /></InputAdornment> }}
            >
              <MenuItem value=""><em>Select an institute</em></MenuItem>
              {institutes.map(inst => <MenuItem key={inst.id} value={inst.id}>{inst.name}</MenuItem>)}
            </TextField>

            <Divider><Chip label="Password Reset (optional)" size="small" /></Divider>

            <TextField
              label="New Password"
              type={showEditPassword ? 'text' : 'password'}
              fullWidth size="small"
              value={editForm.new_password}
              onChange={e => setEditForm({ ...editForm, new_password: e.target.value })}
              helperText="Leave blank to keep existing password. Min 8 characters if changing."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowEditPassword(s => !s)} edge="end">
                      {showEditPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

          </Box>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setEditDialogOpen(false)} variant="outlined" disabled={isSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={isSaving}
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <EditOutlined />}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4500}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminLayout>
  );
}
