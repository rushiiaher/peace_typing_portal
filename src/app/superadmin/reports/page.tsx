'use client';

import { Box, Button, Typography, Grid, Card, CardContent, CardActions } from '@mui/material';
import { Download, Assessment } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

export default function ReportsPage() {
  const reports = [
    { title: 'Institute-wise Revenue', description: 'Revenue breakdown by institute' },
    { title: 'Course Enrollment Analytics', description: 'Student enrollment trends by course' },
    { title: 'Payment Collection Summary', description: 'Overall payment collection status' },
    { title: 'Outstanding Dues', description: 'Pending payments from institutes' },
    { title: 'Exam Statistics', description: 'Exam completion and pass rates' },
    { title: 'Monthly Financial Report', description: 'Comprehensive monthly financial summary' },
  ];

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Typography variant="h5" gutterBottom>Generate Reports</Typography>
      
      <Grid container spacing={3}>
        {reports.map((report, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Assessment sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">{report.title}</Typography>
                </Box>
                <Typography color="textSecondary">{report.description}</Typography>
              </CardContent>
              <CardActions>
                <Button size="small" startIcon={<Download />}>PDF</Button>
                <Button size="small" startIcon={<Download />}>Excel</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </AdminLayout>
  );
}
