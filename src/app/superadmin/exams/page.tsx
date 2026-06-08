'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Tabs, Tab, Chip, CircularProgress, Alert,
  Accordion, AccordionSummary, AccordionDetails, Stack, Paper,
  Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Tooltip, Divider, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Snackbar,
} from '@mui/material';
import {
  ExpandMore, Business, School, Event, AccessTime,
  Computer, HowToReg, PersonOff, Schedule, CheckCircle,
  Refresh, EditCalendar,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';
import { format, parseISO } from 'date-fns';
import { fmtDateLongIST, fmtTimeIST, todayIST } from '../../../utils/dateIST';

interface ExamRow {
  id: string; student: string; enrollment: string; photoUrl: string | null;
  institute: string; instituteCode: string; instituteId: string;
  course: string; courseCode: string;
  batch: string; batchCode: string; batchId: string;
  systemName: string;
  examDate: string; startTime: string | null; endTime: string | null;
  reportingTime: string | null;
  status: string; attendance: string; centerCode: string;
  examAnswers?: any;
  result?: string;
}



function statusColor(s: string): 'default' | 'primary' | 'warning' | 'success' | 'error' {
  if (s === 'completed') return 'success';
  if (s === 'in_progress') return 'warning';
  if (s === 'cancelled') return 'error';
  return 'primary';
}

function attColor(a: string): 'default' | 'success' | 'error' {
  if (a === 'present') return 'success';
  if (a === 'absent') return 'error';
  return 'default';
}

/** Hierarchy: Institute → Batch → Date/Time Slot */
interface SlotGroup {
  key: string;
  date: string; dateLabel: string;
  time: string; timeLabel: string;
  exams: ExamRow[];
}
interface BatchGroup {
  batchId: string; batch: string; batchCode: string;
  course: string; courseCode: string;
  slots: SlotGroup[];
  totalExams: number;
}
interface InstituteGroup {
  instituteId: string; institute: string; instituteCode: string;
  batches: BatchGroup[];
  totalExams: number;
}

export default function ExamManagement() {
  const [tab, setTab] = useState(0);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Reschedule dialog state ──
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleIds, setRescheduleIds] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const fetchExams = () => {
    setLoading(true); setError('');
    fetch('/api/admin/exams')
      .then(r => r.json())
      .then(j => {
        if (j.error) throw new Error(j.error);
        setExams(j.exams ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchExams(); }, []);

  const visibleExams = tab === 0 ? exams : exams.filter(e => e.examDate === todayIST());

  // Build hierarchy: Institute → Batch → Slot
  const hierarchy = useMemo<InstituteGroup[]>(() => {
    const instMap = new Map<string, InstituteGroup>();

    for (const e of visibleExams) {
      const instKey = e.instituteId || 'unknown';
      if (!instMap.has(instKey)) {
        instMap.set(instKey, {
          instituteId: instKey, institute: e.institute, instituteCode: e.instituteCode,
          batches: [], totalExams: 0,
        });
      }
      const inst = instMap.get(instKey)!;
      inst.totalExams++;

      let batchGroup = inst.batches.find(b => b.batchId === e.batchId);
      if (!batchGroup) {
        batchGroup = {
          batchId: e.batchId, batch: e.batch, batchCode: e.batchCode,
          course: e.course, courseCode: e.courseCode,
          slots: [], totalExams: 0,
        };
        inst.batches.push(batchGroup);
      }
      batchGroup.totalExams++;

      const slotTime = e.startTime ? fmtTimeIST(e.startTime) : '??:??';
      const slotKey = `${e.examDate}_${slotTime}`;
      let slot = batchGroup.slots.find(s => s.key === slotKey);
      if (!slot) {
        const dateLabel = fmtDateLongIST(e.examDate !== '—' ? e.examDate : null);
        const timeLabel = e.startTime ? fmtTimeIST(e.startTime) : '—';
        slot = { key: slotKey, date: e.examDate, dateLabel, time: slotTime, timeLabel, exams: [] };
        batchGroup.slots.push(slot);
      }
      slot.exams.push(e);
    }

    // Sort everything chronologically
    for (const inst of instMap.values()) {
      inst.batches.sort((a, b) => a.batch.localeCompare(b.batch));
      for (const batch of inst.batches) {
        batch.slots.sort((a, b) => a.key.localeCompare(b.key));
      }
    }

    return Array.from(instMap.values()).sort((a, b) => a.institute.localeCompare(b.institute));
  }, [visibleExams]);

  const todayExams = exams.filter(e => e.examDate === todayIST());

  // ── Reschedule handlers ──
  const openReschedule = (ids: string[]) => {
    setRescheduleIds(ids);
    setNewDate('');
    setNewTime('');
    setRescheduleError('');
    setRescheduleOpen(true);
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) { setRescheduleError('Please set both date and time.'); return; }
    setRescheduleSaving(true); setRescheduleError('');
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: rescheduleIds, newExamDate: newDate, newStartTime: newTime }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Failed');
      setSuccessMsg(j.message || `Rescheduled ${rescheduleIds.length} exam(s) successfully.`);
      setRescheduleOpen(false);
      fetchExams();
    } catch (err: any) {
      setRescheduleError(err.message);
    } finally {
      setRescheduleSaving(false);
    }
  };

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Exam Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            Hierarchical view: Institute → Batch → Time Slot → Students
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {!loading && (
            <Typography variant="body2" color="text.secondary">
              {exams.length} total · {todayExams.length} today
            </Typography>
          )}
          <Tooltip title="Refresh"><IconButton onClick={fetchExams}><Refresh /></IconButton></Tooltip>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={`All Exams (${exams.length})`} />
        <Tab label={`Today's Exams (${todayExams.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : hierarchy.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="text.secondary">No exams found.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {hierarchy.map(inst => (
            /* ═══ LEVEL 1: INSTITUTE ═══ */
            <Accordion key={inst.instituteId} defaultExpanded variant="outlined"
              sx={{ borderRadius: '10px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMore />}
                sx={{ bgcolor: 'primary.50', '&.Mui-expanded': { bgcolor: 'primary.100' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                    <Business fontSize="small" />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>{inst.institute}</Typography>
                    {inst.instituteCode && (
                      <Typography variant="caption" color="text.secondary">Code: {inst.instituteCode}</Typography>
                    )}
                  </Box>
                  <Chip size="small" label={`${inst.totalExams} exam${inst.totalExams !== 1 ? 's' : ''}`}
                    color="primary" variant="outlined" />
                  <Chip size="small" label={`${inst.batches.length} batch${inst.batches.length !== 1 ? 'es' : ''}`}
                    variant="outlined" />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pl: 1 }}>
                {inst.batches.map(batch => (
                  /* ═══ LEVEL 2: BATCH ═══ */
                  <Accordion key={batch.batchId} defaultExpanded variant="outlined"
                    sx={{ my: 0.5, mx: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMore />}
                      sx={{ bgcolor: 'grey.50', '&.Mui-expanded': { bgcolor: 'action.hover' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 1 }}>
                        <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}>
                          <School fontSize="small" />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={700}>
                            {batch.batch} ({batch.batchCode})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {batch.course} {batch.courseCode ? `(${batch.courseCode})` : ''}
                          </Typography>
                        </Box>
                        <Chip size="small" label={`${batch.totalExams} student${batch.totalExams !== 1 ? 's' : ''}`}
                          color="info" variant="outlined" />
                        <Chip size="small" label={`${batch.slots.length} slot${batch.slots.length !== 1 ? 's' : ''}`}
                          variant="outlined" />
                        {/* Batch-level Set Exam Date */}
                        <Button size="small" variant="outlined" startIcon={<EditCalendar fontSize="small" />}
                          onClick={(ev) => { ev.stopPropagation(); openReschedule(batch.slots.flatMap(s => s.exams.map(e => e.id))); }}
                          sx={{ ml: 1, textTransform: 'none' }}>
                          Set Exam Date
                        </Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0, pl: 1 }}>
                      {batch.slots.map(slot => (
                        /* ═══ LEVEL 3: TIME SLOT ═══ */
                        <Accordion key={slot.key} defaultExpanded={batch.slots.length <= 3} variant="outlined"
                          sx={{ my: 0.5, mx: 1, borderRadius: '6px !important', '&:before': { display: 'none' } }}>
                          <AccordionSummary expandIcon={<ExpandMore />}
                            sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <Event fontSize="small" color="action" />
                                <Typography variant="body2" fontWeight={700}>{slot.dateLabel}</Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <AccessTime fontSize="small" color="action" />
                                <Typography variant="body2" fontWeight={600} color="primary.main">{slot.timeLabel}</Typography>
                              </Stack>
                              <Chip size="small" label={`${slot.exams.length} student${slot.exams.length !== 1 ? 's' : ''}`}
                                variant="outlined" sx={{ ml: 'auto' }} />
                              {slot.exams.some(e => e.attendance === 'present') && (
                                <Chip size="small" label={`${slot.exams.filter(e => e.attendance === 'present').length} present`}
                                  color="success" sx={{ height: 22 }} />
                              )}
                              {slot.exams.some(e => e.attendance === 'absent') && (
                                <Chip size="small" label={`${slot.exams.filter(e => e.attendance === 'absent').length} absent`}
                                  color="error" sx={{ height: 22 }} />
                              )}
                              {/* Slot-level Set Exam Date */}
                              <Button size="small" variant="text" startIcon={<EditCalendar fontSize="inherit" />}
                                onClick={(ev) => { ev.stopPropagation(); openReschedule(slot.exams.map(e => e.id)); }}
                                sx={{ ml: 1, fontSize: 11, textTransform: 'none' }}>
                                Set Date
                              </Button>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0 }}>
                            {/* ═══ LEVEL 4: STUDENTS TABLE ═══ */}
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                  <TableCell sx={{ fontWeight: 700, width: 40 }}>#</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>System</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Attendance</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>MCQ / Speed</TableCell>
                                  <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {slot.exams.map((e, idx) => (
                                  <TableRow key={e.id} hover>
                                    <TableCell>
                                      <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Avatar src={e.photoUrl || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                                          {e.student?.[0] ?? '?'}
                                        </Avatar>
                                        <Box>
                                          <Typography variant="body2" fontWeight={600}>{e.student}</Typography>
                                          <Typography variant="caption" color="text.secondary">{e.enrollment}</Typography>
                                        </Box>
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Chip size="small" icon={<Computer fontSize="inherit" />}
                                        label={e.systemName !== '—' ? e.systemName : 'N/A'}
                                        variant="outlined"
                                        color={e.systemName !== '—' ? 'default' : 'warning'} />
                                    </TableCell>
                                    <TableCell>
                                      <Chip size="small" label={e.status?.replace('_', ' ').toUpperCase()}
                                        color={statusColor(e.status)} />
                                    </TableCell>
                                    <TableCell>
                                      <Chip size="small" label={e.attendance?.toUpperCase()}
                                        variant="outlined" color={attColor(e.attendance)} />
                                    </TableCell>
                                    <TableCell>
                                      {e.examAnswers ? (
                                        <Box>
                                          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                            MCQ: {e.examAnswers.mcq_marks_obtained ?? 0}/50
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                            Spd: {e.examAnswers.speed_wpm ?? 0} WPM ({e.examAnswers.speed_accuracy ?? 0}%)
                                          </Typography>
                                        </Box>
                                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                                    </TableCell>
                                    <TableCell>
                                      {e.status === 'completed' && e.result ? (
                                        <Chip size="small" label={e.result.toUpperCase()} color={e.result === 'pass' ? 'success' : 'error'} />
                                      ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      {/* ── Reschedule Dialog (Super Admin — NO 6-day restriction) ── */}
      <Dialog open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EditCalendar color="primary" />
            <span>Set Exam Date</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <Alert severity="info" variant="outlined">
              Super Admin override — no minimum lead time. Setting date for <strong>{rescheduleIds.length}</strong> exam(s).
            </Alert>
            <TextField fullWidth type="date" label="New Exam Date *" InputLabelProps={{ shrink: true }}
              value={newDate} onChange={e => setNewDate(e.target.value)} />
            <TextField fullWidth type="time" label="New Start Time *" InputLabelProps={{ shrink: true }}
              value={newTime} onChange={e => setNewTime(e.target.value)} />
            {rescheduleError && <Alert severity="error">{rescheduleError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleReschedule} disabled={rescheduleSaving}>
            {rescheduleSaving ? <CircularProgress size={20} /> : 'Set Date'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar open={!!successMsg} autoHideDuration={5000} onClose={() => setSuccessMsg('')}
        message={successMsg} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </AdminLayout>
  );
}
