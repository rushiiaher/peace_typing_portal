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
    isMarathi?: boolean;
    height?: number;
}

export default function FortuneSheetWrapper({ data, onChange, readOnly = false, isMarathi = false, height = 500 }: FortuneSheetWrapperProps) {
    // Apply Marathi font to all cells when isMarathi
    const processedData = isMarathi
        ? (data ?? []).map((sheet: any) => ({
            ...sheet,
            celldata: (sheet.celldata ?? []).map((cell: any) => ({
                ...cell,
                v: cell.v ? { ...cell.v, ff: 'Kruti Dev 010', fs: 14 } : cell.v,
            })),
        }))
        : data;

    const defaultSettings = {
        data: processedData,
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
        <Box sx={{ width: '100%', height: height === -1 ? '100%' : `${height}px`, border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
            <Workbook {...defaultSettings} />
        </Box>
    );
}
