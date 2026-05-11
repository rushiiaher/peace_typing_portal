'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab, Chip, CircularProgress, Alert } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import { format, parseISO } from 'date-fns';

function statusColor(s: string): 'default' | 'primary' | 'warning' | 'success' | 'error' {
  if (s === 'completed') return 'success';
  if (s === 'in_progress') return 'warning';
  if (s === 'cancelled') return 'error';
  return 'primary';
}

export default function ExamManagement() {
  const [tab, setTab] = useState(0);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/exams')
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error);
        setExams(j.exams ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayExams = exams.filter(e => e.examDate === today);

  const applicationColumns: GridColDef[] = [
    { field: 'student', headerName: 'Student', width: 200,
      renderCell: p => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.enrollment}</Typography>
        </Box>
      )
    },
    { field: 'institute', headerName: 'Institute', width: 200 },
    { field: 'course', headerName: 'Course', width: 160 },
    { field: 'examDate', headerName: 'Exam Date', width: 130,
      renderCell: p => p.value && p.value !== '—'
        ? format(parseISO(p.value), 'dd MMM yyyy')
        : '—'
    },
    { field: 'startTime', headerName: 'Time', width: 110,
      renderCell: p => p.value ? format(parseISO(p.value), 'hh:mm a') : '—'
    },
    { field: 'status', headerName: 'Status', width: 130,
      renderCell: p => (
        <Chip label={p.value?.replace('_', ' ').toUpperCase()} color={statusColor(p.value)} size="small" />
      )
    },
    { field: 'attendance', headerName: 'Attendance', width: 120,
      renderCell: p => (
        <Chip
          label={p.value?.toUpperCase()}
          size="small"
          variant="outlined"
          color={p.value === 'present' ? 'success' : p.value === 'absent' ? 'error' : 'default'}
        />
      )
    },
  ];

  const rows = tab === 0 ? exams : todayExams;

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h5">Exams</Typography>
        {!loading && (
          <Typography variant="body2" color="text.secondary">
            {exams.length} total · {todayExams.length} today
          </Typography>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All Exams (${exams.length})`} />
        <Tab label={`Today's Exams (${todayExams.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <DataGrid
          rows={rows}
          columns={applicationColumns}
          autoHeight
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          getRowHeight={() => 56}
          sx={{ border: 'none' }}
        />
      )}
    </AdminLayout>
  );
}
