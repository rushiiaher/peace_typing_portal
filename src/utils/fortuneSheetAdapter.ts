/**
 * Converts the lightweight statement JSON stored in the database 
 * (which contains data string[][], merges[], and styles{}) 
 * into the rich celldata format required by FortuneSheet.
 */
export function convertToFortuneSheetData(templateStr: string, sheetName: string = "Sheet1") {
    let tpl: any = null;
    try {
        tpl = JSON.parse(templateStr);
    } catch (e) {
        return [{ name: sheetName, celldata: [], status: 1 }];
    }

    if (!tpl || !tpl.data) {
        // If the parsed JSON is already FortuneSheet format, return it
        if (Array.isArray(tpl) && tpl[0] && tpl[0].celldata) {
            return tpl;
        }
        return [{ name: sheetName, celldata: [], status: 1 }];
    }

    const numRows = Math.max(tpl.data.length, 30);
    const numCols = Math.max((tpl.data[0] || []).length, 10);

    const celldata: any[] = [];

    // Parse simple strings into FortuneSheet cell format
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            let v: any = null;
            const val = tpl.data[r] ? tpl.data[r][c] : '';
            const style = tpl.styles ? tpl.styles[`${r}:${c}`] : null;

            if (val || style) {
                v = {};
                if (val !== undefined && val !== null && val !== '') {
                    v.v = String(val);
                    v.m = String(val);
                }
                if (style) {
                    if (style.bold) v.bl = 1;
                    if (style.align === 'center') v.ht = 0;
                    if (style.align === 'left') v.ht = 1;
                    if (style.align === 'right') v.ht = 2;
                }
                if (Object.keys(v).length > 0) {
                    celldata.push({ r, c, v });
                }
            }
        }
    }

    const config: any = { merge: {}, rowlen: {}, columnlen: {} };

    // Handle Merges
    if (tpl.merges && tpl.merges.length) {
        tpl.merges.forEach((m: any) => {
            const rs = m.s.r;
            const cs = m.s.c;
            const rsLen = m.e.r - m.s.r + 1;
            const csLen = m.e.c - m.s.c + 1;
            
            config.merge[`${rs}_${cs}`] = { r: rs, c: cs, rs: rsLen, cs: csLen };

            // Find existing cell or create one
            let existing = celldata.find(cell => cell.r === rs && cell.c === cs);
            if (!existing) {
                existing = { r: rs, c: cs, v: {} };
                celldata.push(existing);
            }
            existing.v.mc = { r: rs, c: cs, rs: rsLen, cs: csLen };
        });
    }

    return [
        {
            name: sheetName,
            status: 1,
            celldata: celldata,
            config: config
        }
    ];
}
