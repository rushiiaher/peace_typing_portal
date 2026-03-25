'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Switch, FormControlLabel, Alert, Snackbar, Stack, Chip, Paper, Tooltip, Divider,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import { Add, EditOutlined, DeleteOutline, Refresh } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import { createClient } from '../../../utils/supabase/client';

interface Institute {
  id: string;
  code: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  is_active: boolean;
  created_at: string;
}

const EMPTY = {
  name: '', code: '', contact_person: '', phone: '', email: '',
  address: '', city: '', state: '', pincode: '', is_active: true,
};

export default function InstituteManagement() {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const supabase = createClient();

  const fetchInstitutes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('institutes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setInstitutes(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInstitutes(); }, [fetchInstitutes]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };

  const openEdit = (row: Institute) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code,
      contact_person: row.contact_person ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      city: row.city ?? '',
      state: row.state ?? '',
      pincode: row.pincode ?? '',
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      showSnackbar('Institute Name and Code are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/institutes/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Update failed.');
        showSnackbar(`Institute "${form.name}" updated.`, 'success');
      } else {
        const { error } = await supabase.from('institutes').insert([{
          name: form.name,
          code: form.code,
          contact_person: form.contact_person,
          phone: form.phone,
          email: form.email,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          is_active: form.is_active,
        }]);
        if (error) throw error;
        showSnackbar(`Institute "${form.name}" created.`, 'success');
      }
      setDialogOpen(false);
      fetchInstitutes();
    } catch (e: any) {
      showSnackbar(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: Institute) => {
    if (!confirm(`Delete institute "${row.name}"?\n\nThis cannot be undone.`)) return;
    const res = await fetch(`/api/admin/institutes/${row.id}`, { method: 'DELETE' });
    if (res.ok) { showSnackbar('Institute deleted.', 'success'); fetchInstitutes(); }
    else { const j = await res.json(); showSnackbar(j.error, 'error'); }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 110 },
    { field: 'name', headerName: 'Institute Name', width: 210 },
    { field: 'contact_person', headerName: 'Contact Person', width: 180 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'email', headerName: 'Email', width: 210 },
    { field: 'city', headerName: 'City', width: 120 },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: p => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 90,
      getActions: (p: GridRowParams<Institute>) => [
        <GridActionsCellItem key="edit" icon={<Tooltip title="Edit institute"><EditOutlined /></Tooltip>} label="Edit" onClick={() => openEdit(p.row)} color="primary" />,
        <GridActionsCellItem key="del" icon={<Tooltip title="Delete institute"><DeleteOutline /></Tooltip>} label="Delete" onClick={() => handleDelete(p.row)} color="error" />,
      ],
    },
  ];

  const f = (field: keyof typeof form) => ({
    value: form[field] as string,
    size: 'small' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value }),
  });

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Institutes</Typography>
          <Typography variant="body2" color="text.secondary">Manage registered institutes</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchInstitutes}>Refresh</Button>
          </Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Institute</Button>
        </Stack>
      </Box>

      <Paper variant="outlined">
        <DataGrid rows={institutes} columns={columns} autoHeight loading={loading} getRowId={r => r.id}
          pageSizeOptions={[10, 25, 100]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }} />
      </Paper>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth disableEnforceFocus>
        <DialogTitle>{editingId ? 'Edit Institute' : 'Add New Institute'}</DialogTitle>
        <Divider />
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Institute Name *" fullWidth {...f('name')} />
            <TextField label="Institute Code *" fullWidth {...f('code')} />
            <TextField label="Contact Person" fullWidth {...f('contact_person')} />
            <TextField label="Phone" fullWidth {...f('phone')} />
            <TextField label="Email" type="email" sx={{ gridColumn: '1 / -1' }} fullWidth {...f('email')} />
            <TextField label="Address" sx={{ gridColumn: '1 / -1' }} fullWidth {...f('address')} />
            <TextField label="City" fullWidth {...f('city')} />
            <TextField label="State" fullWidth {...f('state')} />
            <TextField label="Pincode" fullWidth {...f('pincode')} />
            <FormControlLabel
              control={<Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />}
              label="Active"
            />
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Institute'}
          </Button>
        </DialogActions>
      </Dialog>

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
