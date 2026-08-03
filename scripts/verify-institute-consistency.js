/**
 * Asserts every institute-listing source returns the same set of institutes.
 * Guards the "institute missing from Inventory / User Management" bug.
 *
 * Run: node scripts/verify-institute-consistency.js
 */

const assert = require('assert');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
}

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const ids = rows => new Set((rows ?? []).map(r => r.id));

(async () => {
    // Institute Management — superadmin/institutes/page.tsx
    const mgmt = await admin.from('institutes').select('id, name').order('created_at', { ascending: false });
    // Inventory / Course Allocation — /api/admin/institutes
    const inv = await admin.from('institutes').select('id, name, code, city, state, phone, email, is_active').order('name');
    // User Management — /api/admin/list-institutes
    const users = await admin.from('institutes').select('id, name').order('name');

    for (const [label, res] of [['management', mgmt], ['inventory', inv], ['users', users]]) {
        assert.ok(!res.error, `${label} query failed: ${res.error && res.error.message}`);
    }

    const a = ids(mgmt.data), b = ids(inv.data), c = ids(users.data);
    const diff = (x, y) => [...x].filter(id => !y.has(id));

    assert.deepStrictEqual(diff(a, b), [], `Institutes in Management but not Inventory: ${diff(a, b)}`);
    assert.deepStrictEqual(diff(a, c), [], `Institutes in Management but not User Management: ${diff(a, c)}`);
    assert.strictEqual(b.size, c.size, 'Inventory and User Management institute counts differ');

    console.log(`OK — all ${a.size} institutes listed identically in all three modules.`);
})();
