'use client';

import { useState } from 'react';
import { Box, Button, Typography, Tabs, Tab, IconButton } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Check, Close } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

export default function ExamManagement() {
  const [tab, setTab] = useState(0);

  const applicationColumns: GridColDef[] = [
    { field: 'student', headerName: 'Student', width: 180 },
    { field: 'institute', headerName: 'Institute', width: 180 },
    { field: 'course', headerName: 'Course', width: 150 },
    { field: 'examDate', headerName: 'Exam Date', width: 130 },
    { field: 'status', headerName: 'Status', width: 120 },
  ];

  const rescheduleColumns: GridColDef[] = [
    { field: 'student', headerName: 'Student', width: 180 },
    { field: 'oldDate', headerName: 'Old Date', width: 120 },
    { field: 'newDate', headerName: 'New Date', width: 120 },
    { field: 'reason', headerName: 'Reason', width: 250 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: () => (
        <Box>
          <Button size="small" startIcon={<Check />} color="success">Approve</Button>
          <Button size="small" startIcon={<Close />} color="error">Reject</Button>
        </Box>
      ),
    },
  ];

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Exams</Typography>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Exam Applications" />
        <Tab label="Reschedule Requests" />
      </Tabs>

      {tab === 0 && <DataGrid rows={[]} columns={applicationColumns} autoHeight />}
      {tab === 1 && <DataGrid rows={[]} columns={rescheduleColumns} autoHeight />}
    </AdminLayout>
  );
}
