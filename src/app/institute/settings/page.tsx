'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    Snackbar, Alert, Divider, Paper, IconButton, InputBase, Chip,
} from '@mui/material';
import { Computer, Settings, DeleteOutline, Add } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

interface System { id: string; system_name: string; }

export default function InstituteSettingsPage() {
    const [systems, setSystems] = useState<System[]>([]);
    const [loading, setLoading] = useState(true);
    const [manageOpen, setManageOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>
        ({ open: false, message: '', severity: 'success' });
    const showSnackbar = (msg: string, sev: 'success' | 'error') =>
        setSnackbar({ open: true, message: msg, severity: sev });

    const fetchSystems = useCallback(async () => {
        setLoading(true);
        const res = await fetch('/api/institute/systems');
        const j = await res.json();
        if (res.ok) {
            setSystems(j.systems ?? []);
        } else {
            showSnackbar(`Error ${res.status}: ${j.error}`, 'error');
            console.error('[settings] fetch error:', res.status, j.error);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchSystems(); }, [fetchSystems]);

    /* ── Add ── */
    const handleAdd = async () => {
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const res = await fetch('/api/institute/systems', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_name: newName.trim() }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setNewName('');
            fetchSystems();
            inputRef.current?.focus();
        } catch (e: any) { showSnackbar(e.message, 'error'); }
        finally { setAdding(false); }
    };

    /* ── Delete ── */
    const handleDelete = async (s: System) => {
        const res = await fetch(`/api/institute/systems?id=${s.id}`, { method: 'DELETE' });
        if (res.ok) { fetchSystems(); }
        else { const j = await res.json(); showSnackbar(j.error, 'error'); }
    };

    /* ─────────────────────────── Render ── */
    return (
        <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">

            {/* ── Exam Systems card ── */}
            <Paper
                variant="outlined"
                sx={{
                    maxWidth: 600,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1.5px solid',
                    borderColor: 'primary.100',
                }}
            >
                {/* Card header */}
                <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{
                        width: 44, height: 44, borderRadius: 2,
                        bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2,
                    }}>
                        <Computer sx={{ color: 'primary.main', fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Exam Systems</Typography>
                        <Typography variant="body2" color="text.secondary">Manage exam terminals</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setManageOpen(true)}>
                        <Settings fontSize="small" />
                    </IconButton>
                </Box>

                {/* Body */}
                <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
                    {/* Count row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={500}>Total Systems</Typography>
                        <Chip
                            label={systems.length}
                            size="small"
                            sx={{ fontWeight: 700, bgcolor: 'grey.100', color: 'text.primary', minWidth: 32, borderRadius: 2 }}
                        />
                    </Box>

                    {/* Grid of system chips */}
                    {loading
                        ? <Typography variant="body2" color="text.disabled">Loading…</Typography>
                        : systems.length === 0
                            ? <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 3 }}>
                                No systems added yet. Click "Manage Systems" to add.
                            </Typography>
                            : <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
                                {systems.map(s => (
                                    <Paper
                                        key={s.id}
                                        variant="outlined"
                                        sx={{
                                            px: 2, py: 1,
                                            borderRadius: 2,
                                            display: 'flex', alignItems: 'center',
                                            fontWeight: 600, fontSize: 14,
                                            cursor: 'default',
                                            transition: 'box-shadow .15s',
                                            '&:hover': { boxShadow: 2 },
                                        }}
                                    >
                                        {s.system_name}
                                    </Paper>
                                ))}
                            </Box>}
                </Box>

                {/* Footer button */}
                <Divider />
                <Button
                    fullWidth
                    variant="text"
                    onClick={() => setManageOpen(true)}
                    sx={{
                        py: 1.5, fontWeight: 600, fontSize: 15,
                        color: 'text.primary', borderRadius: 0,
                        '&:hover': { bgcolor: 'grey.50' },
                    }}
                >
                    Manage Systems
                </Button>
            </Paper>

            {/* ════ Manage Dialog ════ */}
            <Dialog
                open={manageOpen}
                onClose={() => setManageOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ pb: 0.5 }}>
                    <Typography variant="h6" fontWeight={700} component="span" display="block">Manage Exam Systems</Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                        Add or remove computer terminals available for exams.
                    </Typography>
                </DialogTitle>

                <DialogContent sx={{ pt: 2.5 }}>
                    {/* Add input row */}
                    <Box sx={{
                        display: 'flex', gap: 1, mb: 3,
                        border: '1.5px solid', borderColor: 'grey.300',
                        borderRadius: 2, overflow: 'hidden',
                        '&:focus-within': { borderColor: 'primary.main' },
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', pl: 1.5, color: 'text.disabled' }}>
                            <Computer fontSize="small" />
                        </Box>
                        <InputBase
                            inputRef={inputRef}
                            fullWidth
                            placeholder="Enter system identifier (e.g., Lab-A-01)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                            sx={{ px: 1, py: 1, fontSize: 14 }}
                        />
                        <Button
                            variant="contained"
                            disableElevation
                            startIcon={<Add />}
                            onClick={handleAdd}
                            disabled={adding || !newName.trim()}
                            sx={{
                                borderRadius: 0, px: 2.5, fontWeight: 700,
                                bgcolor: '#2e7d60', '&:hover': { bgcolor: '#245f4a' },
                                whiteSpace: 'nowrap', minWidth: 130,
                            }}
                        >
                            Add System
                        </Button>
                    </Box>

                    {/* List */}
                    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                        {/* Header row */}
                        <Box sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: 2, py: 1, bgcolor: 'grey.50',
                            borderBottom: '1px solid', borderColor: 'divider',
                        }}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.8}>
                                SYSTEM NAME
                            </Typography>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.8}>
                                ACTION
                            </Typography>
                        </Box>

                        {/* Rows */}
                        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                            {systems.length === 0
                                ? <Box sx={{ py: 4, textAlign: 'center' }}>
                                    <Typography variant="body2" color="text.disabled">No systems added yet.</Typography>
                                </Box>
                                : systems.map((s, i) => (
                                    <Box
                                        key={s.id}
                                        sx={{
                                            display: 'flex', alignItems: 'center',
                                            px: 2, py: 1.2,
                                            borderBottom: i < systems.length - 1 ? '1px solid' : 'none',
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'grey.50' },
                                        }}
                                    >
                                        {/* Number badge */}
                                        <Box sx={{
                                            width: 26, height: 26, borderRadius: 1.5,
                                            bgcolor: 'grey.100', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', mr: 2, flexShrink: 0,
                                        }}>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary">{i + 1}</Typography>
                                        </Box>

                                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                                            {s.system_name}
                                        </Typography>

                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(s)}
                                            sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.50' } }}
                                        >
                                            <DeleteOutline fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))}
                        </Box>

                        {/* Footer count */}
                        <Box sx={{
                            px: 2, py: 1, bgcolor: 'grey.50',
                            borderTop: '1px solid', borderColor: 'divider',
                            textAlign: 'center',
                        }}>
                            <Typography variant="caption" color="text.secondary">
                                Total: {systems.length} system{systems.length !== 1 ? 's' : ''}
                            </Typography>
                        </Box>
                    </Paper>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button variant="outlined" onClick={() => setManageOpen(false)} sx={{ px: 3 }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

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
