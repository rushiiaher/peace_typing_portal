/**
 * generateAdmitCardHtml
 * Produces a self-contained, print-ready HTML string for a PEACEXPERTS
 * candidate admit card. The caller opens it in a new tab with:
 *
 *   const win = window.open('', '_blank');
 *   win.document.write(generateAdmitCardHtml(data));
 *   win.document.close();
 */

export interface AdmitCardData {
  examId: string;
  examDate: string;          // "05-Jan-2026"
  reportingTime: string;     // "09:00 pm"
  gateClosingTime: string;   // "09:25 pm"
  examStartTime: string;     // "09:30 pm"
  examDuration: string;      // "75 Minutes"
  patternName: string;
  systemName: string;        // "S01"
  rollNo: string;
  studentName: string;
  motherName: string;
  aadhaarNo: string;
  photoUrl: string | null;
  courseName: string;
  batchName: string;
  instituteName: string;
  instituteAddress: string;
  institutePhone?: string;
  instituteEmail?: string;
}

export function generateAdmitCardHtml(d: AdmitCardData): string {
  // Absolute URL for the logo (must work inside a new window)
  const logoUrl = `${window.location.origin}/Peacexperts_LOGO.png`;

  const photoCell = d.photoUrl
    ? `<img src="${d.photoUrl}" style="width:110px;height:140px;object-fit:cover;border:1px solid #aaa;" />`
    : `<div style="width:110px;height:140px;border:1px solid #aaa;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:11px;color:#888;text-align:center;">Photo<br/>Not<br/>Available</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Admit Card – ${d.rollNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
  }

  .page {
    width: 740px;
    margin: 20px auto;
    border: 2px solid #000;
    padding: 0;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    border-bottom: 2px solid #000;
    padding: 10px 16px;
    gap: 14px;
  }
  .header img.logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .header-text {
    flex: 1;
    text-align: center;
  }
  .header-text .inst-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 0.5px;
    color: #000;
  }
  .header-text .inst-sub {
    font-size: 11px;
    color: #333;
    margin-top: 2px;
    line-height: 1.5;
  }

  /* ── Title Band ── */
  .title-band {
    background: #fff;
    border-bottom: 2px solid #000;
    text-align: center;
    padding: 8px 0 6px;
  }
  .title-band .main-title {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 1px;
    border: 1.5px solid #000;
    display: inline-block;
    padding: 4px 36px;
  }
  .title-band .sub-title {
    font-size: 11px;
    font-style: italic;
    color: #444;
    margin-top: 4px;
  }

  /* ── Candidate Details Table ── */
  .candidate-section {
    display: flex;
    border-bottom: 2px solid #000;
  }
  .details-table {
    flex: 1;
    border-collapse: collapse;
  }
  .details-table td {
    border: 1px solid #999;
    padding: 7px 10px;
    vertical-align: middle;
  }
  .details-table .label {
    font-weight: 600;
    width: 160px;
    background: #fafafa;
    color: #333;
    font-size: 11px;
  }
  .details-table .value {
    font-weight: 700;
    font-size: 12.5px;
    letter-spacing: 0.2px;
  }
  .photo-cell {
    padding: 10px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    border-left: 1px solid #999;
  }

  /* ── Schedule Section ── */
  .section-heading {
    background: #e8e8e8;
    text-align: center;
    font-weight: 900;
    font-size: 13px;
    letter-spacing: 1px;
    padding: 5px 0;
    border-bottom: 1px solid #000;
  }
  .schedule-outer {
    display: flex;
    border-bottom: 2px solid #000;
  }
  .centre-cell {
    width: 200px;
    border-right: 2px solid #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 14px 10px;
    gap: 6px;
  }
  .centre-cell .centre-name {
    font-weight: 900;
    font-size: 13px;
    text-transform: uppercase;
  }
  .centre-cell .centre-addr {
    font-size: 10.5px;
    color: #444;
    font-style: italic;
  }
  .schedule-table {
    flex: 1;
    border-collapse: collapse;
  }
  .schedule-table td {
    border: 1px solid #aaa;
    padding: 6px 12px;
    font-size: 12px;
  }
  .schedule-table .sch-label {
    width: 170px;
    color: #333;
    font-weight: 600;
    font-size: 11px;
  }
  .schedule-table .sch-val {
    font-weight: 800;
    font-size: 12.5px;
    letter-spacing: 0.3px;
  }

  /* ── Headers inside schedule ── */
  .schedule-header {
    display: flex;
    border-bottom: 1px solid #000;
  }
  .schedule-header .col-head {
    font-weight: 900;
    font-size: 12px;
    text-align: center;
    padding: 5px 0;
    letter-spacing: 0.5px;
  }
  .col-left  { width: 200px; border-right: 2px solid #000; }
  .col-right { flex: 1; }

  /* ── Instructions ── */
  .instructions {
    padding: 10px 16px;
    border-bottom: 2px solid #000;
    font-size: 11.5px;
  }
  .instructions .inst-head {
    font-weight: 900;
    margin-bottom: 4px;
    text-decoration: underline;
    font-size: 12px;
  }
  .instructions ol {
    padding-left: 18px;
    line-height: 1.8;
  }

  /* ── Footer ── */
  .footer-band {
    background: #f0f0f0;
    text-align: center;
    font-weight: 900;
    font-size: 12px;
    letter-spacing: 0.5px;
    padding: 6px 0;
    border-bottom: 1px solid #000;
    text-transform: uppercase;
  }
  .sign-row {
    display: flex;
    padding: 22px 0 10px;
  }
  .sign-box {
    flex: 1;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #444;
    border-top: 1px solid #888;
    margin: 0 30px;
    padding-top: 4px;
  }

  /* ── Print rules ── */
  @media print {
    body { margin: 0; }
    .page { margin: 0; border: none; width: 100%; }
    @page { size: A4 portrait; margin: 10mm; }
  }
</style>
</head>
<body>

<div class="page">

  <!-- ══ HEADER ══ -->
  <div class="header">
    <img class="logo" src="${logoUrl}" alt="PEACEXPERTS Logo" />
    <div class="header-text">
      <div class="inst-name">PEACEXPERTS ACADEMY, NASHIK</div>
      <div class="inst-sub">
        Reg. Under Ministry of Corporate Affairs (Govt. of India)<br/>
        Peacexperts Academy-MH2022PTC376485<br/>
        An ISO:9001:2015 Certified Organization
      </div>
    </div>
  </div>

  <!-- ══ TITLE ══ -->
  <div class="title-band">
    <div class="main-title">CANDIDATE ADMIT CARD</div>
    <div class="sub-title">Name of Candidate (As Filled By the Candidate In Institute Login Window)</div>
  </div>

  <!-- ══ CANDIDATE DETAILS ══ -->
  <div class="candidate-section">
    <table class="details-table">
      <tr>
        <td class="label">Allocated System (PC)</td>
        <td class="value">${esc(d.systemName)}</td>
      </tr>
      <tr>
        <td class="label">ROLL NO</td>
        <td class="value">${esc(d.rollNo)}</td>
      </tr>
      <tr>
        <td class="label">Student Name</td>
        <td class="value">${esc(d.studentName)}</td>
      </tr>
      <tr>
        <td class="label">Mother Name</td>
        <td class="value">${esc(d.motherName)}</td>
      </tr>
      <tr>
        <td class="label">UID</td>
        <td class="value">${esc(d.aadhaarNo)}</td>
      </tr>
      <tr>
        <td class="label">Course Name</td>
        <td class="value">${esc(d.courseName)}</td>
      </tr>
    </table>
    <div class="photo-cell">
      ${photoCell}
    </div>
  </div>

  <!-- ══ BATCH SCHEDULE ══ -->
  <div class="section-heading">BATCH SCHEDULE</div>

  <div class="schedule-header">
    <div class="col-head col-left">EXAM CENTRE</div>
    <div class="col-head col-right">SCHEDULE DETAILS</div>
  </div>

  <div class="schedule-outer">
    <div class="centre-cell">
      <div class="centre-name">${esc(d.instituteName)}</div>
      <div class="centre-addr">${esc(d.instituteAddress)}</div>
    </div>
    <table class="schedule-table">
      <tr>
        <td class="sch-label">Exam Date</td>
        <td class="sch-val">${esc(d.examDate)}</td>
      </tr>
      <tr>
        <td class="sch-label">Batch</td>
        <td class="sch-val">${esc(d.batchName)}</td>
      </tr>
      <tr>
        <td class="sch-label">Reporting Time</td>
        <td class="sch-val">${esc(d.reportingTime)}</td>
      </tr>
      <tr>
        <td class="sch-label">Gate Closing Time</td>
        <td class="sch-val">${esc(d.gateClosingTime)}</td>
      </tr>
      <tr>
        <td class="sch-label">Exam Start Time</td>
        <td class="sch-val">${esc(d.examStartTime)}</td>
      </tr>
      <tr>
        <td class="sch-label">Exam Duration</td>
        <td class="sch-val">${esc(d.examDuration)}</td>
      </tr>
    </table>
  </div>

  <!-- ══ INSTRUCTIONS ══ -->
  <div class="instructions">
    <div class="inst-head">IMPORTANT INSTRUCTIONS:</div>
    <ol>
      <li>Carry this admit card along with a valid Govt. ID (Aadhaar/PAN/Voter ID).</li>
      <li>Reach the examination center at least 30 minutes before the Reporting Time.</li>
      <li>Mobile phones, calculators, and electronic gadgets are strictly prohibited in the Exam Hall.</li>
      <li>No candidate will be allowed to enter the hall after the Gate Closing Time.</li>
    </ol>
  </div>

  <!-- ══ FOOTER ══ -->
  <div class="footer-band">
    CANDIDATE MUST SIGN IN THE PRESENCE OF THE INVIGILATOR
  </div>
  <div class="sign-row">
    <div class="sign-box">Candidate Sign</div>
    <div class="sign-box">Institute Seal</div>
    <div class="sign-box">HOEi Sign</div>
  </div>

</div>

<script>
  window.onload = function() {
    window.print();
  };
</script>
</body>
</html>`;
}

/** HTML-escape a value to prevent injection */
function esc(val: string | null | undefined): string {
  return String(val ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
