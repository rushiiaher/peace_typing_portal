/**
 * generateFeeReceiptHtml
 * Produces a self-contained, print-ready A4 HTML string split into
 * Part-A (Student Copy) and Part-B (Institute Copy).
 *
 * Usage:
 *   const win = window.open('', '_blank');
 *   win.document.write(generateFeeReceiptHtml(data));
 *   win.document.close();
 */

export interface ReceiptData {
  receiptNo: string;
  receiptDate: string;       // "27 Mar 2026"
  studentName: string;
  rollNo: string;
  courseName: string;
  courseCode: string;
  batchName: string;
  admissionMonth: string;    // "Jan 2026"
  courseDuration: string;    // "6 Months"
  paymentMode: string;       // "CASH", "UPI", etc.
  paymentDate: string;       // "27 Mar 2026"
  currentAmount: number;     // amount paid in THIS installment
  installments: { label: string; amount: number }[];   // all installments up to now
  totalFee: number;
  totalPaid: number;
  balance: number;
  instituteName: string;
  instituteAddress: string;
  institutePhone: string;
  instituteEmail: string;
}

/** Convert number to Indian words (up to 99,99,999) */
function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  }

  const intPart = Math.floor(Math.abs(n));
  return convert(intPart) + ' Rupees Only';
}

function esc(val: string | null | undefined): string {
  return String(val ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return '₹' + Number(n ?? 0).toLocaleString('en-IN');
}

function receiptPart(d: ReceiptData, copyType: 'STUDENT COPY' | 'INSTITUTE COPY'): string {
  const badge = copyType === 'STUDENT COPY'
    ? 'background:#2196F3;color:#fff;'
    : 'background:#FF9800;color:#fff;';

  const installmentRows = d.installments.map(i =>
    `<tr><td style="padding:3px 8px;font-size:11px;">${esc(i.label)}</td><td style="padding:3px 8px;font-size:11px;text-align:right;font-weight:700;">${fmt(i.amount)}</td></tr>`
  ).join('');

  return `
  <div class="receipt">
    <!-- Header -->
    <div class="receipt-header">
      <img class="logo" src="${typeof window !== 'undefined' ? window.location.origin : ''}/Peacexperts_LOGO.png" alt="Logo" />
      <div class="header-center">
        <div class="inst-name">${esc(d.instituteName)}</div>
        <div class="inst-sub">
          Reg. Under Ministry of Corporate Affairs (Govt. of India)<br/>
          Peacexperts Academy-MH2022PTC376485<br/>
          An ISO:9001:2015 Certified Organization
        </div>
        <div class="inst-contact">
          ${d.instituteAddress ? esc(d.instituteAddress) + '<br/>' : ''}
          ${d.institutePhone ? 'Ph: ' + esc(d.institutePhone) : ''} ${d.instituteEmail ? '| Email: ' + esc(d.instituteEmail) : ''}
        </div>
      </div>
      <div class="copy-badge" style="${badge}">
        ${copyType}
      </div>
    </div>

    <!-- Title -->
    <div class="title-bar">ADMISSION RECEIPT</div>

    <!-- Fields row 1 -->
    <table class="field-table">
      <tr>
        <td class="label">Receipt No.</td>
        <td class="value">${esc(d.receiptNo)}</td>
        <td class="label">Date</td>
        <td class="value">${esc(d.receiptDate)}</td>
      </tr>
      <tr>
        <td class="label">Student Name</td>
        <td class="value" colspan="3">${esc(d.studentName)}</td>
      </tr>
      <tr>
        <td class="label">Roll No.</td>
        <td class="value">${esc(d.rollNo)}</td>
        <td class="label">Payment Mode</td>
        <td class="value">${esc(d.paymentMode)}</td>
      </tr>
      <tr>
        <td class="label">Amount (Words)</td>
        <td class="value" colspan="3" style="font-style:italic;">${numberToWords(d.currentAmount)}</td>
      </tr>
    </table>

    <!-- Installment History + Course Details side by side -->
    <div class="detail-row">
      <!-- Left: Installments -->
      <div class="detail-left">
        <div class="section-title">INSTALLMENT HISTORY</div>
        <table class="mini-table">
          ${installmentRows}
          <tr style="border-top:1.5px solid #333;">
            <td style="padding:4px 8px;font-weight:800;font-size:11px;">Total Paid</td>
            <td style="padding:4px 8px;font-weight:800;font-size:12px;text-align:right;color:#1b5e20;">${fmt(d.totalPaid)}</td>
          </tr>
        </table>
      </div>
      <!-- Right: Course Details -->
      <div class="detail-right">
        <div class="section-title">COURSE DETAILS</div>
        <table class="mini-table">
          <tr><td class="mini-label">Admission</td><td class="mini-val">${esc(d.admissionMonth)}</td></tr>
          <tr><td class="mini-label">Duration</td><td class="mini-val">${esc(d.courseDuration)}</td></tr>
          <tr><td class="mini-label">Course</td><td class="mini-val">${esc(d.courseName)}</td></tr>
          <tr><td class="mini-label">Code</td><td class="mini-val">${esc(d.courseCode)}</td></tr>
          <tr><td class="mini-label">Batch</td><td class="mini-val">${esc(d.batchName)}</td></tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="receipt-footer">
      <div class="amount-box">
        <span class="rupee-icon">₹</span>
        <div>
          <div class="paid-label">AMOUNT PAID</div>
          <div class="paid-amount">${fmt(d.currentAmount)}</div>
          ${d.balance > 0 ? `<div class="balance-line">Balance: ${fmt(d.balance)}</div>` : ''}
        </div>
      </div>
      <div class="footer-right">
        <div class="non-refund">FEES NON REFUNDABLE</div>
        <div class="sign-line">Authorized Course Instructor</div>
      </div>
    </div>
  </div>`;
}

export function generateFeeReceiptHtml(d: ReceiptData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Fee Receipt – ${esc(d.receiptNo)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; }
  .page { width: 740px; margin: 0 auto; }

  /* ── Receipt block ── */
  .receipt {
    border: 2px solid #000;
    margin-bottom: 0;
    page-break-inside: avoid;
  }

  /* Header */
  .receipt-header {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    border-bottom: 2px solid #000;
  }
  .logo { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
  .header-center { flex: 1; text-align: center; }
  .inst-name { font-size: 16px; font-weight: 900; color: #0d47a1; }
  .inst-sub { font-size: 10px; color: #444; line-height: 1.4; margin-top: 1px; }
  .inst-contact { font-size: 9.5px; color: #666; margin-top: 2px; }
  .copy-badge {
    padding: 4px 12px; border-radius: 4px;
    font-size: 11px; font-weight: 900; letter-spacing: 0.5px;
    text-align: center; white-space: nowrap;
    writing-mode: horizontal-tb;
  }

  /* Title */
  .title-bar {
    text-align: center; font-size: 15px; font-weight: 900;
    color: #c62828; letter-spacing: 1px;
    text-decoration: underline; text-underline-offset: 3px;
    padding: 5px 0;
    border-bottom: 1px solid #ccc;
  }

  /* Field table */
  .field-table { width: 100%; border-collapse: collapse; }
  .field-table td { border: 1px solid #ccc; padding: 5px 8px; }
  .field-table .label { font-weight: 600; color: #333; width: 130px; background: #fafafa; font-size: 11px; }
  .field-table .value { font-weight: 700; font-size: 12px; }

  /* Detail row */
  .detail-row { display: flex; border-top: 2px solid #000; }
  .detail-left { flex: 1; border-right: 2px solid #000; padding: 6px; }
  .detail-right { flex: 1; padding: 6px; }
  .section-title {
    font-weight: 900; font-size: 11px; letter-spacing: 0.5px;
    text-align: center; margin-bottom: 4px; color: #333;
  }
  .mini-table { width: 100%; border-collapse: collapse; }
  .mini-table td { padding: 3px 8px; font-size: 11px; border-bottom: 1px dotted #ddd; }
  .mini-label { font-weight: 600; color: #555; width: 80px; }
  .mini-val { font-weight: 700; }

  /* Footer */
  .receipt-footer {
    display: flex; align-items: stretch;
    border-top: 2px solid #000;
  }
  .amount-box {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px;
    border-right: 2px solid #000;
    background: #e8f5e9;
    min-width: 220px;
  }
  .rupee-icon {
    font-size: 28px; font-weight: 900; color: #1b5e20;
    background: #c8e6c9; border-radius: 50%;
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .paid-label { font-size: 10px; color: #2e7d32; font-weight: 700; letter-spacing: 0.5px; }
  .paid-amount { font-size: 18px; font-weight: 900; color: #1b5e20; }
  .balance-line { font-size: 10px; color: #c62828; font-weight: 600; }
  .footer-right {
    flex: 1; display: flex; flex-direction: column;
    justify-content: space-between; padding: 8px 14px;
  }
  .non-refund {
    font-size: 11px; font-weight: 900; color: #c62828;
    letter-spacing: 0.5px; text-align: center;
    border: 1px dashed #c62828; padding: 3px 0; border-radius: 3px;
  }
  .sign-line {
    text-align: right; font-size: 11px; color: #555;
    border-top: 1px solid #999; padding-top: 3px; margin-top: 6px;
    font-weight: 600;
  }

  /* ── Cut line ── */
  .cut-line {
    text-align: center; padding: 4px 0;
    font-size: 10px; color: #888;
    border-bottom: 2px dashed #aaa;
    letter-spacing: 8px;
    margin-bottom: 0;
  }

  /* ── Print ── */
  @media print {
    body { margin: 0; }
    .page { margin: 0; width: 100%; }
    @page { size: A4 portrait; margin: 8mm; }
    .cut-line { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="page">
  ${receiptPart(d, 'STUDENT COPY')}
  <div class="cut-line">✂ &mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash; CUT HERE &mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash; ✂</div>
  ${receiptPart(d, 'INSTITUTE COPY')}
</div>

<script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
}
