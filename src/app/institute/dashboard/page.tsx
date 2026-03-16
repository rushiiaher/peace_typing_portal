'use client';

import { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Divider,
  Avatar, Skeleton, Alert, Stack,
} from '@mui/material';
import {
  Business, Person, Email, Phone, LocationOn,
  People, School, CheckCircle, Badge,
} from '@mui/icons-material';
import AdminLayout from '../../components/AdminLayout';
import { instituteAdminMenuItems } from '../../components/menuItems';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InstituteInfo {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  institutes: InstituteInfo;
}

interface Stats {
  studentCount: number;
  batchCount: number;
  activeBatchCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 0.75 }}>
      <Box sx={{ color: 'text.secondary', mt: 0.3, flexShrink: 0 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value}</Typography>
      </Box>
    </Box>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{
          bgcolor: `${color}18`, color, borderRadius: 2,
          p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>{value}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InstituteDashboard() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/institute/my-info')
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setAdmin(data.admin);
        setStats(data.stats);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  const institute = admin?.institutes;

  return (
    <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">

      {/* ── Welcome Header ── */}
      <Box sx={{ mb: 4 }}>
        {loading ? (
          <Skeleton variant="text" width={360} height={44} />
        ) : (
          <Typography variant="h4" fontWeight={700}>
            Welcome back, {admin?.name?.split(' ')[0] ?? 'Admin'}/
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Here's an overview of your institute and profile.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ── Stats Row ── */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { icon: <People />, label: 'Total Students', value: stats?.studentCount ?? 0, color: '#6366f1' },
          { icon: <School />, label: 'Total Batches', value: stats?.batchCount ?? 0, color: '#f59e0b' },
          { icon: <CheckCircle />, label: 'Active Batches', value: stats?.activeBatchCount ?? 0, color: '#10b981' },
        ].map(s => (
          <Grid item xs={12} sm={4} key={s.label}>
            {loading
              ? <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 2 }} />
              : <StatCard {...s} />}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>

        {/* ── Admin Profile Card ── */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Badge color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={600}>My Profile</Typography>
                {loading ? null : (
                  <Chip
                    size="small"
                    label={admin?.is_active ? 'Active' : 'Inactive'}
                    color={admin?.is_active ? 'success' : 'default'}
                    variant="outlined"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Stack>

              {loading ? (
                <Stack spacing={1.5}>
                  {[...Array(4)].map((_, i) => <Skeleton key={i} height={40} />)}
                </Stack>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
                    <Avatar
                      sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 28, fontWeight: 700 }}
                    >
                      {admin?.name?.charAt(0).toUpperCase() ?? '?'}
                    </Avatar>
                  </Box>

                  <Typography variant="h6" fontWeight={600} textAlign="center" mb={0.5}>
                    {admin?.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mb={2}>
                    Institute Admin
                  </Typography>

                  <Divider sx={{ mb: 2 }} />

                  <InfoRow icon={<Email fontSize="small" />} label="Email" value={admin?.email} />
                  <InfoRow icon={<Phone fontSize="small" />} label="Phone" value={admin?.phone || 'Not provided'} />
                  <InfoRow
                    icon={<CheckCircle fontSize="small" />}
                    label="Member Since"
                    value={admin?.created_at ? new Date(admin.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Institute Details Card ── */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                <Business color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={600}>Assigned Institute</Typography>
                {loading ? null : (
                  <Chip
                    size="small"
                    label={institute?.is_active ? 'Active' : 'Inactive'}
                    color={institute?.is_active ? 'success' : 'default'}
                    variant="outlined"
                    sx={{ ml: 'auto' }}
                  />
                )}
              </Stack>

              {loading ? (
                <Stack spacing={1.5}>
                  {[...Array(6)].map((_, i) => <Skeleton key={i} height={40} />)}
                </Stack>
              ) : !institute ? (
                <Alert severity="warning">No institute is currently assigned to your account. Please contact the Super Admin.</Alert>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                    <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'primary.light' }}>
                      <Business sx={{ color: 'primary.contrastText' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{institute.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Code: {institute.code}</Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  <Grid container spacing={0.5}>
                    <Grid item xs={12} sm={6}>
                      <InfoRow icon={<Person fontSize="small" />} label="Contact Person" value={institute.contact_person} />
                      <InfoRow icon={<Email fontSize="small" />} label="Institute Email" value={institute.email} />
                      <InfoRow icon={<Phone fontSize="small" />} label="Institute Phone" value={institute.phone} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <InfoRow
                        icon={<LocationOn fontSize="small" />}
                        label="Address"
                        value={[institute.address, institute.city, institute.state, institute.pincode].filter(Boolean).join(', ')}
                      />
                      <InfoRow
                        icon={<CheckCircle fontSize="small" />}
                        label="Institute Since"
                        value={institute.created_at ? new Date(institute.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

      </Grid>
    </AdminLayout>
  );
}
