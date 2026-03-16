'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Menu, MenuItem, IconButton, Typography, Box } from '@mui/material';
import { Logout, Person } from '@mui/icons-material';
import { createClient } from '@/utils/supabase/client';

export default function StudentHeader() {
    const router = useRouter();
    const supabase = createClient();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <header className="h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 sticky top-0 z-10 ml-64">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                Welcome Back, Student
            </h2>

            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Student Name</p>
                    <p className="text-xs text-zinc-500">student@example.com</p>
                </div>

                <Box>
                    <IconButton
                        size="large"
                        aria-label="account of current user"
                        aria-controls="menu-appbar"
                        aria-haspopup="true"
                        onClick={handleMenu}
                        color="inherit"
                    >
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>S</Avatar>
                    </IconButton>
                    <Menu
                        id="menu-appbar"
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                    >
                        <MenuItem onClick={handleClose}>
                            <Person fontSize="small" sx={{ mr: 1.5 }} /> Profile
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <Logout fontSize="small" sx={{ mr: 1.5 }} /> Logout
                        </MenuItem>
                    </Menu>
                </Box>
            </div>
        </header>
    );
}
