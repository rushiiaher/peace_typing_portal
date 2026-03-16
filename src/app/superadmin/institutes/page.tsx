'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel, Alert, Snackbar } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import { createClient } from '../../../utils/supabase/client';

export default function InstituteManagement() {
  const [open, setOpen] = useState(false);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({
    name: '', code: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', isActive: true
  });

  const supabase = createClient();

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Code', width: 100 },
    { field: 'name', headerName: 'Institute Name', width: 200 },
    { field: 'contact_person', headerName: 'Contact Person', width: 180 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'city', headerName: 'City', width: 130 },
    { field: 'is_active', headerName: 'Status', width: 100, renderCell: (params) => params.value ? 'Active' : 'Inactive' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('institutes')
        .insert([{
          name: formData.name,
          code: formData.code,
          contact_person: formData.contactPerson,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          is_active: formData.isActive
        }])
        .select();

      if (error) throw error;

      setSnackbar({ open: true, message: 'Institute added successfully!', severity: 'success' });
      setOpen(false);
      setFormData({ name: '', code: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', isActive: true });
      fetchInstitutes();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Failed to add institute', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstitutes = async () => {
    const { data, error } = await supabase
      .from('institutes')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setInstitutes(data);
  };

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Institutes</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Institute</Button>
      </Box>

      <DataGrid rows={institutes} columns={columns} autoHeight />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth disableEnforceFocus>
        <DialogTitle>Add New Institute</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="Institute Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <TextField label="Institute Code *" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
            <TextField label="Contact Person" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
            <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            <TextField label="Email *" type="email" sx={{ gridColumn: '1 / -1' }} value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            <TextField label="Address" sx={{ gridColumn: '1 / -1' }} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            <TextField label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            <TextField label="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
            <TextField label="Pincode" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
            <FormControlLabel control={<Switch checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />} label="Active" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </AdminLayout>
  );
}
