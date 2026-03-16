'use client';

import { useState } from 'react';
import { Button, TextField, Paper, Typography, Box } from '@mui/material';

interface WritingPracticeProps {
    title: string;
    template?: string;
    sample?: string;
    type: 'Letter' | 'Statement';
    onComplete: (content: string) => void;
}

export default function WritingPractice({ title, template, sample, type, onComplete }: WritingPracticeProps) {
    const [content, setContent] = useState(template || '');

    const handleSubmit = () => {
        onComplete(content);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Paper elevation={1} className="p-6 bg-blue-50 dark:bg-zinc-800">
                <Typography variant="h6" gutterBottom color="primary">Task: {title}</Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    {type === 'Letter' ? 'Write a letter based on the following template/instructions.' : 'Prepare the statement as per the sample below.'}
                </Typography>

                {sample && (
                    <Box className="mt-4 p-4 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
                        <Typography variant="subtitle2" gutterBottom>Sample Reference:</Typography>
                        <pre className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400 font-mono">{sample}</pre>
                    </Box>
                )}
            </Paper>

            <Paper elevation={3} className="p-6">
                <TextField
                    fullWidth
                    multiline
                    minRows={15}
                    variant="outlined"
                    placeholder="Start typing here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    sx={{ fontFamily: 'monospace' }}
                />

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button variant="outlined" color="secondary">Save Draft</Button>
                    <Button variant="contained" color="primary" onClick={handleSubmit}>Submit</Button>
                </Box>
            </Paper>
        </div>
    );
}
