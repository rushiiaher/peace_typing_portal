/**
 * RBAC access-matrix self-check.
 * Mirrors checkAccess() in src/utils/supabase/middleware.ts.
 * Run: node scripts/test-rbac.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'src', 'utils', 'supabase', 'middleware.ts'), 'utf-8');

// Extract the pure function + its tables from the TS source (strip types).
const start = src.indexOf('// ── Pure access-control decision');
const body = src
    .slice(start)
    .replace(/export type AccessDecision = \{[\s\S]*?\}\r?\n/, '')
    .replace(/: Array<\[string, string, string\]>/g, '')
    .replace(/: Record<string, string>/g, '')
    .replace(/export function checkAccess\(path: string, role\?: string\): AccessDecision/, 'function checkAccess(path, role)')
    .replace(/^export /gm, '')
    .replace(/ as AccessDecision/g, '');

const checkAccess = new Function(`${body}; return checkAccess;`)();

const S = 'student', I = 'institute_admin', A = 'super_admin';
const cases = [
    // path,                          role,      expected action
    ['/superadmin/dashboard', S, 'redirect'],   // the reported vuln
    ['/superadmin/dashboard', I, 'redirect'],
    ['/superadmin/dashboard', A, 'allow'],
    ['/api/admin/exams', S, 'forbidden'],  // student hitting admin API
    ['/api/admin/final-results', I, 'forbidden'],
    ['/api/admin/exams', A, 'allow'],
    ['/institute/students', S, 'redirect'],
    ['/institute/dashboard', I, 'allow'],
    ['/api/institute/students', S, 'forbidden'],
    ['/api/institute/students', I, 'allow'],
    ['/student/dashboard', S, 'allow'],
    ['/student/dashboard', I, 'redirect'],
    ['/api/student/exams', I, 'forbidden'],
    ['/api/student/exams', S, 'allow'],
    // unauthenticated
    ['/superadmin/dashboard', undefined, 'redirect'],
    ['/api/admin/exams', undefined, 'unauthorized'],
    ['/student/dashboard', undefined, 'redirect'],
    // public + exempt stay reachable
    ['/', S, 'allow'],
    ['/superadmin/login', S, 'allow'],
    ['/student/login', undefined, 'allow'],
    ['/api/student/verify-login', I, 'allow'],
    ['/api/institute/verify-login', S, 'allow'],
];

let pass = 0;
for (const [p, role, expected] of cases) {
    const got = checkAccess(p, role).action;
    assert.strictEqual(got, expected, `${p} as ${role ?? 'anon'} → expected ${expected}, got ${got}`);
    pass++;
}
console.log(`RBAC access matrix: ${pass}/${cases.length} cases passed`);
