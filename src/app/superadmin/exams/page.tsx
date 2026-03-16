'use client';

import { useState } from 'react';
import { Box, Button, Typography, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add, Check, Close } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

export default function ExamManagement() {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);

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
        <Box><Button size="small" startIcon={<Check />} color="success">Approve</Button><Button size="small" startIcon={<Close />} color="error">Reject</Button></Box>
      ),
    },
  ];

  const patternColumns: GridColDef[] = [
    { field: 'name', headerName: 'Pattern Name', width: 200 },
    { field: 'course', headerName: 'Course', width: 150 },
    { field: 'totalMarks', headerName: 'Total Marks', width: 120 },
    { field: 'duration', headerName: 'Duration (min)', width: 130 },
  ];

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Exams</Typography>
        {tab === 2 && <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Pattern</Button>}
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Exam Applications" />
        <Tab label="Reschedule Requests" />
        <Tab label="Exam Patterns" />
      </Tabs>

      {tab === 0 && <DataGrid rows={[]} columns={applicationColumns} autoHeight />}
      {tab === 1 && <DataGrid rows={[]} columns={rescheduleColumns} autoHeight />}
      {tab === 2 && <DataGrid rows={[]} columns={patternColumns} autoHeight />}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Exam Pattern</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Course" margin="normal"><MenuItem value="">Select Course</MenuItem></TextField>
          <TextField fullWidth label="Pattern Name" margin="normal" />
          <TextField fullWidth label="Keyboard Lessons Count" type="number" margin="normal" />
          <TextField fullWidth label="Speed Passages Count" type="number" margin="normal" />
          <TextField fullWidth label="Letter Count" type="number" margin="normal" />
          <TextField fullWidth label="MCQ Count" type="number" margin="normal" />
          <TextField fullWidth label="Total Marks" type="number" margin="normal" />
          <TextField fullWidth label="Passing Marks" type="number" margin="normal" />
          <TextField fullWidth label="Duration (minutes)" type="number" margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
