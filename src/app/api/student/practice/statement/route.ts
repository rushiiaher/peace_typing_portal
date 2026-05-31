import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

// ── Built-in Marathi statement practice templates ─────────────────────────────
// These are always returned regardless of DB content so students always have
// something useful to practice with.
const BUILTIN_TEMPLATES = [
    {
        id: 'builtin-mr-1',
        title: 'पुस्तक साठा नोंदणी (Book Stock Register)',
        difficulty: 'beginner',
        template_content: JSON.stringify({
            data: [
                ['', 'पुस्तकांचा साठा - ग्रंथालय', '', '', ''],
                ['', '', '', '', ''],
                ['Sr.No.', 'Subject', '2022', '2023', '2024'],
                ['1', 'Marathi', '1,789', '1,674', '1,800'],
                ['2', 'English', '570', '449', '760'],
                ['3', 'Hindi', '920', '876', '970'],
                ['4', 'Urdu', '450', '878', '910'],
                ['5', 'Gujarati', '1,331', '1,420', '1,749'],
                ['6', 'French', '2', '1,784', '1,983'],
                ['7', 'German', '765', '831', '957'],
                ['8', 'Latin', '1,546', '3,451', '1,765'],
                ['Total', '', '7,373', '11,363', '10,894'],
            ],
            merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }],
        }),
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-2',
        title: 'विद्यार्थी गुण तक्ता (Student Marks Table)',
        difficulty: 'intermediate',
        template_content: JSON.stringify({
            data: [
                ['', 'वार्षिक परीक्षा निकाल - २०२४', '', '', '', ''],
                ['', '', '', '', '', ''],
                ['Sr.No.', 'Student Name', 'Marathi', 'English', 'Maths', 'Total'],
                ['1', 'Sunil Kulkarni', '85', '78', '92', '255'],
                ['2', 'Priya Deshpande', '92', '88', '75', '255'],
                ['3', 'Rahul Patil', '76', '82', '88', '246'],
                ['4', 'Anita Joshi', '89', '95', '91', '275'],
                ['5', 'Vikas Shinde', '72', '70', '85', '227'],
                ['6', 'Meera Bhosale', '95', '91', '88', '274'],
                ['7', 'Ajay Jadhav', '80', '75', '90', '245'],
                ['Highest', '', '95', '95', '92', '275'],
                ['Average', '', '84', '83', '87', '254'],
            ],
            merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 5 } }],
        }),
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-3',
        title: 'वार्षिक उत्पन्न-खर्च तक्ता (Income-Expense Statement)',
        difficulty: 'advanced',
        template_content: JSON.stringify({
            data: [
                ['', 'Annual Income & Expense Statement 2024', '', ''],
                ['', '', '', ''],
                ['Sr.No.', 'Particulars', 'Income (Rs.)', 'Expense (Rs.)'],
                ['1', 'Salary / Wages', '3,00,000', ''],
                ['2', 'House Rent', '', '60,000'],
                ['3', 'Agricultural Income', '1,50,000', ''],
                ['4', 'Education Expenses', '', '40,000'],
                ['5', 'Medical Expenses', '', '25,000'],
                ['6', 'Business Income', '2,00,000', ''],
                ['7', 'Transport Expenses', '', '18,000'],
                ['8', 'Grocery & Food', '', '36,000'],
                ['Total', '', '6,50,000', '1,79,000'],
                ['Net Savings', '', '4,71,000', ''],
            ],
            merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 3 } }],
        }),
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-en-1',
        title: 'Sales Register (Monthly)',
        difficulty: 'beginner',
        template_content: JSON.stringify({
            data: [
                ['', 'Monthly Sales Register - Q1 2024', '', '', ''],
                ['', '', '', '', ''],
                ['Sr.No.', 'Product Name', 'Jan', 'Feb', 'Mar'],
                ['1', 'Laptop', '45', '52', '38'],
                ['2', 'Desktop PC', '22', '18', '30'],
                ['3', 'Printer', '15', '20', '12'],
                ['4', 'Scanner', '8', '10', '14'],
                ['5', 'Keyboard', '60', '75', '55'],
                ['6', 'Mouse', '80', '90', '70'],
                ['7', 'Monitor', '35', '40', '28'],
                ['Total', '', '265', '305', '247'],
            ],
            merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }],
        }),
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
];

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ templates: [] });

        const admin = getAdmin();
        const { data: templates, error } = await admin
            .from('statement_templates')
            .select('id, title, template_content, is_active, created_at')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.statement)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);
        const best: Record<string, { accuracy: number; wpm: number }> = {};
        for (const h of history) {
            if (!best[h.content_id] || h.accuracy > best[h.content_id].accuracy)
                best[h.content_id] = { accuracy: h.accuracy, wpm: h.wpm };
        }

        const dbTemplates = (templates ?? []).map((t: any) => ({
            ...t,
            best_accuracy: best[t.id]?.accuracy ?? null,
            best_wpm: best[t.id]?.wpm ?? null,
            attempted: !!best[t.id],
        }));

        // Merge built-in templates with DB templates.
        // Built-in templates fill the gap when DB has no content or bad content.
        const builtinWithHistory = BUILTIN_TEMPLATES.map(t => ({
            ...t,
            best_accuracy: best[t.id]?.accuracy ?? null,
            best_wpm: best[t.id]?.wpm ?? null,
            attempted: !!best[t.id],
        }));

        const result = [...dbTemplates, ...builtinWithHistory];

        return NextResponse.json({ templates: result, is_marathi: student.is_marathi });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { template_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.statement,
            content_id: template_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

