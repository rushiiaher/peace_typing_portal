'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, Tabs, Tab, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Chip,
  Paper, Snackbar, Alert, Stack, Skeleton, Tooltip,
  InputAdornment, Divider, List, ListItem, ListItemText,
  LinearProgress, Collapse, Avatar, Card, CardContent,
  CardActionArea, Grid, Badge, FormControl, InputLabel, Select,
} from '@mui/material';
import { DataGrid, GridColDef, GridActionsCellItem, GridRowParams } from '@mui/x-data-grid';
import {
  Add, DeleteOutline, Search, Refresh, School, Speed,
  Mail, Article, QuestionMark, Keyboard, EditOutlined,
  UploadFile, CheckCircle, ErrorOutline, ExpandMore, ExpandLess,
  Download, ArrowBack, Language,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { superAdminMenuItems } from '../../components/menuItems';

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  { label: 'Keyboard Lessons',    key: 'keyboard_lessons',    icon: <Keyboard fontSize="small" />,    color: '#3b82f6', bulkUpload: false },
  { label: 'Speed Passages',      key: 'speed_passages',      icon: <Speed fontSize="small" />,       color: '#10b981', bulkUpload: true  },
  { label: 'Letter Templates',    key: 'letter_templates',    icon: <Article fontSize="small" />,     color: '#f59e0b', bulkUpload: true  },
  { label: 'Statement Templates', key: 'statement_templates', icon: <Article fontSize="small" />,     color: '#8b5cf6', bulkUpload: true  },
  { label: 'Email Templates',     key: 'email_templates',     icon: <Mail fontSize="small" />,        color: '#ef4444', bulkUpload: true  },
  { label: 'MCQ Questions',       key: 'mcq_question_bank',   icon: <QuestionMark fontSize="small" />, color: '#06b6d4', bulkUpload: true  },
];

const TEMPLATE_HEADERS: Record<string, string[]> = {
  speed_passages: ['title', 'difficulty_level', 'passage_text'],
  email_templates: ['title', 'mail_to', 'subject', 'cc', 'bcc', 'body', 'attachment_1', 'attachment_2', 'attachment_3'],
  letter_templates: [
    'title', 'category', 'letterhead', 'sender_address',
    'ref_number', 'date', 'receiver_address', 'subject',
    'reference_line', 'salutation', 'body_para_1', 'body_para_2', 'body_para_3',
    'complimentary_close', 'subscription', 'designation', 'enclosure',
  ],
  mcq_question_bank: ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation'],
  statement_templates: ['(Upload any normal Excel file — the entire sheet becomes the practice grid)'],
};

interface ContentItem {
  id: string; course_id: string; course_name: string; title: string;
  difficulty_level?: string; is_active: boolean; created_at: string;
  [key: string]: any;
}
interface Course { id: string; name: string; code: string; language_name?: string; }

const EMPTY_FORM = {
  course_id: '', title: '', difficulty: '', content_text: '', lesson_number: '',
  passage_text: '', word_count: '', category: '', question: '',
  option_a: '', option_b: '', option_c: '', option_d: '',
  correct_answer: '', explanation: '', target_keys: '',
  template_content: '', sample_content: '', is_active: 'true',
  mail_to: '', subject: '', cc: '', bcc: '', body: '',
  attachment_1: '', attachment_2: '', attachment_3: '',
  letterhead: '', sender_address: '', ref_number: '', date: '',
  receiver_address: '', letter_subject: '', reference_line: '', salutation: '',
  body_para_1: '', body_para_2: '', body_para_3: '',
  complimentary_close: '', subscription: '', designation: '', enclosure: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContentManagement() {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCourseId, setUploadCourseId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stmtFileRef = useRef<HTMLInputElement>(null);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
    ({ open: false, message: '', severity: 'success' });
  const showSnackbar = (msg: string, sev: 'success' | 'error') =>
    setSnackbar({ open: true, message: msg, severity: sev });

  const currentType = SECTIONS[tab].key;
  const currentSection = SECTIONS[tab];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCourses = useCallback(async () => {
    const res = await fetch('/api/admin/courses');
    if (res.ok) { const j = await res.json(); setCourses(j.courses ?? []); }
  }, []);

  const fetchItems = useCallback(async (type: string, courseId: string) => {
    if (!courseId) { setItems([]); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/content?type=${type}&course_id=${courseId}`);
    if (res.ok) { const j = await res.json(); setItems(j.items ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => {
    if (selectedCourseId) {
      setSearch('');
      fetchItems(SECTIONS[tab].key, selectedCourseId);
    }
  }, [tab, selectedCourseId, fetchItems]);

  // ─── Download Template ────────────────────────────────────────────────────

  const downloadTemplate = async () => {
    if (currentType === 'statement_templates') {
      showSnackbar('For Statement Templates, upload any normal Excel file directly — no template needed.', 'success');
      return;
    }
    const headers = TEMPLATE_HEADERS[currentType];
    if (!headers) return;
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 5, 20) }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Template');
    writeFile(wb, `${currentType}_template.xlsx`);
  };

  // ─── Bulk Upload ─────────────────────────────────────────────────────────

  const openUpload = () => {
    setUploadFile(null);
    setUploadTitle('');
    setUploadCourseId(selectedCourseId);
    setUploadResult(null);
    setErrorsExpanded(false);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadFile) { showSnackbar('Please select a file.', 'error'); return; }
    if (!uploadCourseId) { showSnackbar('Please select a course.', 'error'); return; }
    setUploading(true); setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('course_id', uploadCourseId);
      if (uploadTitle.trim()) fd.append('title', uploadTitle.trim());
      const res = await fetch(`/api/admin/content/bulk-upload?type=${currentType}`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUploadResult({ inserted: json.inserted, errors: json.errors ?? [] });
      if (json.inserted > 0) fetchItems(currentType, selectedCourseId);
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setUploading(false); }
  };

  // ─── Manual Save ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.course_id) { showSnackbar('Please select a course.', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/admin/content?type=${currentType}&id=${editingItem!.id}`
        : `/api/admin/content?type=${currentType}`;
      const method = isEdit ? 'PATCH' : 'POST';

      const payload: Record<string, any> = {
        course_id: form.course_id,
        difficulty_level: currentType === 'mcq_question_bank' ? undefined : (form.difficulty || undefined),
        is_active: form.is_active === 'true',
      };

      switch (currentType) {
        case 'keyboard_lessons':
          if (!form.lesson_number || !form.title || !form.content_text) {
            showSnackbar('Lesson number, title and content are required.', 'error'); return;
          }
          Object.assign(payload, { lesson_number: form.lesson_number, title: form.title, content_text: form.content_text, target_keys: form.target_keys || undefined });
          break;
        case 'speed_passages':
          if (!form.title || !form.passage_text) { showSnackbar('Title and passage text are required.', 'error'); return; }
          Object.assign(payload, { title: form.title, passage_text: form.passage_text, word_count: form.word_count || undefined });
          break;
        case 'letter_templates':
          if (!form.title) { showSnackbar('Title is required.', 'error'); return; }
          Object.assign(payload, {
            title: form.title, category: form.category || undefined,
            template_content: JSON.stringify({
              letterhead: form.letterhead, sender_address: form.sender_address,
              ref_number: form.ref_number, date: form.date,
              receiver_address: form.receiver_address, subject: form.letter_subject,
              reference_line: form.reference_line, salutation: form.salutation,
              body_para_1: form.body_para_1, body_para_2: form.body_para_2,
              body_para_3: form.body_para_3, complimentary_close: form.complimentary_close,
              subscription: form.subscription, designation: form.designation,
              enclosure: form.enclosure,
            }),
          });
          break;
        case 'statement_templates':
          if (!form.title || !form.template_content) { showSnackbar('Title and template content are required.', 'error'); return; }
          Object.assign(payload, { title: form.title, category: form.category || undefined, template_content: form.template_content, sample_content: form.sample_content || undefined });
          break;
        case 'email_templates':
          if (!form.title || !form.subject || !form.body) { showSnackbar('Title, Subject and Body are required.', 'error'); return; }
          Object.assign(payload, {
            title: form.title,
            template_content: JSON.stringify({
              mail_to: form.mail_to, subject: form.subject, cc: form.cc, bcc: form.bcc,
              body: form.body, attachment_1: form.attachment_1 || null,
              attachment_2: form.attachment_2 || null, attachment_3: form.attachment_3 || null,
            }),
          });
          break;
        case 'mcq_question_bank':
          if (!form.question || !form.option_a || !form.option_b || !form.option_c || !form.option_d || !form.correct_answer) {
            showSnackbar('Question, all options and correct answer are required.', 'error'); return;
          }
          Object.assign(payload, { question: form.question, option_a: form.option_a, option_b: form.option_b, option_c: form.option_c, option_d: form.option_d, correct_answer: form.correct_answer, explanation: form.explanation || undefined });
          break;
      }

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showSnackbar(isEdit ? 'Content updated.' : 'Content saved.', 'success');
      setDialogOpen(false); setForm(EMPTY_FORM); setEditingItem(null); fetchItems(currentType, selectedCourseId);
    } catch (e: any) { showSnackbar(e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ─── Open Edit ────────────────────────────────────────────────────────────

  const openEdit = (row: ContentItem) => {
    setEditingItem(row);
    let emailFields = {};
    let letterFields = {};
    if (currentType === 'email_templates' && row.template_content) {
      try { emailFields = JSON.parse(row.template_content); } catch { }
    }
    if (currentType === 'letter_templates' && row.template_content) {
      try { letterFields = JSON.parse(row.template_content); } catch { }
    }
    const ef: any = emailFields;
    const lf: any = letterFields;
    setForm({
      ...EMPTY_FORM,
      course_id: row.course_id ?? '', title: row.title ?? row.question ?? '',
      difficulty: row.difficulty_level ?? '', is_active: String(row.is_active ?? true),
      lesson_number: String(row.lesson_number ?? ''), content_text: row.content_text ?? '',
      target_keys: Array.isArray(row.target_keys) ? row.target_keys.join(', ') : (row.target_keys ?? ''),
      passage_text: row.passage_text ?? '', word_count: String(row.word_count ?? ''),
      category: row.category ?? '', template_content: row.template_content ?? '',
      sample_content: row.sample_content ?? '',
      question: row.question ?? '', option_a: row.option_a ?? '', option_b: row.option_b ?? '',
      option_c: row.option_c ?? '', option_d: row.option_d ?? '',
      correct_answer: row.correct_answer ?? '', explanation: row.explanation ?? '',
      mail_to: ef.mail_to ?? '', subject: ef.subject ?? '', cc: ef.cc ?? '',
      bcc: ef.bcc ?? '', body: ef.body ?? '',
      attachment_1: ef.attachment_1 ?? '', attachment_2: ef.attachment_2 ?? '', attachment_3: ef.attachment_3 ?? '',
      letterhead: lf.letterhead ?? '', sender_address: lf.sender_address ?? '',
      ref_number: lf.ref_number ?? '', date: lf.date ?? '',
      receiver_address: lf.receiver_address ?? '', letter_subject: lf.subject ?? '',
      reference_line: lf.reference_line ?? '', salutation: lf.salutation ?? '',
      body_para_1: lf.body_para_1 ?? '', body_para_2: lf.body_para_2 ?? '',
      body_para_3: lf.body_para_3 ?? '', complimentary_close: lf.complimentary_close ?? '',
      subscription: lf.subscription ?? '', designation: lf.designation ?? '',
      enclosure: lf.enclosure ?? '',
    });
    setDialogOpen(true);
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (row: ContentItem) => {
    if (!confirm(`Delete "${row.title}"?`)) return;
    const res = await fetch(`/api/admin/content?type=${currentType}&id=${row.id}`, { method: 'DELETE' });
    if (res.ok) { showSnackbar('Deleted.', 'success'); fetchItems(currentType, selectedCourseId); }
    else { const j = await res.json(); showSnackbar(j.error, 'error'); }
  };

  // ─── DataGrid Columns ─────────────────────────────────────────────────────

  const isMarathiCourse = selectedCourse?.language_name?.toLowerCase().includes('marathi') ||
    selectedCourse?.name?.toLowerCase().includes('marathi') || false;

  const cols: GridColDef[] = [
    {
      field: 'title', headerName: currentType === 'mcq_question_bank' ? 'Question' : 'Title', flex: 1, minWidth: 250,
      renderCell: (p: any) => (
        <Typography variant="body2" sx={{
          fontFamily: isMarathiCourse ? '"Kruti Dev 010", Arial, sans-serif' : 'inherit',
          fontSize: isMarathiCourse ? 18 : 14, pt: isMarathiCourse ? 0.3 : 0,
        }}>{p.value}</Typography>
      )
    },
    ...(currentType !== 'mcq_question_bank' ? [{
      field: 'difficulty_level', headerName: 'Difficulty', width: 130,
      renderCell: (p: any) => p.value
        ? <Chip size="small" label={p.value} color={p.value === 'beginner' ? 'success' : p.value === 'intermediate' ? 'warning' : 'error'} variant="outlined" />
        : <span>—</span>,
    } as GridColDef] : []),
    ...(currentType === 'letter_templates' ? [
      { field: 'category', headerName: 'Category', width: 120, renderCell: (p: any) => p.value ? <Chip size="small" label={p.value} /> : <span>—</span> } as GridColDef
    ] : []),
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: p => <Chip size="small" label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'created_at', headerName: 'Created', width: 120,
      valueGetter: (_: any, r: ContentItem) => r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
    },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 90,
      getActions: (p: GridRowParams<ContentItem>) => [
        <GridActionsCellItem key="edit" icon={<Tooltip title="Edit"><EditOutlined /></Tooltip>} label="Edit" onClick={() => openEdit(p.row)} color="primary" />,
        <GridActionsCellItem key="del" icon={<Tooltip title="Delete"><DeleteOutline /></Tooltip>} label="Delete" onClick={() => handleDelete(p.row)} color="error" />,
      ],
    },
  ];

  // ─── Form Helpers ─────────────────────────────────────────────────────────

  const selectedCourseRef = courses.find(c => c.id === form.course_id);
  const detectedLang = selectedCourseRef?.language_name?.toLowerCase() || '';
  const detectedName = selectedCourseRef?.name?.toLowerCase() || '';
  const isMarathi = detectedLang.includes('marathi') || detectedName.includes('marathi');

  const f = (field: keyof typeof EMPTY_FORM, extraSx?: any) => {
    const isText = !['course_id', 'difficulty', 'is_active', 'lesson_number'].includes(field);
    const useMarathi = isText && isMarathi;
    return {
      value: form[field], fullWidth: true, size: 'small' as const,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value }),
      className: useMarathi ? 'marathi-input' : '',
      sx: {
        ...(useMarathi ? {
          '& .MuiInputBase-input, & .MuiInputBase-inputMultiline': {
            fontFamily: '"Kruti Dev 010", Arial, sans-serif !important',
            fontSize: '24px !important',
          }
        } : {}),
        ...extraSx
      }
    };
  };

  const CourseSelect = () => (
    <>
      <TextField select label="Course *" {...f('course_id')}>
        <MenuItem value=""><em>Select course</em></MenuItem>
        {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
      </TextField>
      {isMarathi && (
        <Typography variant="caption" color="primary" sx={{ display: 'block', mt: -1.5, mb: 1, ml: 1, fontWeight: 700 }}>
          ⌨️ Marathi Kruti Dev 010 font active
        </Typography>
      )}
    </>
  );

  const DifficultySelect = () => (
    <TextField select label="Difficulty Level" {...f('difficulty')}>
      <MenuItem value=""><em>Select (optional)</em></MenuItem>
      <MenuItem value="beginner">Beginner</MenuItem>
      <MenuItem value="intermediate">Intermediate</MenuItem>
      <MenuItem value="advanced">Advanced</MenuItem>
    </TextField>
  );

  const StatusField = () => editingItem ? (
    <TextField select label="Status" fullWidth size="small"
      value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value })}>
      <MenuItem value="true">Active</MenuItem>
      <MenuItem value="false">Inactive</MenuItem>
    </TextField>
  ) : null;

  // ─── Render Form ─────────────────────────────────────────────────────────

  const renderForm = () => {
    switch (currentType) {
      case 'keyboard_lessons':
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Lesson No. *" type="number" {...f('lesson_number', { width: 140 })} />
              <TextField label="Lesson Title *" {...f('title')} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DifficultySelect />
              <TextField label="Target Keys" {...f('target_keys')} helperText="e.g. A, S, D, F" />
            </Box>
            <TextField label="Lesson Content *" multiline rows={6} {...f('content_text')} placeholder="Enter practice text" />
            <StatusField />
          </Stack>
        );
      case 'speed_passages':
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Passage Title *" {...f('title')} fullWidth />
              <DifficultySelect />
            </Box>
            <TextField label="Passage Text *" multiline rows={9} {...f('passage_text')}
              placeholder={"Para 1 text here...\n\nPara 2 text here...\n\n(Blank line between paragraphs)"}
              helperText={`${form.passage_text.trim() ? form.passage_text.trim().split(/\s+/).filter(Boolean).length : 0} words`}
            />
            <StatusField />
          </Stack>
        );
      case 'letter_templates': {
        const lf = (fld: keyof typeof EMPTY_FORM, lbl: string, rows = 1, hint = '') => (
          <TextField label={lbl} size="small" fullWidth multiline={rows > 1} rows={rows > 1 ? rows : undefined}
            value={form[fld]} onChange={e => setForm({ ...form, [fld]: e.target.value })}
            helperText={hint || undefined}
            sx={isMarathi ? { '& .MuiInputBase-input': { fontFamily: '"Kruti Dev 010", Arial, sans-serif', fontSize: '18px' } } : undefined} />
        );
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Template Title *" {...f('title')} fullWidth />
              <DifficultySelect />
            </Box>
            <Divider><Typography variant="caption" color="text.secondary">LETTERHEAD</Typography></Divider>
            {lf('letterhead', 'Letter Head / Heading', 2, 'Top center — usually ALL CAPS, bold')}
            {lf('sender_address', "Sender's Address", 2)}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {lf('ref_number', 'Ref. No.')} {lf('date', 'Date')}
            </Box>
            <Divider><Typography variant="caption" color="text.secondary">RECIPIENT</Typography></Divider>
            {lf('receiver_address', 'Inside Address (Receiver)', 3)}
            {lf('letter_subject', 'Subject (Bold)')}
            {lf('reference_line', 'Reference Line (optional)')}
            {lf('salutation', 'Salutation', 1, 'e.g. "Sir,"')}
            <Divider><Typography variant="caption" color="text.secondary">BODY</Typography></Divider>
            {lf('body_para_1', 'Body — Paragraph 1 *', 4)}
            {lf('body_para_2', 'Body — Paragraph 2 (optional)', 4)}
            {lf('body_para_3', 'Body — Paragraph 3 / Conclusion (optional)', 3)}
            <Divider><Typography variant="caption" color="text.secondary">CLOSING</Typography></Divider>
            {lf('complimentary_close', 'Complimentary Close')}
            {lf('subscription', 'Subscription (Right aligned)')}
            {lf('designation', 'Signature / Designation (optional)')}
            {lf('enclosure', 'Enclosure (optional)')}
            <StatusField />
          </Stack>
        );
      }
      case 'statement_templates': {
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <TextField label="Statement Title *" {...f('title')} helperText="Leave blank to use the first cell of the Excel sheet as title" />
            <Paper
              variant="outlined"
              sx={{
                p: 4, textAlign: 'center', borderStyle: 'dashed', cursor: 'pointer',
                borderColor: form.template_content ? 'success.main' : 'primary.300',
                bgcolor: form.template_content ? 'success.50' : 'grey.50',
                '&:hover': { bgcolor: form.template_content ? 'success.50' : 'primary.50' },
                transition: 'background .2s',
              }}
              onClick={() => stmtFileRef.current?.click()}
            >
              <input
                ref={stmtFileRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const { utils, read } = await import('xlsx');
                  const ab = await file.arrayBuffer();
                  const wb = read(ab, { cellStyles: true, cellFormula: false });
                  const sheet = wb.Sheets[wb.SheetNames[0]];
                  const data = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
                  const merges = sheet['!merges'] ?? [];
                  const styles: Record<string, any> = {};
                  const range = utils.decode_range(sheet['!ref'] ?? 'A1');
                  for (let r = range.s.r; r <= range.e.r; r++) {
                    for (let c = range.s.c; c <= range.e.c; c++) {
                      const cell = sheet[utils.encode_cell({ r, c })];
                      if (!cell?.s) continue;
                      const st: any = {};
                      if (cell.s.bold) st.bold = true;
                      if (cell.s.alignment?.horizontal) st.align = cell.s.alignment.horizontal;
                      if (Object.keys(st).length) styles[`${r}:${c}`] = st;
                    }
                  }
                  setForm(prev => ({
                    ...prev,
                    template_content: JSON.stringify({ data, merges, styles }),
                    title: prev.title || String((data as any[][])[0]?.[0] ?? '').trim() || file.name.replace(/\.[^.]+$/, ''),
                  }));
                  showSnackbar(`Loaded ${(data as any[]).length} rows × ${(data as any[][])[0]?.length ?? 0} columns from ${file.name}`, 'success');
                  e.target.value = '';
                }}
              />
              <UploadFile sx={{ fontSize: 40, mb: 1, color: form.template_content ? 'success.main' : 'primary.main' }} />
              <Typography variant="body2" fontWeight={600} color={form.template_content ? 'success.dark' : 'text.primary'}>
                {form.template_content
                  ? `✓ Excel loaded — click to replace`
                  : 'Click to upload Excel (.xlsx) *'}
              </Typography>
              {!form.template_content && (
                <Typography variant="caption" color="text.secondary">
                  Upload any normal Excel file — the entire sheet becomes the practice grid
                </Typography>
              )}
            </Paper>
            <StatusField />
          </Stack>
        );
      }
      case 'email_templates':
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <TextField label="Template Title *" {...f('title')} />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="primary" fontWeight={700} sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                Email Header Fields
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <TextField label="Mail To (email address)" {...f('mail_to')} helperText="e.g. recipient@example.com" />
                <TextField label="Subject *" {...f('subject')} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField label="CC" {...f('cc')} helperText="Multiple: comma-separated" />
                  <TextField label="BCC" {...f('bcc')} helperText="Multiple: comma-separated" />
                </Box>
              </Stack>
            </Paper>
            <TextField label="Mail Body *" multiline rows={8} {...f('body')}
              placeholder={"Dear Sir,\n\nBody paragraph 1...\n\nYours faithfully,\nName"}
              helperText="Use a blank line between paragraphs" />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="primary" fontWeight={700} sx={{ letterSpacing: 1, textTransform: 'uppercase' }}>
                Attachments (optional, up to 3)
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                <TextField label="Attachment 1 filename" {...f('attachment_1')} />
                <TextField label="Attachment 2 filename" {...f('attachment_2')} />
                <TextField label="Attachment 3 filename" {...f('attachment_3')} />
              </Stack>
            </Paper>
            <StatusField />
          </Stack>
        );
      case 'mcq_question_bank':
        return (
          <Stack spacing={2}>
            <CourseSelect />
            <TextField label="Question *" multiline rows={2} {...f('question')} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="Option A *" {...f('option_a')} />
              <TextField label="Option B *" {...f('option_b')} />
              <TextField label="Option C *" {...f('option_c')} />
              <TextField label="Option D *" {...f('option_d')} />
            </Box>
            <TextField select label="Correct Answer *" {...f('correct_answer')}>
              <MenuItem value=""><em>Select answer</em></MenuItem>
              {['a', 'b', 'c', 'd'].map(o => <MenuItem key={o} value={o}>Option {o.toUpperCase()}</MenuItem>)}
            </TextField>
            <TextField label="Explanation" multiline rows={2} {...f('explanation')} helperText="Optional — shown after student answers" />
            <StatusField />
          </Stack>
        );
    }
  };

  const filtered = items.filter(it =>
    [it.title, it.course_name].join(' ').toLowerCase().includes(search.toLowerCase()));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout menuItems={superAdminMenuItems} title="Super Admin Panel">

      {/* ══ Page Header ══ */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Practice Content</Typography>
          <Typography variant="body2" color="text.secondary">
            Select a course to view and manage its practice content
          </Typography>
        </Box>
        {selectedCourseId && (
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => { setSelectedCourseId(''); setItems([]); }}>
            Change Course
          </Button>
        )}
      </Box>

      {/* ══ Step 1: Course Selector ══ */}
      {!selectedCourseId ? (
        <Box>
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <School color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6" fontWeight={700} color="primary.main">Step 1: Select a Course</Typography>
                <Typography variant="body2" color="text.secondary">
                  Choose a course to view and manage its keyboard lessons, speed passages, letters, statements, emails and MCQs.
                </Typography>
              </Box>
            </Box>
          </Paper>

          {courses.length === 0 ? (
            <Stack spacing={1}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} height={80} variant="rectangular" sx={{ borderRadius: 2 }} />)}
            </Stack>
          ) : (
            <Grid container spacing={2}>
              {courses.map(course => {
                const isMarathiC = course.language_name?.toLowerCase().includes('marathi') ||
                  course.name?.toLowerCase().includes('marathi');
                return (
                  <Grid item xs={12} sm={6} md={4} key={course.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all .2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: '0 4px 20px rgba(59,130,246,0.15)',
                          transform: 'translateY(-2px)',
                        }
                      }}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setForm(f => ({ ...f, course_id: course.id }));
                      }}
                    >
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{
                          bgcolor: isMarathiC ? '#f59e0b' : 'primary.main',
                          width: 48, height: 48, fontWeight: 700, fontSize: 18
                        }}>
                          {course.code.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="subtitle1" fontWeight={700} noWrap>{course.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{course.code}</Typography>
                          {isMarathiC && (
                            <Chip size="small" label="मराठी" sx={{ mt: 0.5, bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
                          )}
                        </Box>
                        {course.language_name && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Language fontSize="small" color="disabled" />
                            <Typography variant="caption" color="text.secondary">{course.language_name}</Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Box>
      ) : (
        /* ══ Step 2: Content View for Selected Course ══ */
        <Box>
          {/* Course Banner */}
          <Paper sx={{
            p: 2.5, mb: 3, borderRadius: 2,
            background: `linear-gradient(135deg, ${isMarathiCourse ? '#f59e0b22' : '#3b82f622'}, ${isMarathiCourse ? '#f59e0b08' : '#3b82f608'})`,
            border: `1.5px solid ${isMarathiCourse ? '#f59e0b44' : '#3b82f644'}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: isMarathiCourse ? '#f59e0b' : 'primary.main', width: 44, height: 44, fontWeight: 700 }}>
                {selectedCourse?.code.slice(0, 2).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedCourse?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCourse?.code}
                  {selectedCourse?.language_name && ` · ${selectedCourse.language_name}`}
                </Typography>
              </Box>
              {isMarathiCourse && <Chip size="small" label="⌨️ Marathi Font Mode" color="warning" sx={{ fontWeight: 700 }} />}
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Refresh">
                <Button variant="outlined" size="small" startIcon={<Refresh />}
                  onClick={() => fetchItems(currentType, selectedCourseId)}>Refresh</Button>
              </Tooltip>
              {currentSection.bulkUpload && (
                <>
                  <Button variant="outlined" size="small" color="secondary" startIcon={<Download />} onClick={downloadTemplate}>
                    Template
                  </Button>
                  <Button variant="outlined" size="small" color="success" startIcon={<UploadFile />} onClick={openUpload}>
                    Bulk Upload
                  </Button>
                </>
              )}
              <Button variant="contained" size="small" startIcon={<Add />}
                onClick={() => { setForm({ ...EMPTY_FORM, course_id: selectedCourseId }); setEditingItem(null); setDialogOpen(true); }}>
                Add {currentSection.label.replace(/s$/, '')}
              </Button>
            </Stack>
          </Paper>

          {/* Section Tabs */}
          <Paper variant="outlined" sx={{ borderRadius: 2, mb: 2, overflow: 'hidden' }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': { minHeight: 56, textTransform: 'none', fontWeight: 600, fontSize: 13 },
                '& .Mui-selected': { fontWeight: 700 },
              }}
            >
              {SECTIONS.map((s, i) => (
                <Tab
                  key={i}
                  label={s.label}
                  icon={s.icon}
                  iconPosition="start"
                  sx={{ color: tab === i ? s.color : 'text.secondary' }}
                />
              ))}
            </Tabs>
          </Paper>

          {/* Search */}
          <TextField
            size="small" placeholder="Search content…" value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ mb: 2, width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />

          {/* Data Grid */}
          {loading ? (
            <Stack spacing={1}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height={52} variant="rectangular" sx={{ borderRadius: 1 }} />)}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              {filtered.length === 0 && !loading ? (
                <Box sx={{ py: 8, textAlign: 'center' }}>
                  <Box sx={{ fontSize: 48, mb: 1 }}>📂</Box>
                  <Typography variant="h6" color="text.secondary">No content yet</Typography>
                  <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                    Add your first {currentSection.label.toLowerCase()} for this course
                  </Typography>
                  <Button variant="contained" startIcon={<Add />}
                    onClick={() => { setForm({ ...EMPTY_FORM, course_id: selectedCourseId }); setEditingItem(null); setDialogOpen(true); }}>
                    Add {currentSection.label.replace(/s$/, '')}
                  </Button>
                </Box>
              ) : (
                <DataGrid
                  rows={filtered} columns={cols} autoHeight getRowId={r => r.id}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                />
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <School color="primary" fontSize="small" />
          {editingItem ? `Edit ${currentSection.label.replace(/s$/, '')}` : `Add ${currentSection.label.replace(/s$/, '')}`}
          {selectedCourse && (
            <Chip size="small" label={selectedCourse.name} sx={{ ml: 'auto' }} />
          )}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>{renderForm()}</DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} variant="outlined" disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Save Content'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Bulk Upload Dialog ── */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <UploadFile color="success" />
          <Box>
            <Typography component="span" display="block" fontWeight={700}>
              Bulk Upload — {currentSection.label}
            </Typography>
            <Typography component="span" display="block" variant="body2" color="text.secondary">
              Upload an Excel (.xlsx) file to import multiple records at once
            </Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2.5}>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
              {currentType === 'statement_templates' ? (
                <>
                  <Typography variant="body2" fontWeight={700} color="info.dark" gutterBottom>
                    How it works:
                  </Typography>
                  <Typography variant="body2" color="info.dark">
                    Upload any normal Excel file (.xlsx). The entire sheet is automatically converted into the practice grid — no manual JSON required.
                  </Typography>
                  <Typography variant="body2" color="info.dark" sx={{ mt: 1 }}>
                    Merges, bold formatting, and alignment are preserved automatically.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2" fontWeight={700} color="info.dark" gutterBottom>
                    Required Columns in Excel:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                    {(TEMPLATE_HEADERS[currentType] ?? []).map(h => (
                      <Chip key={h} label={h} size="small" variant="outlined" color="info" />
                    ))}
                  </Box>
                  <Button size="small" startIcon={<Download />} onClick={downloadTemplate} sx={{ mt: 1.5 }}>
                    Download blank template
                  </Button>
                </>
              )}
            </Paper>

            <TextField select label="Course *" size="small" fullWidth
              value={uploadCourseId} onChange={e => setUploadCourseId(e.target.value)}>
              <MenuItem value=""><em>Select course</em></MenuItem>
              {courses.map(c => <MenuItem key={c.id} value={c.id}>{c.name} ({c.code})</MenuItem>)}
            </TextField>

            {currentType === 'statement_templates' && (
              <TextField
                label="Statement Title (optional)"
                size="small"
                fullWidth
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                helperText="Leave blank to use the first cell of the Excel sheet as title"
              />
            )}

            <Paper variant="outlined" onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 3, textAlign: 'center', cursor: 'pointer', borderRadius: 2,
                borderStyle: 'dashed', borderColor: 'primary.300',
                bgcolor: uploadFile ? 'success.50' : 'grey.50',
                '&:hover': { bgcolor: 'primary.50' }, transition: 'background .2s',
              }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden
                onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadResult(null); }} />
              <UploadFile sx={{ fontSize: 40, color: uploadFile ? 'success.main' : 'primary.main', mb: 1 }} />
              {uploadFile
                ? <Typography fontWeight={600} color="success.main">{uploadFile.name}</Typography>
                : <><Typography fontWeight={600}>Click to select Excel file</Typography>
                  <Typography variant="body2" color="text.secondary">.xlsx, .xls, or .csv supported</Typography></>}
            </Paper>

            {uploading && <LinearProgress />}

            {uploadResult && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: uploadResult.errors.length > 0 ? 'warning.50' : 'success.50' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckCircle color="success" />
                  <Typography fontWeight={700} color="success.dark">{uploadResult.inserted} record(s) imported successfully.</Typography>
                </Box>
                {uploadResult.errors.length > 0 && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                      onClick={() => setErrorsExpanded(e => !e)}>
                      <ErrorOutline color="error" />
                      <Typography color="error.main" fontWeight={600}>{uploadResult.errors.length} row(s) had errors.</Typography>
                      {errorsExpanded ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                    <Collapse in={errorsExpanded}>
                      <List dense sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                        {uploadResult.errors.map((e, i) => (
                          <ListItem key={i} sx={{ py: 0 }}>
                            <ListItemText primary={e} primaryTypographyProps={{ variant: 'caption', color: 'error.main' }} />
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </>
                )}
              </Paper>
            )}
          </Stack>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setUploadOpen(false)} variant="outlined">Close</Button>
          <Button variant="contained" color="success" startIcon={<UploadFile />}
            onClick={handleUpload} disabled={uploading || !uploadFile || !uploadCourseId}>
            {uploading ? 'Importing…' : 'Import Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000}
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
