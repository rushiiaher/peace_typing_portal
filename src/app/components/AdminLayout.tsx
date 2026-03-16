'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, AppBar, Typography, IconButton, Tooltip,
} from '@mui/material';
import { Logout, Menu as MenuIcon, ChevronLeft } from '@mui/icons-material';
import { createClient } from '@/utils/supabase/client';

interface MenuItem {
  text: string;
  icon: ReactNode;
  href: string;
}

interface AdminLayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  title: string;
}

const DRAWER_OPEN = 240;
const DRAWER_CLOSED = 64;

export default function AdminLayout({ children, menuItems, title }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);

  const drawerWidth = open ? DRAWER_OPEN : DRAWER_CLOSED;

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (!mounted) return null;

  return (
    <Box sx={{ display: 'flex' }}>
      {/* ── Top Navbar ── */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#1a1a2e', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
        <Toolbar sx={{ gap: 1.5 }}>
          {/* Sidebar toggle */}
          <Tooltip title={open ? 'Collapse menu' : 'Expand menu'}>
            <IconButton
              color="inherit"
              onClick={() => setOpen(o => !o)}
              sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }, mr: 0.5 }}
            >
              {open ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>
          </Tooltip>

          <Image
            src="/Peacexperts_LOGO.png"
            alt="Peacexperts Logo"
            width={38}
            height={38}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1} color="white">
              PEACEXPERTS
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>
              {title}
            </Typography>
          </Box>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
              <Logout />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar Drawer ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#f8fafc',
            borderRight: '1px solid #e2e8f0',
            overflowX: 'hidden',
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
          },
        }}
      >
        <Toolbar />

        {/* "MENU" section label — only visible when open */}
        {open && (
          <Box sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ color: '#94a3b8', fontWeight: 800, letterSpacing: 1.5, fontSize: 10, textTransform: 'uppercase' }}
            >
              Menu
            </Typography>
          </Box>
        )}

        <Box sx={{ overflowX: 'hidden', overflowY: 'auto', pt: 0.5, flexGrow: 1, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px' } }}>
          <List dense>
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <ListItem key={item.text} disablePadding sx={{ px: 1, mb: 0.5 }}>
                  <Tooltip title={!open ? item.text : ''} placement="right">
                    <ListItemButton
                      component={Link}
                      href={item.href}
                      selected={isActive}
                      sx={{
                        borderRadius: 2,
                        minHeight: 44,
                        justifyContent: open ? 'initial' : 'center',
                        px: open ? 1.5 : 1,
                        '&.Mui-selected': {
                          bgcolor: '#eff6ff',
                          color: 'primary.main',
                          '& .MuiListItemIcon-root': { color: 'primary.main' },
                        },
                        '&:hover': { bgcolor: '#f1f5f9' },
                        transition: 'all 0.2s',
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: open ? 36 : 'unset',
                          justifyContent: 'center',
                          color: isActive ? 'primary.main' : '#64748b',
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      {open && (
                        <ListItemText
                          primary={item.text}
                          primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500, noWrap: true }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* ── Main content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          bgcolor: '#f1f5f9',
          minHeight: '100vh',
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
