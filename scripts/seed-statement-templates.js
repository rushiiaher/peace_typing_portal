/**
 * Seed statement_templates — the table was empty, so exams showed
 * "No statement template assigned". Creates one active template per course
 * so future exam scheduling can auto-assign real statement content.
 *
 * Idempotent: skips a course that already has an active statement template.
 * Run: node scripts/seed-statement-templates.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
for (const l of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [k, ...r] = l.split('='); if (k && r.length) process.env[k.trim()] = r.join('=').trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } });

const englishSalesRegister = JSON.stringify({
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
});

const marathiStockRegister = JSON.stringify({
    data: [
        ['', 'पुस्तक साठा नोंदणी - ग्रंथालय', '', '', ''],
        ['', '', '', '', ''],
        ['अ.क्र.', 'पुस्तकाचे नाव', 'लेखक', 'प्रती', 'किंमत'],
        ['१', 'श्यामची आई', 'साने गुरुजी', '५०', '१२०'],
        ['२', 'ययाती', 'वि.स. खांडेकर', '३०', '२५०'],
        ['३', 'मृत्युंजय', 'शिवाजी सावंत', '४०', '३००'],
        ['४', 'बटाट्याची चाळ', 'पु.ल. देशपांडे', '२५', '१८०'],
        ['५', 'कोसला', 'भालचंद्र नेमाडे', '२०', '२२०'],
        ['एकूण', '', '', '१६५', ''],
    ],
    merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }],
});

const hindiRegister = JSON.stringify({
    data: [
        ['', 'मासिक बिक्री रजिस्टर - २०२४', '', '', ''],
        ['', '', '', '', ''],
        ['क्र.', 'वस्तु का नाम', 'जनवरी', 'फरवरी', 'मार्च'],
        ['१', 'लैपटॉप', '४५', '५२', '३८'],
        ['२', 'प्रिंटर', '१५', '२०', '१२'],
        ['३', 'कीबोर्ड', '६०', '७५', '५५'],
        ['४', 'माउस', '८०', '९०', '७०'],
        ['५', 'मॉनिटर', '३५', '४०', '२८'],
        ['कुल', '', '२३५', '२७७', '२०३'],
    ],
    merges: [{ s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }],
});

function contentFor(name) {
    const n = name.toLowerCase();
    if (n.includes('marathi')) return { title: 'पुस्तक साठा नोंदणी (Book Stock Register)', content: marathiStockRegister };
    if (n.includes('hindi')) return { title: 'मासिक बिक्री रजिस्टर (Monthly Sales Register)', content: hindiRegister };
    return { title: 'Monthly Sales Register', content: englishSalesRegister };
}

async function main() {
    const { data: courses } = await s.from('courses').select('id, name').order('name');
    const rows = [];
    for (const c of courses ?? []) {
        const { count } = await s.from('statement_templates')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', c.id).eq('is_active', true);
        if (count && count > 0) { console.log(`skip ${c.name} (has ${count})`); continue; }
        const { title, content } = contentFor(c.name);
        rows.push({ course_id: c.id, title, template_content: content, is_active: true });
        console.log(`queue ${c.name} -> ${title}`);
    }
    if (!rows.length) { console.log('Nothing to seed.'); return; }
    const { data, error } = await s.from('statement_templates').insert(rows).select('id, course_id, title');
    if (error) { console.error('insert failed:', error.message); process.exit(1); }
    console.log(`\nInserted ${data.length} statement templates.`);
    for (const r of data) console.log('  ', r.id, r.title);
}
main().catch(e => { console.error(e); process.exit(1); });
