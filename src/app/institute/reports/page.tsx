'use client';

import { useState } from 'react';
import { Box, Button, Typography, Grid, Card, CardContent, CardActions, Snackbar, Alert, CircularProgress } from '@mui/material';
import { Download, Assessment } from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

const REPORTS = [
    { key: 'student-fee-status',  title: 'Student Fee Status',  description: 'View fee collection status for all students' },
    { key: 'batch-performance',   title: 'Batch Performance',   description: 'Analyze batch-wise student performance' },
    { key: 'monthly-revenue',     title: 'Monthly Revenue',     description: 'Monthly fee collection summary' },
    { key: 'outstanding-dues',    title: 'Outstanding Dues',    description: 'Students with pending payments' },
    { key: 'exam-schedule',       title: 'Exam Schedule',       description: 'Upcoming and completed exams' },
    { key: 'payment-history',     title: 'Payment History',     description: 'All payment transactions for this institute' },
];

export default function ReportsPage() {
    const [loading, setLoading] = useState<string>(''); // "key-pdf" or "key-excel"
    const [error, setError] = useState('');

    const download = async (key: string, format: 'pdf' | 'excel') => {
        const id = `${key}-${format}`;
        setLoading(id);
        setError('');
        try {
            const res = await fetch(`/api/institute/reports?type=${key}&format=${format}`);
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Export failed');
            }

            if (format === 'pdf') {
                const html = await res.text();
                const win = window.open('', '_blank');
                if (!win) { setError('Pop-up blocked — please allow pop-ups for this site.'); return; }
                win.document.write(html);
                win.document.close();
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const reportTitle = REPORTS.find(r => r.key === key)?.title ?? key;
                a.href = url;
                a.download = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading('');
        }
    };

    return (
        <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>Reports & Analytics</Typography>
                <Typography variant="body2" color="text.secondary">Generate and export reports for your institute</Typography>
            </Box>

            <Grid container spacing={3}>
                {REPORTS.map((report) => (
                    <Grid item xs={12} md={6} key={report.key}>
                        <Card variant="outlined">
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                    <Assessment color="primary" />
                                    <Typography variant="h6">{report.title}</Typography>
                                </Box>
                                <Typography color="text.secondary" variant="body2">{report.description}</Typography>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
                                <Button
                                    size="small" variant="outlined"
                                    startIcon={loading === `${report.key}-pdf` ? <CircularProgress size={14} /> : <Download />}
                                    disabled={!!loading}
                                    onClick={() => download(report.key, 'pdf')}
                                >
                                    PDF
                                </Button>
                                <Button
                                    size="small" variant="outlined"
                                    startIcon={loading === `${report.key}-excel` ? <CircularProgress size={14} /> : <Download />}
                                    disabled={!!loading}
                                    onClick={() => download(report.key, 'excel')}
                                >
                                    Excel
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
            </Snackbar>
        </AdminLayout>
    );
}
