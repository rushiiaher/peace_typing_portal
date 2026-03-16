'use client';

import { Box, Button, Typography, Grid, Card, CardContent, CardActions } from '@mui/material';
import { Download, Assessment } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

export default function ReportsPage() {
  const reports = [
    { title: 'Student Fee Status', description: 'View fee collection status for all students' },
    { title: 'Batch Performance', description: 'Analyze batch-wise student performance' },
    { title: 'Monthly Revenue', description: 'Monthly fee collection summary' },
    { title: 'Outstanding Dues', description: 'Students with pending payments' },
    { title: 'Exam Schedule', description: 'Upcoming and completed exams' },
    { title: 'Payment History', description: 'All payment transactions for this institute' },
  ];

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Reports & Analytics</Typography>
        <Typography variant="body2" color="text.secondary">Generate and export reports for your institute</Typography>
      </Box>

      <Grid container spacing={3}>
        {reports.map((report) => (
          <Grid item xs={12} md={6} key={report.title}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                  <Assessment color="primary" />
                  <Typography variant="h6">{report.title}</Typography>
                </Box>
                <Typography color="text.secondary" variant="body2">{report.description}</Typography>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button size="small" variant="outlined" startIcon={<Download />}>PDF</Button>
                <Button size="small" variant="outlined" startIcon={<Download />}>Excel</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </AdminLayout>
  );
}
