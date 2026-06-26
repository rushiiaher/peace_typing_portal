'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '@fortune-sheet/react/dist/index.css';
import { Box, Typography } from '@mui/material';

const Workbook = dynamic(() => import('@fortune-sheet/react').then(mod => mod.Workbook), {
    ssr: false,
    loading: () => <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}><Typography>Loading Excel Editor...</Typography></Box>
});

interface FortuneSheetWrapperProps {
    data: any;
    onChange?: (data: any) => void;
    readOnly?: boolean;
    isMarathi?: boolean;
    /** Pixel height. Pass -1 to fill remaining viewport (calc(100vh - 260px)). Default 500. */
    height?: number;
}

export default function FortuneSheetWrapper({
    data, onChange, readOnly = false, isMarathi = false, height = 500,
}: FortuneSheetWrapperProps) {
    // For height=-1 we need a real pixel value so FortuneSheet can size its virtual scroll.
    // We compute it client-side to avoid SSR mismatch.
    const [viewportHeight, setViewportHeight] = useState(600);
    useEffect(() => {
        if (height !== -1) return;
        const update = () => setViewportHeight(Math.max(400, window.innerHeight - 260));
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [height]);

    const resolvedHeight = height === -1 ? viewportHeight : height;

    const processedData = isMarathi
        ? (data ?? []).map((sheet: any) => ({
            ...sheet,
            celldata: (sheet.celldata ?? []).map((cell: any) => ({
                ...cell,
                v: cell.v ? { ...cell.v, ff: 'Kruti Dev 010', fs: 14 } : cell.v,
            })),
        }))
        : data;

    const settings = {
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
        column: 26,
        row: 60,
        hook: {
            updated: (updatedData: any) => {
                if (onChange && !readOnly) onChange(updatedData);
            },
        },
    };

    return (
        // overflow: visible so column-resize drag handles are not clipped by this container.
        // FortuneSheet manages its own internal scroll viewport.
        <Box sx={{ width: '100%', height: `${resolvedHeight}px`, overflow: 'visible', position: 'relative' }}>
            <Workbook {...settings} />
        </Box>
    );
}
