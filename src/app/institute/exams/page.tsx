'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Tabs, Tab, Divider,
  Stack, Checkbox, ListItemText, Alert, CircularProgress,
  Tooltip, IconButton, Card, CardContent, Grid, Chip, Paper, Avatar,
  Accordion, AccordionSummary, AccordionDetails, ToggleButtonGroup, ToggleButton,
  Table, TableBody, TableCell, TableHead, TableRow, Snackbar,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import {
  Add, Schedule, CheckCircle, Print, Computer, Info,
  Event, AccessTime, HowToReg, PersonOff, Refresh,
  Edit, Delete, EditCalendar, DeleteForever,
  ExpandMore, ViewList, TableRows, Group,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';
import { format, parseISO, addDays } from 'date-fns';
import { fmtDateLongIST, fmtTimeIST, todayIST } from '../../../utils/dateIST';
import { generateAdmitCardHtml } from '../../../utils/generateAdmitCardHtml';

/** Compute the minimum selectable exam date (6 days from today) as YYYY-MM-DD */
function getMinExamDate(): string {
  return format(addDays(new Date(), 6), 'yyyy-MM-dd');
}

interface ExamRow {
  id: string; student_name: string; enrollment: string;
  course_name: string; batch_id: string; batch_name: string;
  exam_date: string; start_time: string; reporting_time: string; status: string;
  result: string | null; wpm: number | null;
  attendance: string; system_name: string; center_code: string;
  examAnswers?: any;
}
interface Batch { id: string; batch_name: string; batch_code: string; course_id: string; course_name?: string; }
interface Student { id: string; name: string; enrollment_number: string; has_photo: boolean; exam_fee_paid: boolean; is_eligible: boolean; already_scheduled: boolean; exam_status: string | null; }
interface SystemItem { id: string; system_name: string; }
interface ExamGroup { key: string; label: string; date: string; time: string; course: string; batch: string; exams: ExamRow[]; }

/* ── Nested hierarchy types ── */
interface SlotGroup {
  key: string; date: string; dateLabel: string; time: string; timeLabel: string;
  exams: ExamRow[];
}
interface BatchHierarchy {
  batchId: string; batchName: string; course: string;
  slots: SlotGroup[]; totalExams: number;
}

function statusColor(s: string) {
  if (s === 'completed') return 'success';
  if (s === 'in_progress') return 'warning';
  return 'primary';
}

export default function ExamsPage() {
  const [tab, setTab] = useState(0);             // 0 = All, 1 = Today's Attendance
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Schedule dialog
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

  // Flat view row selection
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);

  // Reschedule dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleIds, setRescheduleIds] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('10:00');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete confirm dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const uniqueCourses = Array.from(
    new Map(batches.map(b => [b.course_id, { id: b.course_id, name: b.course_name }])).values()
  );
  const filteredBatches = selectedCourse ? batches.filter(b => b.course_id === selectedCourse) : [];

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchExams = useCallback(async () => {
    setLoading(true); setFetchError('');
    try {
      const res = await fetch('/api/institute/exams');
      const j = await res.json();
      if (!res.ok) setFetchError(j.error || 'Failed to load exams');
      else setExams(j.exams ?? []);
    } catch (e: any) { setFetchError(e.message); }
    finally { setLoading(false); }
  }, []);

  const fetchBasics = async () => {
    const [bRes, sRes] = await Promise.all([fetch('/api/institute/batches'), fetch('/api/institute/systems')]);
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
      .then(r => r.json()).then(j => setStudents(j.students || [])).finally(() => setStuLoading(false));
  }, [selectedBatch, batches]);

  // ── Grouped view — group by date + start_time slot ────────────────────────
  const visibleExams = tab === 0 ? exams : exams.filter(e => e.exam_date === todayIST());

  const groups = useMemo<ExamGroup[]>(() => {
    const map = new Map<string, ExamGroup>();
    for (const e of visibleExams) {
      const slotTime = e.start_time ? fmtTimeIST(e.start_time) : '??:??';
      const key = `${e.exam_date}_${slotTime}_${e.batch_id}`;
      if (!map.has(key)) {
        const dateLabel = fmtDateLongIST(e.exam_date);
        const timeLabel = e.start_time ? fmtTimeIST(e.start_time) : '—';
        map.set(key, {
          key, date: dateLabel, time: timeLabel,
          course: e.course_name, batch: e.batch_name,
          label: `${dateLabel} • ${timeLabel}`,
          exams: [],
        });
      }
      map.get(key)!.exams.push(e);
    }
    // Sort groups chronologically using key (YYYY-MM-DD_HH:mm_batchId — 24h format)
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [visibleExams]);

  // ── Build Batch → Slot hierarchy for nested grouped view ────────────────
  const batchHierarchy = useMemo<BatchHierarchy[]>(() => {
    const map = new Map<string, BatchHierarchy>();
    for (const e of visibleExams) {
      const bKey = e.batch_id || 'unknown';
      if (!map.has(bKey)) {
        map.set(bKey, {
          batchId: bKey, batchName: e.batch_name, course: e.course_name,
          slots: [], totalExams: 0,
        });
      }
      const batchGrp = map.get(bKey)!;
      batchGrp.totalExams++;

      const slotTime = e.start_time ? fmtTimeIST(e.start_time) : '??:??';
      const slotKey = `${e.exam_date}_${slotTime}`;
      let slot = batchGrp.slots.find(s => s.key === slotKey);
      if (!slot) {
        const dateLabel = fmtDateLongIST(e.exam_date);
        const timeLabel = e.start_time ? fmtTimeIST(e.start_time) : '—';
        slot = { key: slotKey, date: e.exam_date, dateLabel, time: slotTime, timeLabel, exams: [] };
        batchGrp.slots.push(slot);
      }
      slot.exams.push(e);
    }
    for (const b of map.values()) {
      b.slots.sort((a, b) => a.key.localeCompare(b.key));
    }
    return Array.from(map.values()).sort((a, b) => a.batchName.localeCompare(b.batchName));
  }, [visibleExams]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSchedule = async () => {
    setScheduleError('');
    const batch = batches.find(b => b.id === selectedBatch);
    if (!selectedBatch || !examDate || !startTime || selectedStudents.length === 0) {
      setScheduleError('Please complete all fields and select at least one student.'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/institute/exams/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: batch?.course_id, batchId: selectedBatch, examDate, startTime, studentIds: selectedStudents }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || j.error || 'Failed to schedule');
      setScheduleSuccess(j.message || `Scheduled ${selectedStudents.length} exams.`);
      setOpen(false); fetchExams();
      setSelectedCourse(''); setSelectedBatch(''); setSelectedStudents([]); setScheduleError('');
    } catch (e: any) { setScheduleError(e.message); }
    finally { setSaving(false); }
  };

  const markAttendance = async (id: string, status: 'present' | 'absent') => {
    const res = await fetch('/api/institute/exams', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
      if (!win) { alert('Pop-up blocked!'); return; }
      win.document.write(html); win.document.close();
    } catch (e: any) { alert('Admit Card Error: ' + e.message); }
  };

  const openReschedule = (ids: string[]) => {
    const first = exams.find(e => ids.includes(e.id));
    if (first?.start_time) {
      const dt = parseISO(first.start_time);
      setNewDate(format(dt, 'yyyy-MM-dd')); setNewTime(format(dt, 'HH:mm'));
    } else { setNewDate(''); setNewTime('10:00'); }
    setRescheduleIds(ids); setRescheduleError(''); setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) { setRescheduleError('Please select a new date and time.'); return; }
    setRescheduleSaving(true); setRescheduleError('');
    try {
      const res = await fetch('/api/institute/exams', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: rescheduleIds, newExamDate: newDate, newStartTime: newTime }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Reschedule failed');
      setSuccessMsg(j.message || `Rescheduled ${rescheduleIds.length} exam(s) successfully.`);
      setRescheduleOpen(false); setSelection([]); fetchExams();
    } catch (e: any) { setRescheduleError(e.message); }
    finally { setRescheduleSaving(false); }
  };

  const openDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteOpen(true); };

  const handleDelete = async () => {
    setDeleteSaving(true);
    try {
      const res = await fetch('/api/institute/exams', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deleteIds }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Delete failed');
      setDeleteOpen(false); setSelection([]); fetchExams();
    } catch (e: any) { alert('Delete failed: ' + e.message); }
    finally { setDeleteSaving(false); }
  };

  const todayExams = exams.filter(e => e.exam_date === todayIST());
  const selectedIds = selection as string[];
  const selectedExams = exams.filter(e => selectedIds.includes(e.id));
  const allScheduled = selectedExams.length > 0 && selectedExams.every(e => e.status === 'scheduled');

  // ── Flat DataGrid columns ──────────────────────────────────────────────────
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
    { field: 'course_name', headerName: 'Course', width: 160 },
    { field: 'batch_name', headerName: 'Batch', width: 160 },
    {
      field: 'start_time', headerName: 'Scheduled', width: 190,
      renderCell: p => p.value ? (
        <Stack>
          <Typography variant="body2">{p.row.exam_date ? fmtDateLongIST(p.row.exam_date).split(' (')[0] : fmtDateLongIST(p.row.exam_date)}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTime fontSize="inherit" color="action" />
            <Typography variant="caption" color="text.secondary">{fmtTimeIST(p.value)}</Typography>
            {p.row.system_name && p.row.system_name !== '—' && (
              <><Computer fontSize="inherit" color="action" sx={{ ml: 0.5 }} />
                <Typography variant="caption" color="text.secondary">{p.row.system_name}</Typography></>
            )}
          </Box>
        </Stack>
      ) : <Typography variant="caption" color="text.secondary">—</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: p => <Chip label={p.value?.replace('_', ' ').toUpperCase()} color={statusColor(p.value)} size="small" />
    },
    {
      field: 'result', headerName: 'Result', width: 170,
      renderCell: p => {
        if (!p.row.result) return <Typography variant="caption" color="text.secondary">—</Typography>;
        return (
          <Stack spacing={0.5}>
            <Chip label={p.row.result.toUpperCase()} size="small" color={p.row.result === 'pass' ? 'success' : 'error'} />
            {p.row.examAnswers && (
              <Box>
                <Typography variant="caption" display="block" color="text.secondary">MCQ: {p.row.examAnswers.mcq_marks_obtained ?? 0}/50</Typography>
                <Typography variant="caption" display="block" color="text.secondary">Spd: {p.row.examAnswers.speed_wpm ?? 0} WPM ({p.row.examAnswers.speed_accuracy ?? 0}%)</Typography>
              </Box>
            )}
          </Stack>
        );
      }
    },
    {
      field: 'attendance', headerName: 'Attendance', width: 150,
      renderCell: p => {
        // Show attendance buttons only once current time >= reporting_time
        const reportingTime = p.row.reporting_time ? new Date(p.row.reporting_time) : null;
        const canMark = reportingTime ? new Date() >= reportingTime : true;
        if (p.value === 'pending') {
          if (!canMark) return <Chip label="NOT YET" size="small" variant="outlined" color="default" />;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Mark Present"><IconButton size="small" color="success" onClick={() => markAttendance(p.row.id, 'present')}><HowToReg fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Mark Absent"><IconButton size="small" color="error" onClick={() => markAttendance(p.row.id, 'absent')}><PersonOff fontSize="small" /></IconButton></Tooltip>
            </Stack>
          );
        }
        return <Chip label={p.value?.toUpperCase()} size="small" variant="outlined" color={p.value === 'present' ? 'success' : 'error'} />;
      }
    },
    {
      field: 'admit_card', headerName: 'Admit Card', width: 110, sortable: false,
      renderCell: p => (
        <Button size="small" variant="outlined" startIcon={<Print fontSize="small" />}
          onClick={() => printAdmitCard(p.row.id)} sx={{ borderRadius: 2, fontSize: 11 }}>Print</Button>
      )
    },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: p => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Reschedule">
            <IconButton size="small" color="primary"
              disabled={p.row.status !== 'scheduled'} onClick={() => openReschedule([p.row.id])}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error"
              disabled={p.row.status !== 'scheduled'} onClick={() => openDelete([p.row.id])}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    },
  ];

  // ── Grouped view component (Batch → Date/Slot → Students) ──────────────────
  const GroupedView = () => (
    <Stack spacing={1.5}>
      {batchHierarchy.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No exams found.</Typography>
        </Paper>
      )}
      {batchHierarchy.map((batch, bi) => {
        const allScheduled = visibleExams.filter(e => e.batch_id === batch.batchId).every(e => e.status === 'scheduled');
        const presentCount = visibleExams.filter(e => e.batch_id === batch.batchId && e.attendance === 'present').length;
        const absentCount = visibleExams.filter(e => e.batch_id === batch.batchId && e.attendance === 'absent').length;

        return (
          /* ═══ LEVEL 1: BATCH ═══ */
          <Accordion key={batch.batchId} defaultExpanded={bi === 0} variant="outlined"
            sx={{ borderRadius: '10px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMore />}
              sx={{ bgcolor: 'primary.50', '&.Mui-expanded': { bgcolor: 'primary.100' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1, flexWrap: 'wrap' }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                  <Group fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography variant="subtitle1" fontWeight={800}>{batch.batchName}</Typography>
                  <Typography variant="caption" color="text.secondary">{batch.course}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  <Chip size="small" label={`${batch.totalExams} student${batch.totalExams !== 1 ? 's' : ''}`} color="primary" variant="outlined" />
                  <Chip size="small" label={`${batch.slots.length} slot${batch.slots.length !== 1 ? 's' : ''}`} variant="outlined" />
                  {presentCount > 0 && <Chip size="small" label={`${presentCount} present`} color="success" />}
                  {absentCount > 0 && <Chip size="small" label={`${absentCount} absent`} color="error" />}
                </Stack>
                {/* Batch-level bulk actions */}
                {allScheduled && (
                  <Stack direction="row" spacing={1} sx={{ ml: 1 }} onClick={ev => ev.stopPropagation()}>
                    <Button size="small" variant="outlined" startIcon={<EditCalendar fontSize="small" />}
                      onClick={() => openReschedule(visibleExams.filter(e => e.batch_id === batch.batchId).map(e => e.id))}>
                      Reschedule All
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteForever fontSize="small" />}
                      onClick={() => openDelete(visibleExams.filter(e => e.batch_id === batch.batchId).map(e => e.id))}>
                      Delete All
                    </Button>
                  </Stack>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0, pl: 1 }}>
              {batch.slots.map((slot, si) => {
                const slotAllScheduled = slot.exams.every(e => e.status === 'scheduled');
                return (
                  /* ═══ LEVEL 2: DATE / TIME SLOT ═══ */
                  <Accordion key={slot.key} defaultExpanded={batch.slots.length <= 4 || si === 0} variant="outlined"
                    sx={{ my: 0.5, mx: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMore />}
                      sx={{ minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.5 }, bgcolor: 'grey.50', '&.Mui-expanded': { bgcolor: 'action.hover' } }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 1, flexWrap: 'wrap' }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Event fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight={700}>{slot.dateLabel}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <AccessTime fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight={600} color="primary.main">{slot.timeLabel}</Typography>
                        </Stack>
                        <Chip size="small" label={`${slot.exams.length} student${slot.exams.length !== 1 ? 's' : ''}`} variant="outlined" />
                        {slotAllScheduled && (
                          <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }} onClick={ev => ev.stopPropagation()}>
                            <Button size="small" variant="text" startIcon={<EditCalendar fontSize="inherit" />}
                              onClick={() => openReschedule(slot.exams.map(e => e.id))} sx={{ fontSize: 11 }}>
                              Reschedule
                            </Button>
                            <Button size="small" variant="text" color="error" startIcon={<DeleteForever fontSize="inherit" />}
                              onClick={() => openDelete(slot.exams.map(e => e.id))} sx={{ fontSize: 11 }}>
                              Delete
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      {/* ═══ LEVEL 3: STUDENTS TABLE ═══ */}
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>System</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Attendance</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Admit Card</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {slot.exams.map((e, idx) => (
                            <TableRow key={e.id} hover>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{e.student_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{e.enrollment}</Typography>
                              </TableCell>
                              <TableCell>
                                <Chip size="small" icon={<Computer fontSize="inherit" />}
                                  label={e.system_name !== '—' ? e.system_name : 'Not assigned'}
                                  variant="outlined"
                                  color={e.system_name !== '—' ? 'default' : 'warning'} />
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={e.status?.replace('_', ' ').toUpperCase()} color={statusColor(e.status)} />
                              </TableCell>
                              <TableCell>
                                {e.result ? (
                                  <Stack spacing={0.3}>
                                    <Chip size="small" label={e.result.toUpperCase()} color={e.result === 'pass' ? 'success' : 'error'} />
                                    {e.examAnswers && (
                                      <Box>
                                        <Typography variant="caption" display="block" color="text.secondary">MCQ: {e.examAnswers.mcq_marks_obtained ?? 0}/50</Typography>
                                        <Typography variant="caption" display="block" color="text.secondary">Spd: {e.examAnswers.speed_wpm ?? 0} ({e.examAnswers.speed_accuracy ?? 0}%)</Typography>
                                      </Box>
                                    )}
                                  </Stack>
                                ) : <Typography variant="caption" color="text.secondary">—</Typography>}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const reportingTime = e.reporting_time ? new Date(e.reporting_time) : null;
                                  const canMark = reportingTime ? new Date() >= reportingTime : true;
                                  if (e.attendance === 'pending') {
                                    if (!canMark) return <Chip size="small" label="NOT YET" variant="outlined" color="default" />;
                                    return (
                                      <Stack direction="row" spacing={0.5}>
                                        <Tooltip title="Mark Present">
                                          <IconButton size="small" color="success" onClick={() => markAttendance(e.id, 'present')}>
                                            <HowToReg fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Mark Absent">
                                          <IconButton size="small" color="error" onClick={() => markAttendance(e.id, 'absent')}>
                                            <PersonOff fontSize="small" />
                                          </IconButton>
                                        </Tooltip>
                                      </Stack>
                                    );
                                  }
                                  return (
                                    <Chip size="small" label={e.attendance?.toUpperCase()} variant="outlined"
                                      color={e.attendance === 'present' ? 'success' : 'error'} />
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                <Button size="small" variant="outlined" startIcon={<Print fontSize="small" />}
                                  onClick={() => printAdmitCard(e.id)} sx={{ fontSize: 11 }}>
                                  Print
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5}>
                                  <Tooltip title="Reschedule">
                                    <IconButton size="small" color="primary"
                                      disabled={e.status !== 'scheduled'} onClick={() => openReschedule([e.id])}>
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error"
                                      disabled={e.status !== 'scheduled'} onClick={() => openDelete([e.id])}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Exam Management">

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Exam Control Center</Typography>
          <Typography variant="body2" color="text.secondary">Schedule exams, track attendance, and manage results</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Refresh"><IconButton onClick={fetchExams}><Refresh /></IconButton></Tooltip>
          <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(_, v) => v && setViewMode(v)}>
            <ToggleButton value="grouped"><Tooltip title="Grouped by Slot"><Group fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="flat"><Tooltip title="Flat Table"><TableRows fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<Add />}
            onClick={() => { setOpen(true); setScheduleError(''); setScheduleSuccess(''); }}
            size="large" sx={{ borderRadius: 2 }}>
            Schedule Exam
          </Button>
        </Stack>
      </Box>

      {scheduleSuccess && <Alert severity="success" onClose={() => setScheduleSuccess('')} sx={{ mb: 2 }}>{scheduleSuccess}</Alert>}

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

      {fetchError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError('')}>{fetchError}</Alert>}

      {/* Flat view: bulk action bar */}
      {viewMode === 'flat' && selectedIds.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 1, px: 2, py: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            {selectedIds.length} exam{selectedIds.length !== 1 ? 's' : ''} selected
          </Typography>
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button size="small" variant="outlined" startIcon={<EditCalendar />} disabled={!allScheduled} onClick={() => openReschedule(selectedIds)}>
              Reschedule Selected
            </Button>
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteForever />} disabled={!allScheduled} onClick={() => openDelete(selectedIds)}>
              Delete Selected
            </Button>
            <Button size="small" color="inherit" onClick={() => setSelection([])}>Clear</Button>
          </Stack>
        </Paper>
      )}

      {/* Main content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}><CircularProgress /></Box>
      ) : viewMode === 'grouped' ? (
        <GroupedView />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <DataGrid
            rows={tab === 0 ? exams : todayExams}
            columns={examCols}
            autoHeight density="comfortable"
            checkboxSelection disableRowSelectionOnClick
            rowSelectionModel={selection} onRowSelectionModelChange={setSelection}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{ border: 'none' }}
          />
        </Paper>
      )}

      {/* ── Schedule Dialog ──────────────────────────────────────────────── */}
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
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField select label="Course *" value={selectedCourse}
                  onChange={e => { setSelectedCourse(e.target.value); setSelectedBatch(''); setSelectedStudents([]); }} fullWidth>
                  {uniqueCourses.map(c => <MenuItem key={c.id} value={c.id}>{c.name || 'Unknown'}</MenuItem>)}
                </TextField>
                <TextField select label="Batch *" value={selectedBatch}
                  onChange={e => { setSelectedBatch(e.target.value); setSelectedStudents([]); }}
                  fullWidth disabled={!selectedCourse} helperText={!selectedCourse ? 'Select course first' : ''}>
                  {filteredBatches.map(b => <MenuItem key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</MenuItem>)}
                </TextField>

                {systems.length === 0 ? (
                  <Alert severity="warning" action={<Button size="small" color="inherit" href="/institute/settings" target="_blank">Add Systems</Button>}>
                    <strong>No exam systems configured.</strong> Add computers in Settings first.
                  </Alert>
                ) : (
                  <Alert severity="success" icon={<Computer fontSize="small" />} sx={{ py: 0.5 }}>
                    {systems.length} system{systems.length !== 1 ? 's' : ''} available for allocation.
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 1 }}>Exam Pattern (Fixed)</Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Section 1 — 25 min</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}><Chip size="small" label="25 MCQs" /><Chip size="small" label="Email Writing" /></Stack>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>Section 2 — 25 min</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}><Chip size="small" label="Letter Writing" /><Chip size="small" label="Table / Statement" /></Stack>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>Section 3 — Dynamic (WPM-based timer)</Typography>
                    <Stack direction="row" spacing={1} sx={{ pl: 1 }}><Chip size="small" label="Speed Passage" color="primary" /></Stack>
                  </Stack>
                </Paper>

                <Stack direction="row" spacing={2}>
                  <TextField fullWidth type="date" label="Exam Date *" InputLabelProps={{ shrink: true }}
                    value={examDate} onChange={e => setExamDate(e.target.value)} helperText="Min 6 days from today"
                    inputProps={{ min: getMinExamDate() }} />
                  <TextField fullWidth type="time" label="Start Time *" InputLabelProps={{ shrink: true }}
                    value={startTime} onChange={e => setStartTime(e.target.value)} />
                </Stack>
                <Alert severity="info" icon={<Info />} sx={{ py: 0.5 }}>
                  Systems are auto-allocated. Overflow students go into the next slot (+ 20 min cooldown).
                </Alert>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700}>Students in Batch</Typography>
                  {students.length > 0 && (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => setSelectedStudents(students.filter(s => s.is_eligible).map(s => s.id))}>Select All Eligible</Button>
                      <Button size="small" color="error" onClick={() => setSelectedStudents([])}>Clear</Button>
                    </Stack>
                  )}
                </Box>
                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto', maxHeight: 360 }}>
                  {!selectedBatch && <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ pt: 4 }}>Select a batch to see students</Typography>}
                  {stuLoading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={28} /></Box>}
                  {!stuLoading && selectedBatch && students.length === 0 && <Alert severity="info" sx={{ py: 0 }}>No students found in this batch.</Alert>}
                  {students.map(s => (
                    <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, borderRadius: 1, opacity: s.is_eligible ? 1 : 0.5 }}>
                      <Checkbox checked={selectedStudents.includes(s.id)} disabled={!s.is_eligible}
                        onChange={e => { if (e.target.checked) setSelectedStudents(p => [...p, s.id]); else setSelectedStudents(p => p.filter(id => id !== s.id)); }} size="small" />
                      <ListItemText
                        primaryTypographyProps={{ component: 'div' } as any} secondaryTypographyProps={{ component: 'div' } as any}
                        primary={<Stack component="span" direction="row" alignItems="center" gap={1}>
                          <Typography component="span" variant="body2" fontWeight={600}>{s.name}</Typography>
                          {s.exam_status === 'completed' && <Chip label="Exam Completed" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />}
                          {(s.exam_status === 'scheduled' || s.exam_status === 'in_progress') && <Chip label="Already Scheduled" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                        </Stack>}
                        secondary={<Stack component="span" direction="row" alignItems="center" gap={1} sx={{ mt: 0.3 }}>
                          <Typography component="span" variant="caption">{s.enrollment_number}</Typography>
                          {!s.has_photo && <Chip label="No Photo" size="small" color="error" variant="outlined" sx={{ height: 16, fontSize: 10 }} />}
                          {s.exam_fee_paid ? <Chip label="Fee ✓" size="small" color="success" sx={{ height: 16, fontSize: 10 }} /> : <Chip label="Fee Pending" size="small" sx={{ height: 16, fontSize: 10 }} />}
                        </Stack>}
                      />
                    </Box>
                  ))}
                </Box>
                {selectedStudents.length > 0 && (
                  <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'primary.50' }}>
                    <Typography variant="caption" color="primary.main" fontWeight={700}>{selectedStudents.length} student(s) selected</Typography>
                  </Box>
                )}
              </Card>
            </Grid>
            {scheduleError && <Grid item xs={12}><Alert severity="error">{scheduleError}</Alert></Grid>}
          </Grid>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2.5 }}>
          <Button onClick={() => setOpen(false)} variant="outlined">Cancel</Button>
          <Button variant="contained" size="large" onClick={handleSchedule}
            disabled={saving || selectedStudents.length === 0 || !examDate || systems.length === 0}
            startIcon={saving ? <CircularProgress size={20} /> : <CheckCircle />}>
            {saving ? 'Validating…' : `Schedule for ${selectedStudents.length} Student${selectedStudents.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reschedule Dialog ────────────────────────────────────────────── */}
      <Dialog open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditCalendar color="primary" />
          <Box>
            <Typography variant="h6">Reschedule {rescheduleIds.length} Exam{rescheduleIds.length !== 1 ? 's' : ''}</Typography>
            <Typography variant="caption" color="text.secondary">System allocation stays unchanged.</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField fullWidth type="date" label="New Exam Date *" InputLabelProps={{ shrink: true }}
              value={newDate} onChange={e => setNewDate(e.target.value)} helperText="Min 6 days from today"
              inputProps={{ min: getMinExamDate() }} />
            <TextField fullWidth type="time" label="New Start Time *" InputLabelProps={{ shrink: true }}
              value={newTime} onChange={e => setNewTime(e.target.value)} />
            {rescheduleError && <Alert severity="error">{rescheduleError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRescheduleOpen(false)} variant="outlined">Cancel</Button>
          <Button variant="contained" onClick={handleReschedule} disabled={rescheduleSaving}
            startIcon={rescheduleSaving ? <CircularProgress size={18} /> : <CheckCircle />}>
            {rescheduleSaving ? 'Saving…' : 'Confirm Reschedule'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle><Typography variant="h6" color="error.main">Delete {deleteIds.length} Exam{deleteIds.length !== 1 ? 's' : ''}?</Typography></DialogTitle>
        <DialogContent>
          <Alert severity="warning">
            Deleting <strong>{deleteIds.length}</strong> exam{deleteIds.length !== 1 ? 's' : ''} will also remove all question assignments. This cannot be undone.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} variant="outlined">Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteSaving}
            startIcon={deleteSaving ? <CircularProgress size={18} /> : <DeleteForever />}>
            {deleteSaving ? 'Deleting…' : `Delete ${deleteIds.length} Exam${deleteIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar open={!!successMsg} autoHideDuration={5000} onClose={() => setSuccessMsg('')}
        message={successMsg} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />

    </AdminLayout>
  );
}
