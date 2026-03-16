import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function countWords(text: string): number {
    return (text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(text: string): string {
    if (!text) return '';
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/**
 * Parse an entire Excel sheet into { data, merges, styles }.
 * data    — 2D array of cell values (strings)
 * merges  — SheetJS merge range objects
 * styles  — map of "r:c" → { bold, align } extracted from cell styles
 */
function parseSheetAsGrid(sheet: XLSX.WorkSheet): {
    data: string[][];
    merges: XLSX.Range[];
    styles: Record<string, { bold?: boolean; align?: string }>;
} {
    const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
    }) as string[][];

    const merges: XLSX.Range[] = sheet['!merges'] ?? [];

    const styles: Record<string, { bold?: boolean; align?: string }> = {};
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = sheet[XLSX.utils.encode_cell({ r, c })];
            if (!cell?.s) continue;
            const style: { bold?: boolean; align?: string } = {};
            if (cell.s.bold) style.bold = true;
            if (cell.s.alignment?.horizontal) style.align = cell.s.alignment.horizontal;
            if (Object.keys(style).length) styles[`${r}:${c}`] = style;
        }
    }

    return { data, merges, styles };
}

// ─── POST /api/admin/content/bulk-upload?type=... ────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type');
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const courseId = formData.get('course_id') as string | null;

        if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
        if (!courseId) return NextResponse.json({ error: 'course_id is required.' }, { status: 400 });
        if (!type) return NextResponse.json({ error: 'type is required.' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());

        // ── Statement Templates: whole-sheet grid upload ──────────────────────
        // The admin uploads a normal Excel file that IS the statement.
        // We parse the entire sheet as a grid — no manual JSON needed.
        if (type === 'statement_templates') {
            const workbook = XLSX.read(buffer, {
                type: 'buffer',
                cellStyles: true,   // needed to extract bold/align
                cellFormula: false,
            });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const { data, merges, styles } = parseSheetAsGrid(sheet);

            if (!data.length) {
                return NextResponse.json({ error: 'Excel file is empty.' }, { status: 400 });
            }

            // Title: prefer formData field, else first non-empty cell in sheet
            const titleFromForm = (formData.get('title') as string | null)?.trim() ?? '';
            const title = titleFromForm || String(data[0]?.[0] ?? '').trim() || file.name.replace(/\.[^.]+$/, '');

            const template_content = JSON.stringify({ data, merges, styles });

            const admin = getAdmin();
            const { data: inserted, error } = await admin
                .from('statement_templates')
                .insert({ course_id: courseId, title, template_content, is_active: true })
                .select()
                .single();

            if (error) {
                return NextResponse.json(
                    { inserted: 0, errors: [error.message], message: `0 record(s) imported. 1 error(s).` },
                    { status: 201 }
                );
            }

            return NextResponse.json({
                inserted: 1,
                errors: [],
                message: `"${title}" imported successfully (${data.length} rows × ${data[0]?.length ?? 0} columns).`,
            }, { status: 201 });
        }

        // ── All other types: row-by-row header-based parsing ─────────────────
        const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellFormula: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
            raw: false,
            defval: '',
        });

        if (!rows.length) return NextResponse.json({ error: 'Excel file is empty.' }, { status: 400 });

        const admin = getAdmin();
        const inserted: any[] = [];
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;

            try {
                if (type === 'speed_passages') {
                    const title = (row['title'] ?? row['Title'] ?? '').toString().trim();
                    const difficulty = (row['difficulty_level'] ?? row['Difficulty Level'] ?? row['Difficulty'] ?? '').toString().trim().toLowerCase() || null;
                    const passageText = normalizeText((row['passage_text'] ?? row['Passage Text'] ?? row['Passage'] ?? '').toString());

                    if (!title) { errors.push(`Row ${rowNum}: "title" is required.`); continue; }
                    if (!passageText) { errors.push(`Row ${rowNum}: "passage_text" is required.`); continue; }

                    const wordCount = countWords(passageText);
                    const { data, error } = await admin.from('speed_passages').insert({
                        course_id: courseId, title, difficulty_level: difficulty,
                        passage_text: passageText, word_count: wordCount, is_active: true,
                    }).select().single();
                    if (error) throw error;
                    inserted.push(data);

                } else if (type === 'email_templates') {
                    const title = (row['title'] ?? row['Title'] ?? '').toString().trim();
                    const mailTo = (row['mail_to'] ?? row['Mail To'] ?? row['To'] ?? '').toString().trim();
                    const subject = (row['subject'] ?? row['Subject'] ?? '').toString().trim();
                    const cc = (row['cc'] ?? row['CC'] ?? '').toString().trim() || null;
                    const bcc = (row['bcc'] ?? row['BCC'] ?? '').toString().trim() || null;
                    const body = normalizeText((row['body'] ?? row['Body'] ?? row['Mail Body'] ?? '').toString());
                    const att1 = (row['attachment_1'] ?? row['Attachment 1'] ?? '').toString().trim() || null;
                    const att2 = (row['attachment_2'] ?? row['Attachment 2'] ?? '').toString().trim() || null;
                    const att3 = (row['attachment_3'] ?? row['Attachment 3'] ?? '').toString().trim() || null;

                    if (!title) { errors.push(`Row ${rowNum}: "title" is required.`); continue; }
                    if (!subject) { errors.push(`Row ${rowNum}: "subject" is required.`); continue; }
                    if (!body) { errors.push(`Row ${rowNum}: "body" is required.`); continue; }

                    const template_content = JSON.stringify({ mail_to: mailTo, subject, cc, bcc, body, attachment_1: att1, attachment_2: att2, attachment_3: att3 });
                    const { data, error } = await admin.from('email_templates').insert({
                        course_id: courseId, title, template_content, is_active: true,
                    }).select().single();
                    if (error) throw error;
                    inserted.push(data);

                } else if (type === 'letter_templates') {
                    const g = (keys: string[]) => {
                        for (const k of keys) {
                            const val = row[k] ?? row[k.replace(/_/g, ' ')] ?? '';
                            if (val.toString().trim()) return normalizeText(val.toString());
                        }
                        return '';
                    };

                    const title = g(['title', 'Title', 'Template Title']);
                    const VALID_CATEGORIES = ['official', 'personal', 'business'];
                    const rawCategory = g(['category', 'Category']).toLowerCase().trim();
                    const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null;
                    const letterhead = g(['letterhead', 'Letterhead', 'Letter Head', 'Heading']);
                    const sender_address = g(['sender_address', 'Sender Address', 'Address']);
                    const ref_number = g(['ref_number', 'Ref Number', 'Ref No', 'Reference Number']);
                    const date = g(['date', 'Date']);
                    const receiver_address = g(['receiver_address', 'Receiver Address', 'Inside Address']);
                    const subject = g(['subject', 'Subject']);
                    const reference_line = g(['reference_line', 'Reference Line', 'Ref Line']) || null;
                    const salutation = g(['salutation', 'Salutation']);
                    const body_para_1 = g(['body_para_1', 'Body Para 1', 'Paragraph 1', 'Para 1']);
                    const body_para_2 = g(['body_para_2', 'Body Para 2', 'Paragraph 2', 'Para 2']) || null;
                    const body_para_3 = g(['body_para_3', 'Body Para 3', 'Paragraph 3', 'Para 3']) || null;
                    const complimentary_close = g(['complimentary_close', 'Complimentary Close', 'Closing']);
                    const subscription = g(['subscription', 'Subscription', 'Sign Off']);
                    const designation = g(['designation', 'Designation', 'Signature']) || null;
                    const enclosure = g(['enclosure', 'Enclosure', 'Encl']) || null;

                    if (!title) { errors.push(`Row ${rowNum}: "title" is required.`); continue; }
                    if (!letterhead && !body_para_1) { errors.push(`Row ${rowNum}: at least "letterhead" or "body_para_1" required.`); continue; }

                    const template_content = JSON.stringify({
                        letterhead, sender_address, ref_number, date,
                        receiver_address, subject, reference_line, salutation,
                        body_para_1, body_para_2, body_para_3,
                        complimentary_close, subscription, designation, enclosure,
                    });
                    const { data, error } = await admin.from('letter_templates').insert({
                        course_id: courseId, title, category: category || null,
                        template_content, is_active: true,
                    }).select().single();
                    if (error) throw error;
                    inserted.push(data);

                } else if (type === 'mcq_question_bank') {
                    const g = (keys: string[]) => {
                        for (const k of keys) {
                            const val = row[k] ?? row[k.replace(/_/g, ' ')] ?? '';
                            if (val.toString().trim()) return val.toString().trim();
                        }
                        return '';
                    };

                    const question = g(['question', 'Question']);
                    const option_a = g(['option_a', 'Option A', 'Option_A', 'OptionA']);
                    const option_b = g(['option_b', 'Option B', 'Option_B', 'OptionB']);
                    const option_c = g(['option_c', 'Option C', 'Option_C', 'OptionC']);
                    const option_d = g(['option_d', 'Option D', 'Option_D', 'OptionD']);
                    const correct_answer = g(['correct_answer', 'Correct Answer', 'Answer']).toLowerCase();
                    const explanation = g(['explanation', 'Explanation']) || null;

                    if (!question) { errors.push(`Row ${rowNum}: "question" is required.`); continue; }
                    if (!option_a || !option_b || !option_c || !option_d) { errors.push(`Row ${rowNum}: all four options (a, b, c, d) are required.`); continue; }
                    if (!['a', 'b', 'c', 'd'].includes(correct_answer)) { errors.push(`Row ${rowNum}: "correct_answer" must be a, b, c, or d (got "${correct_answer}").`); continue; }

                    const { data, error } = await admin.from('mcq_question_bank').insert({
                        course_id: courseId, question,
                        option_a, option_b, option_c, option_d,
                        correct_answer, explanation, is_active: true,
                    }).select().single();
                    if (error) throw error;
                    inserted.push(data);

                } else {
                    return NextResponse.json({ error: `Bulk upload not supported for type "${type}".` }, { status: 400 });
                }
            } catch (rowErr: any) {
                errors.push(`Row ${rowNum}: ${rowErr.message}`);
            }
        }

        return NextResponse.json({
            inserted: inserted.length,
            errors,
            message: `${inserted.length} record(s) imported. ${errors.length} error(s).`,
        }, { status: 201 });

    } catch (err: any) {
        console.error('[bulk-upload]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
