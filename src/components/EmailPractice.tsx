'use client';

import { useState } from 'react';
import { Button, TextField, Paper, Typography, Box, InputAdornment } from '@mui/material';

interface EmailPracticeProps {
    scenario: string;
    defaultSubject?: string;
    onComplete: (email: { to: string, subject: string, body: string }) => void;
}

export default function EmailPractice({ scenario, defaultSubject, onComplete }: EmailPracticeProps) {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState(defaultSubject || '');
    const [body, setBody] = useState('');

    const handleSend = () => {
        onComplete({ to, subject, body });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Paper elevation={1} className="p-6 bg-yellow-50 dark:bg-yellow-900/20">
                <Typography variant="subtitle1" gutterBottom className="font-bold">Scenario:</Typography>
                <Typography variant="body2">{scenario}</Typography>
            </Paper>

            <Paper elevation={3} className="overflow-hidden rounded-lg">
                <Box className="bg-zinc-100 dark:bg-zinc-800 p-2 border-b border-zinc-200 dark:border-zinc-700 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                    New Message
                </Box>
                <Box className="p-6 space-y-4">
                    <TextField
                        fullWidth
                        variant="standard"
                        placeholder="To"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        InputProps={{ disableUnderline: false }}
                    />
                    <TextField
                        fullWidth
                        variant="standard"
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        InputProps={{ disableUnderline: false }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        minRows={12}
                        variant="standard" // 'standard' looks more like a plain text area
                        placeholder=""
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        InputProps={{ disableUnderline: true }}
                        sx={{ mt: 2 }}
                    />
                </Box>
                <Box className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                    <div className="flex gap-2">
                        {/* Formatting toolbar simulation */}
                        <Button size="small" sx={{ minWidth: 30 }}>A</Button>
                        <Button size="small" sx={{ minWidth: 30 }}>B</Button>
                        <Button size="small" sx={{ minWidth: 30 }}>I</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outlined" size="small">Discard</Button>
                        <Button variant="contained" color="primary" onClick={handleSend}>Send</Button>
                    </div>
                </Box>
            </Paper>
        </div>
    );
}
