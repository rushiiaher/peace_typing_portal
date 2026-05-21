import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

function getAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getInstituteId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = getAdmin();
    const { data } = await admin.from('institute_admins').select('institute_id').eq('id', user.id).single();
    return data?.institute_id ?? null;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchStudentFeeStatus(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const { data: students } = await admin
        .from('students')
        .select(`
            enrollment_number, name, email,
            batches ( batch_name, batch_code, course_id,
                courses ( name, exam_fee, base_course_fee )
            ),
            student_fee_collection ( total_collected, collected_at )
        `)
        .eq('institute_id', instituteId)
        .order('name');

    const { data: instCourses } = await admin
        .from('institute_courses')
        .select('course_id, institute_course_fee')
        .eq('institute_id', instituteId);
    const feeMap = new Map((instCourses ?? []).map((ic: any) => [ic.course_id, ic.institute_course_fee]));

    return (students ?? []).map((s: any) => {
        const courseId = s.batches?.course_id ?? '';
        const courseFee = feeMap.get(courseId) ?? s.batches?.courses?.base_course_fee ?? 0;
        const examFee = s.batches?.courses?.exam_fee ?? 0;
        const totalDue = courseFee + examFee;
        const totalPaid = (s.student_fee_collection ?? []).reduce((sum: number, p: any) => sum + Number(p.total_collected), 0);
        return {
            'Enrollment': s.enrollment_number ?? '—',
            'Student Name': s.name ?? '—',
            'Email': s.email ?? '—',
            'Batch': s.batches?.batch_name ?? '—',
            'Course': s.batches?.courses?.name ?? '—',
            'Total Due (₹)': totalDue,
            'Total Paid (₹)': totalPaid,
            'Balance (₹)': Math.max(0, totalDue - totalPaid),
            'Status': totalPaid >= totalDue && totalDue > 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'PENDING',
        };
    });
}

async function fetchBatchPerformance(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const { data: batches } = await admin.from('batches').select('id').eq('institute_id', instituteId);
    const batchIds = (batches ?? []).map((b: any) => b.id);
    if (!batchIds.length) return [];

    const { data: exams } = await admin
        .from('exams')
        .select(`
            status, result, total_marks_obtained,
            students ( name, enrollment_number ),
            batches ( batch_name ),
            courses ( name )
        `)
        .in('batch_id', batchIds)
        .order('exam_date', { ascending: false });

    return (exams ?? []).map((e: any) => ({
        'Student': (e.students as any)?.name ?? '—',
        'Enrollment': (e.students as any)?.enrollment_number ?? '—',
        'Batch': (e.batches as any)?.batch_name ?? '—',
        'Course': (e.courses as any)?.name ?? '—',
        'Exam Status': e.status ?? '—',
        'Result': e.result ?? '—',
        'WPM': e.total_marks_obtained ?? '—',
    }));
}

async function fetchMonthlyRevenue(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const { data: payments } = await admin
        .from('student_fee_collection')
        .select(`
            total_collected, collected_at, payment_mode, receipt_number,
            students ( name, enrollment_number, institute_id )
        `)
        .order('collected_at', { ascending: false });

    // Filter by institute
    const filtered = (payments ?? []).filter((p: any) => (p.students as any)?.institute_id === instituteId);

    // Group by month
    const monthMap = new Map<string, number>();
    for (const p of filtered) {
        const d = new Date(p.collected_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + Number(p.total_collected));
    }

    return Array.from(monthMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, total]) => ({ 'Month': month, 'Revenue (₹)': total }));
}

async function fetchOutstandingDues(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const rows = await fetchStudentFeeStatus(admin, instituteId);
    return rows.filter((r: any) => r['Status'] !== 'PAID' && r['Total Due (₹)'] > 0);
}

async function fetchExamSchedule(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const { data: batches } = await admin.from('batches').select('id').eq('institute_id', instituteId);
    const batchIds = (batches ?? []).map((b: any) => b.id);
    if (!batchIds.length) return [];

    const { data: exams } = await admin
        .from('exams')
        .select(`
            exam_date, start_time, status, attendance_status, result, total_marks_obtained,
            students ( name, enrollment_number ),
            batches ( batch_name ),
            courses ( name ),
            institute_systems ( system_name )
        `)
        .in('batch_id', batchIds)
        .order('exam_date', { ascending: false });

    return (exams ?? []).map((e: any) => ({
        'Student': (e.students as any)?.name ?? '—',
        'Enrollment': (e.students as any)?.enrollment_number ?? '—',
        'Batch': (e.batches as any)?.batch_name ?? '—',
        'Course': (e.courses as any)?.name ?? '—',
        'Exam Date': e.exam_date ?? '—',
        'Start Time': e.start_time ? new Date(e.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—',
        'System': (e.institute_systems as any)?.system_name ?? '—',
        'Status': e.status ?? '—',
        'Attendance': e.attendance_status ?? '—',
        'Result': e.result ?? '—',
        'WPM': e.total_marks_obtained ?? '—',
    }));
}

async function fetchPaymentHistory(admin: ReturnType<typeof getAdmin>, instituteId: string) {
    const { data: payments } = await admin
        .from('student_fee_collection')
        .select(`
            receipt_number, total_collected, course_fee_collected, exam_fee_collected,
            payment_mode, collected_at,
            students ( name, enrollment_number, institute_id )
        `)
        .order('collected_at', { ascending: false });

    return (payments ?? [])
        .filter((p: any) => (p.students as any)?.institute_id === instituteId)
        .map((p: any) => ({
            'Receipt #': p.receipt_number ?? '—',
            'Student': (p.students as any)?.name ?? '—',
            'Enrollment': (p.students as any)?.enrollment_number ?? '—',
            'Course Fee (₹)': p.course_fee_collected ?? 0,
            'Exam Fee (₹)': p.exam_fee_collected ?? 0,
            'Total (₹)': p.total_collected ?? 0,
            'Mode': p.payment_mode ?? '—',
            'Date': p.collected_at ? new Date(p.collected_at).toLocaleDateString('en-IN') : '—',
        }));
}

// ── HTML PDF template ─────────────────────────────────────────────────────────

function buildPdfHtml(title: string, rows: Record<string, any>[]): string {
    if (!rows.length) {
        return `<html><body style="font-family:sans-serif;padding:32px"><h2>${title}</h2><p>No data available.</p></body></html>`;
    }
    const headers = Object.keys(rows[0]);
    const thead = headers.map(h => `<th style="background:#1e3a5f;color:#fff;padding:8px 12px;text-align:left;white-space:nowrap">${h}</th>`).join('');
    const tbody = rows.map((row, i) =>
        `<tr style="background:${i % 2 === 0 ? '#fff' : '#f1f5f9'}">` +
        headers.map(h => `<td style="padding:7px 12px;border-bottom:1px solid #e2e8f0">${row[h] ?? '—'}</td>`).join('') +
        '</tr>'
    ).join('');
    const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; }
    h2 { color: #1e3a5f; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <p class="meta">Generated: ${now} &nbsp;|&nbsp; Total records: ${rows.length}</p>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const instituteId = await getInstituteId();
        if (!instituteId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const type = req.nextUrl.searchParams.get('type') ?? '';
        const format = req.nextUrl.searchParams.get('format') ?? 'excel';

        const admin = getAdmin();
        let rows: Record<string, any>[] = [];
        let title = '';

        switch (type) {
            case 'student-fee-status':
                rows = await fetchStudentFeeStatus(admin, instituteId);
                title = 'Student Fee Status';
                break;
            case 'batch-performance':
                rows = await fetchBatchPerformance(admin, instituteId);
                title = 'Batch Performance';
                break;
            case 'monthly-revenue':
                rows = await fetchMonthlyRevenue(admin, instituteId);
                title = 'Monthly Revenue';
                break;
            case 'outstanding-dues':
                rows = await fetchOutstandingDues(admin, instituteId);
                title = 'Outstanding Dues';
                break;
            case 'exam-schedule':
                rows = await fetchExamSchedule(admin, instituteId);
                title = 'Exam Schedule';
                break;
            case 'payment-history':
                rows = await fetchPaymentHistory(admin, instituteId);
                title = 'Payment History';
                break;
            default:
                return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
        }

        const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

        if (format === 'pdf') {
            const html = buildPdfHtml(title, rows);
            return new NextResponse(html, {
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                },
            });
        }

        // Excel
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Note': 'No data available' }]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
