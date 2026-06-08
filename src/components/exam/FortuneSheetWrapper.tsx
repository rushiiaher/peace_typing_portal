'use client';

import dynamic from 'next/dynamic';
import '@fortune-sheet/react/dist/index.css';
import { Box, Typography } from '@mui/material';

// FortuneSheet relies heavily on window/document. Must disable SSR.
const Workbook = dynamic(() => import('@fortune-sheet/react').then(mod => mod.Workbook), {
    ssr: false,
    loading: () => <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}><Typography>Loading Excel Editor...</Typography></Box>
});

interface FortuneSheetWrapperProps {
    data: any; // FortuneSheet cell data array
    onChange?: (data: any) => void;
    readOnly?: boolean;
}

export default function FortuneSheetWrapper({ data, onChange, readOnly = false }: FortuneSheetWrapperProps) {
    const defaultSettings = {
        data,
        lang: 'en',
        showToolbar: !readOnly,
        showGridHeading: true,
        showBottomBar: false,
        showStatisticBar: !readOnly,
        sheetFormulaBar: !readOnly,
        allowEdit: !readOnly,
        enableAddRow: !readOnly,
        enableAddBackTop: false,
        column: 20,
        row: 50,
        hook: {
            updated: (updatedData: any) => {
                if (onChange && !readOnly) {
                    onChange(updatedData);
                }
            }
        }
    };

    return (
        <Box sx={{ width: '100%', height: '500px', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
            <Workbook {...defaultSettings} />
        </Box>
    );
}
