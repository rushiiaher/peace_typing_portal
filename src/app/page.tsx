'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Box, Container, Typography, Grid, Card, CardActionArea, Stack, Chip } from '@mui/material';
import { AdminPanelSettings, Business, Person, ArrowForward } from '@mui/icons-material';

const portals = [
  {
    href: '/superadmin/login',
    icon: <AdminPanelSettings sx={{ fontSize: 36 }} />,
    label: 'Super Admin',
    description: 'Manage the entire platform, institutes, courses & reports',
    color: '#1a1a2e',
    bg: '#f1f5f9',
    iconBg: '#1a1a2e',
    badge: 'Platform Management',
  },
  {
    href: '/institute/login',
    icon: <Business sx={{ fontSize: 36 }} />,
    label: 'Institute Admin',
    description: 'Manage students, batches, exams & institute payments',
    color: '#1e40af',
    bg: '#eff6ff',
    iconBg: '#2563eb',
    badge: 'Institute Management',
  },
  {
    href: '/student/login',
    icon: <Person sx={{ fontSize: 36 }} />,
    label: 'Student',
    description: 'Access your typing courses, practice sessions & exams',
    color: '#065f46',
    bg: '#f0fdf4',
    iconBg: '#059669',
    badge: 'Learning Portal',
  },
];

export default function Home() {
  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: '#0f172a',
      p: 3,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <Box sx={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(37,99,235,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(245,158,11,0.08) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Logo & Brand */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            p: 1.5, borderRadius: '50%', bgcolor: 'white',
            boxShadow: '0 0 0 4px rgba(245,158,11,0.3), 0 0 0 8px rgba(245,158,11,0.1)',
            mb: 3,
          }}>
            <Image
              src="/Peacexperts_LOGO.png"
              alt="Peacexperts Logo"
              width={90}
              height={90}
              style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          </Box>
          <Typography variant="h3" fontWeight={900} color="white" gutterBottom>
            PEACEXPERTS
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1 }}>
            Pvt. Ltd. · Affiliated with MCA (Govt. of India)
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>
            Select your portal to continue
          </Typography>
        </Box>

        {/* Portal Cards */}
        <Grid container spacing={3} alignItems="stretch">
          {portals.map((p) => (
            <Grid item xs={12} md={4} key={p.href} sx={{ display: 'flex' }}>
              <Card elevation={0} sx={{
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(10px)',
                width: '100%',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                },
              }}>
                <CardActionArea component={Link} href={p.href} sx={{ p: 3.5, borderRadius: 4, height: '100%' }}>
                  <Stack spacing={2.5} alignItems="center" sx={{ textAlign: 'center' }}>
                    <Box sx={{
                      width: 60, height: 60, borderRadius: 3,
                      bgcolor: p.iconBg, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.icon}
                    </Box>
                    <Box>
                      <Chip
                        label={p.badge}
                        size="small"
                        sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}
                      />
                      <Typography variant="h6" fontWeight={800} color="white" gutterBottom>
                        {p.label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                        {p.description}
                      </Typography>
                    </Box>
                    <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      <Typography variant="caption" fontWeight={700}>Sign In</Typography>
                      <ArrowForward sx={{ fontSize: 14 }} />
                    </Stack>
                  </Stack>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(255,255,255,0.25)', mt: 6 }}>
          © 2025 Peacexperts Pvt. Ltd. · Typing Portal · All rights reserved
        </Typography>
      </Container>
    </Box>
  );
}
