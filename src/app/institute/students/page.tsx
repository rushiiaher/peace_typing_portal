'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Chip, Tooltip, Paper,
  Snackbar, Alert, Divider, Stack, Skeleton, InputAdornment,
  IconButton, Avatar, Grid, LinearProgress,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import {
  PersonAdd, EditOutlined, DeleteOutline, Search, Refresh,
  Visibility, VisibilityOff, CameraAlt, AccountCircle, School,
  MenuBook, Payment, UploadFile, CheckCircle, Warning, ZoomIn,
  PictureAsPdf, Close,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Student {
  id: string; enrollment_number: string; name: string;
  first_name: string; father_name: string; surname: string; email: string; phone: string;
  address: string; batch_id: string; batch_name: string; batch_code: string;
  course_id: string; course_name: string; is_active: boolean; created_at: string;
  photo_url: string | null; aadhar_card_no: string; mother_name: string;
  guardian_name: string; guardian_phone: string;
  date_of_birth: string; blood_group: string;
  prerequisite_cert_url: string | null;
}
interface Course {
  id: string; name: string; code: string;
  passing_criteria_wpm: number;
}
interface Batch { id: string; batch_name: string; batch_code: string; course_id: string; }

/* ─── Helper: does a course need a prerequisite cert? ──────────────────── */
const CERT_WPM_THRESHOLD = 40;
function courseNeedsCert(courses: Course[], courseId: string): boolean {
  const c = courses.find(x => x.id === courseId);
  return !!c && c.passing_criteria_wpm >= CERT_WPM_THRESHOLD;
}
function courseWpm(courses: Course[], courseId: string): number {
  return courses.find(x => x.id === courseId)?.passing_criteria_wpm ?? 0;
}

/* ─── Empty form state ───────────────────────────────────────────────────── */
const EMPTY_FORM = {
  first_name: '', father_name: '', surname: '',
  email: '', password: 'student123',
  phone: '', address: '', is_active: 'true',
  aadhar_card_no: '', blood_group: '', date_of_birth: '',
  mother_name: '', guardian_name: '', guardian_phone: '',
  course_id: '', batch_id: '',
  photo_url: '',
};
const EMPTY_EDIT = {
  first_name: '', father_name: '', surname: '', phone: '', address: '',
  is_active: 'true', new_password: '',
  aadhar_card_no: '', blood_group: '', date_of_birth: '',
  mother_name: '', guardian_name: '', guardian_phone: '',
  course_id: '', batch_id: '',
  photo_url: '',
};

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−'];

/* ─── Section header ─────────────────────────────────────────────────────── */
function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle1" fontWeight={700} color="primary.main">{label}</Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
    </Box>
  );
}

/* ─── Certificate Preview Dialog ────────────────────────────────────────── */
function CertPreviewDialog({
  open, onClose, url, fileName,
}: { open: boolean; onClose: () => void; url: string; fileName?: string }) {
  const isPdf = url?.toLowerCase().includes('.pdf') || url?.toLowerCase().includes('application/pdf');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#1e3a5f', color: 'white', py: 1.5, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isPdf ? <PictureAsPdf /> : <ZoomIn />}
          <Typography fontWeight={700}>Prerequisite Certificate Preview</Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: '#f1f5f9', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isPdf ? (
          <Box component="embed"
            src={url}
            type="application/pdf"
            sx={{ width: '100%', height: 560, border: 'none', display: 'block' }}
          />
        ) : (
          <Box
            component="img"
            src={url}
            alt="Certificate"
            sx={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain', display: 'block', m: 'auto', p: 2 }}
          />
        )}
      </DialogContent>
      {fileName && (
        <Box sx={{ px: 3, py: 1.5, bgcolor: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PictureAsPdf sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">{fileName}</Typography>
        </Box>
      )}
    </Dialog>
  );
}

/* ─── Certificate Upload Zone ──────────────────────────────────────────── */
function CertUploadZone({
  wpmRequired,
  certFile,
  certUrl,
  onFileChange,
  onPreview,
  onRemove,
  existingCertUrl,
}: {
  wpmRequired: number;
  certFile: File | null;
  certUrl: string | null;
  onFileChange: (f: File) => void;
  onPreview: () => void;
  onRemove: () => void;
  existingCertUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAnyCert = !!certFile || !!certUrl || !!existingCertUrl;

  return (
    <Box sx={{
      mt: 1,
      p: 2.5,
      border: '2px solid',
      borderColor: hasAnyCert ? '#16a34a' : '#f59e0b',
      borderRadius: 2,
      bgcolor: hasAnyCert ? '#f0fdf4' : '#fffbeb',
      transition: 'all 0.2s',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {hasAnyCert
          ? <CheckCircle sx={{ color: '#16a34a', fontSize: 20 }} />
          : <Warning sx={{ color: '#f59e0b', fontSize: 20 }} />}
        <Typography fontWeight={700} color={hasAnyCert ? '#15803d' : '#b45309'} fontSize={14}>
          Prerequisite Certificate Required
        </Typography>
        <Chip
          label={`${wpmRequired} WPM Course`}
          size="small"
          sx={{
            bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700,
            border: '1px solid #fcd34d', fontSize: 11,
          }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, lineHeight: 1.6 }}>
        This course requires a <strong>{wpmRequired} WPM</strong> speed target. The student must have completed a
        30 WPM or 40 WPM course. Upload their previous course <strong>Completion Certificate</strong> (PDF, JPG, or PNG).
      </Typography>

      {/* Existing cert from DB */}
      {existingCertUrl && !certFile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1.5, bgcolor: '#dcfce7', borderRadius: 1.5 }}>
          <CheckCircle sx={{ color: '#16a34a', fontSize: 18 }} />
          <Typography variant="caption" fontWeight={600} color="success.dark" sx={{ flex: 1 }}>
            Certificate uploaded previously
          </Typography>
          <Button size="small" variant="outlined" color="success" startIcon={<ZoomIn />} onClick={onPreview} sx={{ py: 0.3, fontSize: 11 }}>
            Preview
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={onRemove} sx={{ py: 0.3, fontSize: 11 }}>
            Replace
          </Button>
        </Box>
      )}

      {/* Newly selected file */}
      {certFile && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1.5, bgcolor: '#dcfce7', borderRadius: 1.5 }}>
          <CheckCircle sx={{ color: '#16a34a', fontSize: 18 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" fontWeight={600} color="success.dark" noWrap>
              {certFile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {(certFile.size / 1024).toFixed(1)} KB
            </Typography>
          </Box>
          <Button size="small" variant="outlined" color="success" startIcon={<ZoomIn />} onClick={onPreview} sx={{ py: 0.3, fontSize: 11 }}>
            Preview
          </Button>
          <Button size="small" variant="outlined" color="error" onClick={onRemove} sx={{ py: 0.3, fontSize: 11 }}>
            Remove
          </Button>
        </Box>
      )}

      {/* Upload button */}
      {!certFile && !existingCertUrl && (
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            border: '2px dashed #fcd34d', borderRadius: 2, p: 3,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            cursor: 'pointer', bgcolor: 'white',
            '&:hover': { bgcolor: '#fefce8', borderColor: '#f59e0b' },
            transition: 'all 0.2s',
          }}
        >
          <UploadFile sx={{ color: '#f59e0b', fontSize: 32 }} />
          <Typography fontWeight={600} fontSize={13} color="#92400e">Click to upload certificate</Typography>
          <Typography variant="caption" color="text.secondary">PDF, JPG, PNG, WebP — max 5 MB</Typography>
        </Box>
      )}

      {certFile && (
        <Button size="small" variant="text" startIcon={<UploadFile />} onClick={() => inputRef.current?.click()} sx={{ fontSize: 12 }}>
          Change certificate
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFileChange(f);
          e.target.value = '';
        }}
      />
    </Box>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  /* Create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  /* Create — cert */
  const [createCertFile, setCreateCertFile] = useState<File | null>(null);
  const [createCertObjectUrl, setCreateCertObjectUrl] = useState<string | null>(null);
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [certPreviewUrl, setCertPreviewUrl] = useState('');
  const [certPreviewFileName, setCertPreviewFileName] = useState('');

  /* Edit dialog */
  const [editOpen, setEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);

  /* Edit — cert */
  const [editCertFile, setEditCertFile] = useState<File | null>(null);
  const [editCertObjectUrl, setEditCertObjectUrl] = useState<string | null>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [sRes, bRes, cRes] = await Promise.all([
      fetch('/api/institute/students'),
      fetch('/api/institute/batches'),
      fetch('/api/institute/courses'),
    ]);
    if (sRes.ok) { const j = await sRes.json(); setStudents(j.students ?? []); }
    if (bRes.ok) { const j = await bRes.json(); setAllBatches(j.batches ?? []); }
    if (cRes.ok) { const j = await cRes.json(); setCourses(j.courses ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Batches filtered by selected course */
  const filteredBatches = (courseId: string) =>
    allBatches.filter(b => !courseId || b.course_id === courseId);

  /* Upload helpers */
  const uploadPhotoToStorage = async (file: File, studentId?: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    if (studentId) fd.append('student_id', studentId);
    const res = await fetch('/api/institute/students/upload-photo', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Photo upload failed');
    return j.url as string;
  };

  const uploadCertToStorage = async (file: File, studentId: string): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('student_id', studentId);
    const res = await fetch('/api/institute/students/upload-certificate', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Certificate upload failed');
    return j.url as string;
  };

  /* Photo change handlers */
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showSnackbar('Photo must be under 3 MB.', 'error'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  /* Cert file selection */
  const handleCreateCertChange = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { showSnackbar('Certificate must be under 5 MB.', 'error'); return; }
    if (createCertObjectUrl) URL.revokeObjectURL(createCertObjectUrl);
    setCreateCertFile(file);
    setCreateCertObjectUrl(URL.createObjectURL(file));
  };

  const handleEditCertChange = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { showSnackbar('Certificate must be under 5 MB.', 'error'); return; }
    if (editCertObjectUrl) URL.revokeObjectURL(editCertObjectUrl);
    setEditCertFile(file);
    setEditCertObjectUrl(URL.createObjectURL(file));
  };

  /* Open cert preview */
  const openCertPreview = (url: string, name?: string) => {
    setCertPreviewUrl(url);
    setCertPreviewFileName(name ?? '');
    setCertPreviewOpen(true);
  };

  /* ── Create ── */
  const handleCreate = async () => {
    const { first_name, surname, email, password } = form;
    if (!first_name || !surname) { showSnackbar('First name and surname are required.', 'error'); return; }
    if (!email) { showSnackbar('Email is required.', 'error'); return; }
    if (!password || password.length < 6) { showSnackbar('Password must be at least 6 characters.', 'error'); return; }

    // Client-side cert check
    if (courseNeedsCert(courses, form.course_id) && !createCertFile) {
      showSnackbar(
        `This course requires ${courseWpm(courses, form.course_id)} WPM. Please upload the student's prerequisite completion certificate.`,
        'error'
      );
      return;
    }

    setCreating(true);
    try {
      // Create student first (no photo/cert URLs yet)
      const payload = { ...form, is_active: form.is_active === 'true', photo_url: null };
      const res = await fetch('/api/institute/students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const studentId: string = json.student?.id;

      // Upload photo if selected
      if (photoFile && studentId) {
        try {
          const photoUrl = await uploadPhotoToStorage(photoFile, studentId);
          await fetch(`/api/institute/students/${studentId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo_url: photoUrl }),
          });
        } catch (photoErr: any) {
          showSnackbar(`Student created but photo upload failed: ${photoErr.message}`, 'error');
        }
      }

      // Upload certificate if selected and course needs it
      if (createCertFile && studentId && courseNeedsCert(courses, form.course_id)) {
        try {
          const certUrl = await uploadCertToStorage(createCertFile, studentId);
          await fetch(`/api/institute/students/${studentId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prerequisite_cert_url: certUrl }),
          });
        } catch (certErr: any) {
          showSnackbar(`Student created but certificate upload failed: ${certErr.message}`, 'error');
        }
      }

      showSnackbar(`Student created — Roll No: ${json.enrollment_number}`, 'success');
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setPhotoPreview(null);
      setPhotoFile(null);
      setCreateCertFile(null);
      setCreateCertObjectUrl(null);
      fetchAll();
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setCreating(false); }
  };

  /* ── Edit open ── */
  const openEdit = (row: Student) => {
    setEditingStudent(row);
    setEditPhotoPreview(row.photo_url ?? null);
    setEditPhotoFile(null);
    setEditCertFile(null);
    setEditCertObjectUrl(null);
    setEditForm({
      first_name: row.first_name || row.name.split(' ')[0] || '',
      father_name: row.father_name || '',
      surname: row.surname || row.name.split(' ').slice(-1)[0] || '',
      phone: row.phone, address: row.address,
      is_active: row.is_active ? 'true' : 'false',
      new_password: '',
      aadhar_card_no: row.aadhar_card_no || '',
      blood_group: row.blood_group || '',
      date_of_birth: row.date_of_birth || '',
      mother_name: row.mother_name || '',
      guardian_name: row.guardian_name || '',
      guardian_phone: row.guardian_phone || '',
      course_id: row.course_id || '',
      batch_id: row.batch_id || '',
      photo_url: row.photo_url || '',
    });
    setShowEditPwd(false);
    setEditOpen(true);
  };

  /* ── Edit photo change ── */
  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { showSnackbar('Photo must be under 3 MB.', 'error'); return; }
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (editForm.new_password && editForm.new_password.length < 6) {
      showSnackbar('New password must be at least 6 characters.', 'error'); return;
    }

    // Client-side cert check: course changed to a new high-WPM course AND no cert
    const courseChanged = editForm.course_id !== editingStudent.course_id;
    const newCourseNeedsCert = courseNeedsCert(courses, editForm.course_id);
    const studentAlreadyHasCert = !!editingStudent.prerequisite_cert_url;
    if (courseChanged && newCourseNeedsCert && !editCertFile && !studentAlreadyHasCert) {
      showSnackbar(
        `This course requires ${courseWpm(courses, editForm.course_id)} WPM. Please upload the student's prerequisite completion certificate.`,
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = editForm.photo_url || null;
      if (editPhotoFile) {
        finalPhotoUrl = await uploadPhotoToStorage(editPhotoFile, editingStudent.id);
      }

      // Upload new cert if provided
      let finalCertUrl = editingStudent.prerequisite_cert_url || null;
      if (editCertFile) {
        finalCertUrl = await uploadCertToStorage(editCertFile, editingStudent.id);
      }

      const fullName = [editForm.first_name, editForm.father_name, editForm.surname].filter(Boolean).join(' ');
      const patchBody: any = {
        ...editForm,
        name: fullName,
        is_active: editForm.is_active === 'true',
        password: editForm.new_password || undefined,
        photo_url: finalPhotoUrl,
      };
      if (finalCertUrl !== editingStudent.prerequisite_cert_url) {
        patchBody.prerequisite_cert_url = finalCertUrl;
      }

      const res = await fetch(`/api/institute/students/${editingStudent.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showSnackbar('Student updated successfully.', 'success');
      setEditOpen(false);
      setEditPhotoFile(null);
      setEditCertFile(null);
      setEditCertObjectUrl(null);
      fetchAll();
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setSaving(false); }
  };

  /* ── Delete ── */
  const handleDelete = async (row: Student) => {
    if (!confirm(`Permanently delete \"${row.name}\"?\nThis removes their login and all records.`)) return;
    const res = await fetch(`/api/institute/students/${row.id}`, { method: 'DELETE' });
    if (res.ok) { showSnackbar('Student deleted.', 'success'); fetchAll(); }
    else { const j = await res.json(); showSnackbar(j.error, 'error'); }
  };

  /* ── Columns ── */
  const cols: GridColDef[] = [
    {
      field: 'photo_url', headerName: 'Photo', width: 72, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Avatar
            src={p.value || undefined}
            alt={p.row.name}
            sx={{ width: 40, height: 40, border: '2px solid', borderColor: p.value ? 'primary.200' : 'grey.300' }}
          >
            {!p.value && (p.row.name?.[0] ?? '?')}
          </Avatar>
        </Box>
      ),
    },
    { field: 'enrollment_number', headerName: 'Roll No.', width: 160 },
    { field: 'name', headerName: 'Full Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'phone', headerName: 'Phone', width: 130, valueGetter: (_: any, r: Student) => r.phone || '—' },
    { field: 'course_name', headerName: 'Course', width: 160, valueGetter: (_: any, r: Student) => r.course_name || '—' },
    { field: 'batch_name', headerName: 'Batch', width: 150, valueGetter: (_: any, r: Student) => r.batch_name || '—' },
    {
      field: 'is_active', headerName: 'Status', width: 95,
      renderCell: p => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'prerequisite_cert_url', headerName: 'Cert', width: 110, sortable: false,
      renderCell: (p) => {
        const needsCert = courseNeedsCert(courses, p.row.course_id);
        if (!needsCert) return <Chip size="small" label="N/A" sx={{ fontSize: 10, bgcolor: '#f1f5f9', color: '#64748b' }} />;
        if (p.value) {
          return (
            <Tooltip title="Click to preview certificate">
              <Chip
                size="small"
                icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                label="Uploaded"
                color="success"
                variant="outlined"
                onClick={() => openCertPreview(p.value, `${p.row.name} Certificate`)}
                sx={{ cursor: 'pointer', fontSize: 10 }}
              />
            </Tooltip>
          );
        }
        return (
          <Chip
            size="small"
            icon={<Warning sx={{ fontSize: '14px !important' }} />}
            label="Missing"
            color="error"
            variant="outlined"
            sx={{ fontSize: 10 }}
          />
        );
      },
    },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 90,
      getActions: (p: GridRowParams<Student>) => [
        <GridActionsCellItem key="edit" icon={<Tooltip title="Edit"><EditOutlined /></Tooltip>} label="Edit" onClick={() => openEdit(p.row)} color="primary" />,
        <GridActionsCellItem key="fee" icon={<Tooltip title="Fee Collection"><Payment /></Tooltip>} label="Fee Collection" onClick={() => window.location.href = '/institute/fees'} color="success" />,
        <GridActionsCellItem key="del" icon={<Tooltip title="Delete"><DeleteOutline /></Tooltip>} label="Delete" onClick={() => handleDelete(p.row)} color="error" />,
      ],
    },
  ];

  const filtered = students.filter(s =>
    [s.name, s.email, s.enrollment_number, s.batch_name, s.course_name].join(' ')
      .toLowerCase().includes(search.toLowerCase()));

  /* ── PWD eye toggle ── */
  const EyeToggle = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <InputAdornment position="end">
      <IconButton size="small" onClick={toggle} edge="end">
        {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  /* ─────────────────────────────────────────── Render ─ */
  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Student Management</Typography>
          <Typography variant="body2" color="text.secondary">
            {students.length} student{students.length !== 1 ? 's' : ''} enrolled in your institute
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={fetchAll}>Refresh</Button>
          </Tooltip>
          <Button variant="contained" startIcon={<PersonAdd />}
            onClick={() => { setForm(EMPTY_FORM); setPhotoPreview(null); setShowPwd(false); setCreateCertFile(null); setCreateCertObjectUrl(null); setCreateOpen(true); }}>
            Add Student
          </Button>
        </Stack>
      </Box>

      {/* Search */}
      <TextField size="small" placeholder="Search by name, email, roll no, batch…"
        value={search} onChange={e => setSearch(e.target.value)} sx={{ mb: 2, width: 440 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      {/* Grid */}
      {loading
        ? <Stack spacing={1}>{[...Array(6)].map((_, i) => <Skeleton key={i} height={52} variant="rectangular" sx={{ borderRadius: 1 }} />)}</Stack>
        : <Paper variant="outlined">
          <DataGrid rows={filtered} columns={cols} autoHeight getRowId={r => r.id}
            pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }} />
        </Paper>}

      {/* ══════════════════════════════ Add Student Dialog ══════════════════════════ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}
        maxWidth="md" fullWidth scroll="paper"
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <PersonAdd color="primary" />
          Add New Student
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ py: 3, px: { xs: 2, sm: 4 } }}>

          {/* ── Account Details ── */}
          <SectionHead icon={<AccountCircle />} label="Account Details" />

          <Grid container spacing={3} alignItems="flex-start">
            {/* Photo column */}
            <Grid item xs={12} sm="auto">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Box
                  onClick={() => photoRef.current?.click()}
                  sx={{
                    width: 105, height: 135, borderRadius: 1.5, flexShrink: 0,
                    border: '2px dashed', borderColor: 'divider',
                    bgcolor: 'grey.100', cursor: 'pointer', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {photoPreview
                    ? <Box component="img" src={photoPreview} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <CameraAlt sx={{ color: 'text.secondary', fontSize: 36 }} />}
                </Box>
                <Typography variant="caption" color="text.secondary" align="center">Upload Photo</Typography>
                <Typography variant="caption" color="text.disabled" align="center">JPG, PNG, WebP · max 2 MB</Typography>
                <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" onClick={() => photoRef.current?.click()}>Browse</Button>
                  {photoPreview && (
                    <Button size="small" variant="outlined" color="error"
                      onClick={() => { setPhotoPreview(null); setForm(f => ({ ...f, photo_url: '' })); }}>
                      Remove
                    </Button>
                  )}
                </Stack>
              </Box>
            </Grid>

            {/* Fields column */}
            <Grid item xs={12} sm>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Roll Number" fullWidth size="small" disabled
                    value="Auto-generated on creation"
                    helperText="System will assign a unique Roll No." />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email Address *" type="email" fullWidth size="small"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    helperText="This email will be used as the login username." />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Password *" type={showPwd ? 'text' : 'password'} fullWidth size="small"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    helperText="These credentials will be used for student portal login."
                    InputProps={{ endAdornment: <EyeToggle show={showPwd} toggle={() => setShowPwd(s => !s)} /> }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Status" fullWidth size="small"
                    value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value })}>
                    <MenuItem value="true">Active</MenuItem>
                    <MenuItem value="false">Inactive</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* ── Personal Info ── */}
          <Box sx={{ mt: 4 }}>
            <SectionHead icon={<AccountCircle />} label="Personal Info" />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="First Name *" fullWidth size="small"
                value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                placeholder="First Name" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Father/Middle Name" fullWidth size="small"
                value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })}
                placeholder="Father/Middle Name" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Surname/Last Name *" fullWidth size="small"
                value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })}
                placeholder="Surname" />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Aadhaar Card No" fullWidth size="small"
                value={form.aadhar_card_no}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setForm({ ...form, aadhar_card_no: v });
                }}
                placeholder="12 Digit Aadhaar Number"
                inputProps={{ maxLength: 12, inputMode: 'numeric' }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone Number" fullWidth size="small"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+91..."
                InputProps={{
                  startAdornment: <InputAdornment position="start">+91</InputAdornment>
                }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Date of Birth" type="date" fullWidth size="small"
                value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }}
                inputProps={{ placeholder: 'dd-mm-yyyy' }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Blood Group" fullWidth size="small"
                value={form.blood_group} onChange={e => setForm({ ...form, blood_group: e.target.value })}>
                <MenuItem value=""><em>Select</em></MenuItem>
                {BLOOD_GROUPS.map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField label="Address" fullWidth size="small"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="City, State" />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField label="Mother Name" fullWidth size="small"
                value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Guardian Name" fullWidth size="small"
                value={form.guardian_name} onChange={e => setForm({ ...form, guardian_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Guardian Phone" fullWidth size="small"
                value={form.guardian_phone} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} />
            </Grid>
          </Grid>

          {/* ── Academic ── */}
          <Box sx={{ mt: 4 }}>
            <SectionHead icon={<MenuBook />} label="Academic" />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField select label="Assign Course *" fullWidth size="small"
                value={form.course_id}
                onChange={e => setForm({ ...form, course_id: e.target.value, batch_id: '' })}>
                <MenuItem value=""><em>Select course first</em></MenuItem>
                {courses.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                    {c.passing_criteria_wpm >= CERT_WPM_THRESHOLD && (
                      <Chip
                        label={`${c.passing_criteria_wpm} WPM`}
                        size="small"
                        sx={{ ml: 1, fontSize: 10, bgcolor: '#fef3c7', color: '#92400e', height: 18 }}
                      />
                    )}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Select Batch *" fullWidth size="small"
                value={form.batch_id}
                onChange={e => setForm({ ...form, batch_id: e.target.value })}
                disabled={!form.course_id}
                helperText={!form.course_id ? 'Batches will appear after course selection.' : ''}>
                <MenuItem value=""><em>{form.course_id ? 'Select a batch' : 'Select a course first'}</em></MenuItem>
                {filteredBatches(form.course_id).map(b =>
                  <MenuItem key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</MenuItem>
                )}
              </TextField>
            </Grid>

            {/* ── Prerequisite Certificate Zone ── */}
            {courseNeedsCert(courses, form.course_id) && (
              <Grid item xs={12}>
                <CertUploadZone
                  wpmRequired={courseWpm(courses, form.course_id)}
                  certFile={createCertFile}
                  certUrl={createCertObjectUrl}
                  onFileChange={handleCreateCertChange}
                  onPreview={() => {
                    if (createCertObjectUrl) openCertPreview(createCertObjectUrl, createCertFile?.name);
                  }}
                  onRemove={() => { setCreateCertFile(null); setCreateCertObjectUrl(null); }}
                />
              </Grid>
            )}
          </Grid>

        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 4, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} variant="outlined" disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating} startIcon={<PersonAdd />}>
            {creating ? 'Creating…' : 'Create Student'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════ Edit Student Dialog ══════════════════════════ */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}
        maxWidth="md" fullWidth scroll="paper"
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <EditOutlined color="primary" />
          Edit Student — {editingStudent?.enrollment_number}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ py: 3, px: { xs: 2, sm: 4 } }}>

          {/* Read-only info */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Email (read-only)" fullWidth size="small"
                value={editingStudent?.email ?? ''} disabled helperText="Email cannot be changed." />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Roll / Enrollment No. (read-only)" fullWidth size="small"
                value={editingStudent?.enrollment_number ?? ''} disabled />
            </Grid>
          </Grid>

          {/* ── Photo upload ── */}
          <SectionHead icon={<CameraAlt />} label="Profile Photo" />
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 4 }}>
            <Box
              onClick={() => editPhotoRef.current?.click()}
              sx={{
                width: 105, height: 135, borderRadius: 1.5, flexShrink: 0,
                border: '2px dashed', borderColor: 'divider',
                bgcolor: 'grey.100', cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {editPhotoPreview
                ? <Box component="img" src={editPhotoPreview} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <CameraAlt sx={{ color: 'text.secondary', fontSize: 32 }} />}
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Student Photo</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                JPG, PNG or WebP — max 2 MB. Click the photo or Browse to change.
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" startIcon={<CameraAlt />} onClick={() => editPhotoRef.current?.click()}>
                  Browse Photo
                </Button>
                {editPhotoPreview && (
                  <Button size="small" variant="outlined" color="error"
                    onClick={() => { setEditPhotoPreview(null); setEditForm(f => ({ ...f, photo_url: '' })); }}>
                    Remove
                  </Button>
                )}
              </Stack>
              <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoChange} />
            </Box>
          </Box>

          <SectionHead icon={<AccountCircle />} label="Account Details" />
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField select label="Status" fullWidth size="small"
                value={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.value })}>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="New Password (optional)" type={showEditPwd ? 'text' : 'password'} fullWidth size="small"
                value={editForm.new_password} onChange={e => setEditForm({ ...editForm, new_password: e.target.value })}
                helperText="Leave blank to keep existing password."
                InputProps={{ endAdornment: <EyeToggle show={showEditPwd} toggle={() => setShowEditPwd(s => !s)} /> }} />
            </Grid>
          </Grid>

          <SectionHead icon={<AccountCircle />} label="Personal Info" />
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField label="First Name *" fullWidth size="small"
                value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Father/Middle Name" fullWidth size="small"
                value={editForm.father_name} onChange={e => setEditForm({ ...editForm, father_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Surname *" fullWidth size="small"
                value={editForm.surname} onChange={e => setEditForm({ ...editForm, surname: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Aadhaar Card No" fullWidth size="small"
                value={editForm.aadhar_card_no}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setEditForm({ ...editForm, aadhar_card_no: v });
                }}
                inputProps={{ maxLength: 12, inputMode: 'numeric' }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone" fullWidth size="small"
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                InputProps={{ startAdornment: <InputAdornment position="start">+91</InputAdornment> }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Date of Birth" type="date" fullWidth size="small"
                value={editForm.date_of_birth} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Blood Group" fullWidth size="small"
                value={editForm.blood_group} onChange={e => setEditForm({ ...editForm, blood_group: e.target.value })}>
                <MenuItem value=""><em>Select</em></MenuItem>
                {BLOOD_GROUPS.map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth size="small"
                value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="City, State" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Mother Name" fullWidth size="small"
                value={editForm.mother_name} onChange={e => setEditForm({ ...editForm, mother_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Guardian Name" fullWidth size="small"
                value={editForm.guardian_name} onChange={e => setEditForm({ ...editForm, guardian_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Guardian Phone" fullWidth size="small"
                value={editForm.guardian_phone} onChange={e => setEditForm({ ...editForm, guardian_phone: e.target.value })} />
            </Grid>
          </Grid>

          <SectionHead icon={<MenuBook />} label="Academic" />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField select label="Assign Course" fullWidth size="small"
                value={editForm.course_id}
                onChange={e => setEditForm({ ...editForm, course_id: e.target.value, batch_id: '' })}>
                <MenuItem value=""><em>Select course</em></MenuItem>
                {courses.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                    {c.passing_criteria_wpm >= CERT_WPM_THRESHOLD && (
                      <Chip
                        label={`${c.passing_criteria_wpm} WPM`}
                        size="small"
                        sx={{ ml: 1, fontSize: 10, bgcolor: '#fef3c7', color: '#92400e', height: 18 }}
                      />
                    )}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Select Batch" fullWidth size="small"
                value={editForm.batch_id}
                onChange={e => setEditForm({ ...editForm, batch_id: e.target.value })}
                disabled={!editForm.course_id}
                helperText={!editForm.course_id ? 'Batches will appear after course selection.' : ''}>
                <MenuItem value=""><em>Select a batch</em></MenuItem>
                {filteredBatches(editForm.course_id).map(b =>
                  <MenuItem key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</MenuItem>
                )}
              </TextField>
            </Grid>

            {/* ── Prerequisite Certificate Zone (edit) ── */}
            {courseNeedsCert(courses, editForm.course_id) && (
              <Grid item xs={12}>
                <CertUploadZone
                  wpmRequired={courseWpm(courses, editForm.course_id)}
                  certFile={editCertFile}
                  certUrl={editCertObjectUrl}
                  existingCertUrl={editingStudent?.prerequisite_cert_url}
                  onFileChange={handleEditCertChange}
                  onPreview={() => {
                    const previewUrl = editCertObjectUrl || editingStudent?.prerequisite_cert_url || '';
                    if (previewUrl) openCertPreview(previewUrl, editCertFile?.name || 'Certificate');
                  }}
                  onRemove={() => { setEditCertFile(null); setEditCertObjectUrl(null); }}
                />
              </Grid>
            )}
          </Grid>

        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 4, py: 2, gap: 1 }}>
          <Button onClick={() => setEditOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving} startIcon={<EditOutlined />}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Certificate Preview Dialog ── */}
      <CertPreviewDialog
        open={certPreviewOpen}
        onClose={() => setCertPreviewOpen(false)}
        url={certPreviewUrl}
        fileName={certPreviewFileName}
      />

      <Snackbar open={snackbar.open} autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminLayout>
  );
}
