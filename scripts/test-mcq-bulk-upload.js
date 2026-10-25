// Stubbed end-to-end check of MCQ bulk upload (no real DB calls). Run from repo root: node scripts/test-mcq-bulk-upload.js
const root = process.cwd();
const req = (m) => require(require.resolve(m, { paths: [root] }));
const ts = req('typescript'), fs = require('fs'), Module = require('module'), assert = require('assert');
const XLSX = req('xlsx');
const src = fs.readFileSync(root + '/src/app/api/admin/content/bulk-upload/route.ts', 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (r, p, ...a) {
  if (r === '@/utils/supabase/server') return '/stub-server';
  try { return origResolve.call(this, r, p, ...a); } catch { return origResolve.call(this, r, { ...p, paths: [root + '/node_modules'] }, ...a); }
};
require.cache['/stub-server'] = { id: '/stub-server', filename: '/stub-server', loaded: true,
  exports: { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u' } } }) } }) } };
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://stub.local'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
let inserts = [], existing = [];
globalThis.fetch = async (url, init = {}) => {
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'POST') { const rows = JSON.parse(init.body); inserts.push(...rows); return new Response('', { status: 201 }); }
  return new Response(JSON.stringify(existing), { status: 200, headers: { 'content-type': 'application/json' } });
};
const m = new Module(root + '/route.js'); m.paths = Module._nodeModulePaths(root); m._compile(js, root + '/route.js');
const { POST } = m.exports; const { NextRequest } = req('next/server');

async function upload(aoa, name = 'q.xlsx', bookType = 'xlsx') {
  inserts = [];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S');
  const buf = XLSX.write(wb, { type: 'buffer', bookType });
  const fd = new FormData(); fd.append('file', new File([buf], name)); fd.append('course_id', 'c7002');
  const res = await POST(new NextRequest('http://x/api/admin/content/bulk-upload?type=mcq_question_bank', { method: 'POST', body: fd }));
  return { status: res.status, json: await res.json(), inserts };
}

(async () => {
  // 1. canonical headers
  let r = await upload([['question','option_a','option_b','option_c','option_d','correct_answer','explanation'], ['Q1','a1','b1','c1','d1','b','why']]);
  assert.equal(r.json.inserted, 1); assert.equal(r.inserts[0].correct_answer, 'b'); assert.equal(r.inserts[0].explanation, 'why');
  // 2. human headers, title row, odd answers, blank row
  r = await upload([['English 40 WPM MCQ'], [], ['Sr','Question ','Option A','Option B','OPTION-C','Option D','Correct Answer'],
    [1,'Q2','x','y','z','w','Option C'], [2,'Q3','x','y','z','w','(A)'], [3,'Q4','Red','Blue','Green','Pink','Blue'], [4,'Q5','x','y','z','w','4'], ['', '', '', '', '', '', '']]);
  assert.equal(r.status, 201, JSON.stringify(r.json)); assert.deepEqual(r.inserts.map(x => x.correct_answer), ['c','a','b','d']); assert.equal(r.json.errors.length, 0);
  // 3. missing columns → 400 clear message
  r = await upload([['question','option_a','answer'], ['Q','a','a']]);
  assert.equal(r.status, 400); assert.match(r.json.error, /option_b, option_c, option_d/);
  // 4. invalid rows reported, valid ones still imported
  r = await upload([['question','option_a','option_b','option_c','option_d','correct_answer'], ['Q6','a','b','c','d','e'], ['Q7','a','','c','d','a'], ['Q8','a','b','c','d','a']]);
  assert.equal(r.json.inserted, 1); assert.match(r.json.errors[0], /Row 2: "correct_answer"/); assert.match(r.json.errors[1], /Row 3: option_b/);
  // 5. duplicates: existing in DB + repeated in file
  existing = [{ question: 'q9  ' }];
  r = await upload([['question','option_a','option_b','option_c','option_d','correct_answer'], ['Q9','a','b','c','d','a'], ['Q10','a','b','c','d','a'], ['q10','a','b','c','d','a']]);
  assert.equal(r.json.inserted, 1); assert.equal(r.json.errors.filter(e => /duplicate/.test(e)).length, 2); existing = [];
  // 6. csv works, bad extension rejected
  r = await upload([['Question','Option A','Option B','Option C','Option D','Answer'], ['Q11','a','b','c','d','D']], 'q.csv', 'csv');
  assert.equal(r.json.inserted, 1); assert.equal(r.inserts[0].correct_answer, 'd');
  r = await upload([['question']], 'q.pdf'); assert.equal(r.status, 400); assert.match(r.json.error, /Unsupported file type/);
  console.log('all MCQ bulk-upload checks passed');
})().catch(e => { console.error(e); process.exit(1); });
