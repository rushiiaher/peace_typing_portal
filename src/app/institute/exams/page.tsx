'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Tabs, Tab, Divider,
  Stack, Checkbox, ListItemText, FormControl, Alert, CircularProgress,
  Tooltip, IconButton, Card, CardContent, Grid, Chip, Paper, Avatar,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  Add, Schedule, CheckCircle, Cancel, Print, Computer, Info,
  Event, AccessTime, HowToReg, PersonOff, Refresh,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';
import { format, parseISO } from 'date-fns';
import { generateAdmitCardHtml } from '../../../utils/generateAdmitCardHtml';

interface ExamRow {
  id: string; student_name: string; enrollment: string;
  course_name: string; exam_date: string;
  start_time: string; status: string; attendance: string;
  system_name: string; center_code: string;
}
interface Batch { id: string; batch_name: string; batch_code: string; course_id: string; course_name?: string; }
interface Student { id: string; name: string; enrollment_number: string; has_photo: boolean; exam_fee_paid: boolean; is_eligible: boolean; already_scheduled: boolean; }
interface SystemItem { id: string; system_name: string; }

export default function ExamsPage() {
  const [tab, setTab] = useState(0);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [systems, setSystems] = useState<SystemItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stuLoading, setStuLoading] = useState(false);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');

  const uniqueCourses = Array.from(
    new Map(batches.map(b => [b.course_id, { id: b.course_id, name: b.course_name }])).values()
  );
  const filteredBatches = selectedCourse ? batches.filter(b => b.course_id === selectedCourse) : [];

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/institute/exams');
    if (res.ok) setExams((await res.json()).exams ?? []);
    setLoading(false);
  }, []);

  const fetchBasics = async () => {
    const [bRes, sRes] = await Promise.all([
      fetch('/api/institute/batches'),
      fetch('/api/institute/systems'),
    ]);
    if (bRes.ok) setBatches((await bRes.json()).batches ?? []);
    if (sRes.ok) setSystems((await sRes.json()).systems ?? []);
  };

  useEffect(() => { fetchExams(); fetchBasics(); }, [fetchExams]);

  useEffect(() => {
    if (!selectedBatch) { setStudents([]); return; }
    const batch = batches.find(b => b.id === selectedBatch);
    if (!batch) return;
    setStuLoading(true);
    fetch(`/api/institute/exams/eligible-students?batchId=${batch.id}&courseId=${batch.course_id}`)
      .then(r => r.json())
      .then(j => setStudents(j.students || []))
      .finally(() => setStuLoading(false));
  }, [selectedBatch, batches]);

  const handleSchedule = async () => {
    setScheduleError('');
    const batch = batches.find(b => b.id === selectedBatch);
    if (!selectedBatch || !examDate || !startTime || selectedStudents.length === 0) {
      setScheduleError('Please complete all fields and select at least one student.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/institute/exams/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: batch?.course_id,
          batchId: selectedBatch,
          examDate,
          startTime,
          studentIds: selectedStudents,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to schedule');
      setScheduleSuccess(j.message || `Scheduled ${selectedStudents.length} exams.`);
      setOpen(false);
      fetchExams();
      setSelectedCourse(''); setSelectedBatch('');
      setSelectedStudents([]); setScheduleError('');
    } catch (e: any) {
      setScheduleError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const markAttendance = async (id: string, status: 'present' | 'absent') => {
    const res = await fetch('/api/institute/exams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, attendance_status: status }),
    });
    if (res.ok) fetchExams();
  };

  const printAdmitCard = async (examId: string) => {
    try {
      const res = await fetch(`/api/institute/exams/admit-card?examId=${examId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch admit card data');
      const html = generateAdmitCardHtml(j.admit);
      const win = window.open('', '_blank');
      if (!win) { alert('Pop-up blocked! Please allow pop-ups for this site.'); return; }
      win.document.write(html);
      win.document.close();
    } catch (e: any) {
      alert('Admit Card Error: ' + e.message);
    }
  };

  const todayExams = exams.filter(e => e.exam_date === format(new Date(), 'yyyy-MM-dd'));

  const examCols: GridColDef[] = [
    {
      field: 'student_name', headerName: 'Student', width: 200,
      renderCell: p => (
        <Stack>
          <Typography variant="body2" fontWeight={600}>{p.value}</Typography>
          <Typography variant="caption" color="text.secondary">{p.row.enrollment}</Typography>
        </Stack>
      )
    },
    { field: 'course_name', headerName: 'Course', width: 200 },
    {
      field: 'start_time', headerName: 'Scheduled', width: 180,
      renderCell: p => p.value ? (
        <Stack>
          <Typography variant="body2">{format(parseISO(p.value), 'dd MMM yyyy')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTime fontSize="inherit" color="action" />
            <Typography variant="caption" color="text.secondary">{format(parseISO(p.value), 'hh:mm a')}</Typography>
            {p.row.system_name && <>
              <Computer fontSize="inherit" color="action" sx={{ ml: 0.5 }} />
              <Typography variant="caption" color="text.secondary">{p.row.system_name}</Typography>
            </>}
          </Box>
        </Stack>
      ) : <Typography variant="caption" color="text.secondary">—</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: p => (
        <Chip
          label={p.value?.replace('_', ' ').toUpperCase()}
          color={p.value === 'completed' ? 'success' : p.value === 'in_progress' ? 'warning' : 'primary'}
          size="small"
        />
      )
    },
    {
      field: 'attendance', headerName: 'Attendance', width: 150,
      renderCell: p => p.value === 'pending' ? (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Mark Present">
            <IconButton size="small" color="success" onClick={() => markAttendance(p.row.id, 'present')}><HowToReg fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Mark Absent">
            <IconButton size="small" color="error" onClick={() => markAttendance(p.row.id, 'absent')}><PersonOff fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      ) : <Chip label={p.value?.toUpperCase()} size="small" variant="outlined" color={p.value === 'present' ? 'success' : 'error'} />
    },
    {
      field: 'admit_card', headerName: 'Admit Card', width: 130, sortable: false,
      renderCell: p => (
        <Tooltip title="Print Admit Card">
          <Button
            size="small"
            variant="outlined"
            startIcon={<Print fontSize="small" />}
            onClick={() => printAdmitCard(p.row.id)}
            sx={{ borderRadius: 2, fontSize: 11 }}
          >
            Print
          </Button>
        </Tooltip>
      )
    },
  ];

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Exam Management">

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Exam Control Center</Typography>
          <Typography variant="body2" color="text.secondary">Schedule exams, track attendance, and manage results</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><IconButton onClick={fetchExams}><Refresh /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setOpen(true); setScheduleError(''); setScheduleSuccess(''); }} size="large" sx={{ borderRadius: 2 }}>
            Schedule Exam
          </Button>
        </Stack>
      </Box>

      {scheduleSuccess && (
        <Alert severity="success" onClose={() => setScheduleSuccess('')} sx={{ mb: 2 }}>{scheduleSuccess}</Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Scheduled', value: exams.filter(e => e.status === 'scheduled').length, color: 'primary.main', icon: <Schedule /> },
          { label: "Today's Exams", value: todayExams.length, color: 'info.main', icon: <Event /> },
          { label: 'Present Today', value: exams.filter(e => e.attendance === 'present').length, color: 'success.main', icon: <HowToReg /> },
          { label: 'Completed', value: exams.filter(e => e.status === 'completed').length, color: 'text.secondary', icon: <CheckCircle /> },
        ].map((s, i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: s.color, width: 40, height: 40 }}>{s.icon}</Avatar>
                <Box>
                  <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`All Exams (${exams.length})`} />
        <Tab label={`Today's Attendance (${todayExams.length})`} />
      </Tabs>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>
        ) : (
          <DataGrid
            rows={tab === 0 ? exams : todayExams}
            columns={examCols}
            autoHeight density="comfortable"
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none' }}
          />
        )}
      </Paper>

      {/* ── Schedule Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Schedule color="primary" />
          <Box>
            <Typography variant="h6">Schedule New Exam</Typography>
            <Typography variant="caption" color="text.secondary">Minimum 6 days advance notice required</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            {/* Left: form */}
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                {/* Course */}
                <TextField select label="Course *" value={selectedCourse}
                  onChange={e => { setSelectedCourse(e.target.value); setSelectedBatch(''); setSelectedStudents([]); }} fullWidth>
                  {uniqueCourses.map(c => <MenuItem key={c.id} value={c.id}>{c.name || 'Unknown'}</MenuItem>)}
                </TextField>

                {/* Batch */}
                <TextField select label="Batch *" value={selectedBatch}
                  onChange={e => { setSelectedBatch(e.target.value); setSelectedStudents([]); }}
                  fullWidth disabled={!selectedCourse} helperText={!selectedCourse ? 'Select course first' : ''}>
                  {filteredBatches.map(b => <MenuItem key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</MenuItem>)}
                </TextField>

                {/* No systems warning */}
                {systems.length === 0 && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}
                    action={
                      <Button size="small" color="inherit" href="/institute/settings" target="_blank">
                        Add Systems
                      </Button>
                    }
                  >
                    <strong>No exam systems configured.</strong> Go to Settings → Systems and add your exam computers before scheduling.
                  </Alert>
                )}

                {systems.length > 0 && (
                  <Alert severity="success" icon={<Computer fontSize="small" />} sx={{ py: 0.5, borderRadius: 2 }}>
                    {systems.length} system{systems.length !== 1 ? 's' : ''} available for allocation.
                  </Alert>
                )}

                {/* Fixed Exam Pattern Info */}
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>
                    Exam Pattern (Fixed)
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Section 1 — 25 min</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}>
                      <Chip size="small" label="25 MCQs" />
                      <Chip size="small" label="Email Writing" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>Section 2 — 25 min</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}>
                      <Chip size="small" label="Letter Writing" />
                      <Chip size="small" label="Table / Statement" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>Section 3 — Dynamic (WPM-based timer)</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}>
                      <Chip size="small" label="Speed Passage" color="primary" />
                    </Stack>
                  </Stack>
                </Paper>

                {/* Date & Time */}
                <Stack direction="row" spacing={2}>
                  <TextField fullWidth type="date" label="Exam Date *"
                    InputLabelProps={{ shrink: true }}
                    value={examDate} onChange={e => setExamDate(e.target.value)}
                    helperText="Min 6 days from today" />
                  <TextField fullWidth type="time" label="Start Time *"
                    InputLabelProps={{ shrink: true }}
                    value={startTime} onChange={e => setStartTime(e.target.value)} />
                </Stack>

                <Alert severity="info" icon={<Info />} sx={{ py: 0.5 }}>
                  Systems are auto-allocated. Reporting time = 30 min before start.
                </Alert>
              </Stack>
            </Grid>

            {/* Right: students */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700}>Students in Batch</Typography>
                  {students.length > 0 && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setSelectedStudents(students.filter(s => s.is_eligible).map(s => s.id))}>
                        Select All Eligible
                      </Button>
                      <Button size="small" color="error" onClick={() => setSelectedStudents([])}>Clear</Button>
                    </Stack>
                  )}
                </Box>
                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto', maxHeight: 360 }}>
                  {!selectedBatch && (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ pt: 4 }}>
                      Select a batch to see students
                    </Typography>
                  )}
                  {stuLoading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={28} /></Box>}
                  {!stuLoading && selectedBatch && students.length === 0 && (
                    <Alert severity="info" sx={{ py: 0 }}>No students found in this batch.</Alert>
                  )}
                  {students.map(s => (
                    <Box key={s.id} sx={{
                      display: 'flex', alignItems: 'center', mb: 1, p: 1, borderRadius: 1,
                      bgcolor: s.already_scheduled ? 'grey.50' : 'transparent',
                      opacity: s.is_eligible ? 1 : 0.5,
                    }}>
                      <Checkbox
                        checked={selectedStudents.includes(s.id)}
                        disabled={!s.is_eligible}
                        onChange={e => {
                          if (e.target.checked) setSelectedStudents(prev => [...prev, s.id]);
                          else setSelectedStudents(prev => prev.filter(id => id !== s.id));
                        }}
                        size="small"
                      />
                      <ListItemText
                        primaryTypographyProps={{ component: 'div' } as any}
                        secondaryTypographyProps={{ component: 'div' } as any}
                        primary={
                          <Stack component="span" direction="row" alignItems="center" gap={1}>
                            <Typography component="span" variant="body2" fontWeight={600}>{s.name}</Typography>
                            {s.already_scheduled && <Chip label="Already Scheduled" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                          </Stack>
                        }
                        secondary={
                          <Stack component="span" direction="row" alignItems="center" gap={1} sx={{ mt: 0.3 }}>
                            <Typography component="span" variant="caption">{s.enrollment_number}</Typography>
                            {!s.has_photo && <Chip label="No Photo" size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: 10 }} />}
                            {s.exam_fee_paid
                              ? <Chip label="Fee ✓" size="small" color="success" sx={{ height: 16, fontSize: 10 }} />
                              : <Chip label="Fee Pending" size="small" color="default" sx={{ height: 16, fontSize: 10 }} />}
                          </Stack>
                        }
                      />
                    </Box>
                  ))}
                </Box>
                {selectedStudents.length > 0 && (
                  <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'primary.50' }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>
                      {selectedStudents.length} student(s) selected
                    </Typography>
                  </Box>
                )}
              </Card>
            </Grid>

            {scheduleError && (
              <Grid item xs={12}>
                <Alert severity="error">{scheduleError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setOpen(false)} variant="outlined">Cancel</Button>
          <Button
            variant="contained" size="large"
            onClick={handleSchedule}
            disabled={saving || selectedStudents.length === 0 || !examDate || systems.length === 0}
            startIcon={saving ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {saving ? 'Validating…' : `Schedule for ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
