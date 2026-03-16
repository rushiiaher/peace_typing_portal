'use client';

import { Dashboard, School, Business, MenuBook, Assignment, Payment, People, Assessment } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';

export default function SuperAdminDashboard() {
  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography color="textSecondary">Total Institutes</Typography><Typography variant="h4">0</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography color="textSecondary">Total Students</Typography><Typography variant="h4">0</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography color="textSecondary">Active Courses</Typography><Typography variant="h4">0</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent><Typography color="textSecondary">Pending Payments</Typography><Typography variant="h4">₹0</Typography></CardContent></Card>
        </Grid>
      </Grid>
    </AdminLayout>
  );
}
