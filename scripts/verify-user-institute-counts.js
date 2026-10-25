// Read-only check: list-users returns every student/admin past the 1000-row cap; dashboard counts are exact.
// Run from repo root: node scripts/verify-user-institute-counts.js
const root=process.cwd(), req=m=>require(require.resolve(m,{paths:[root]}));
const ts=req('typescript'),fs=require('fs'),Module=require('module'),assert=require('assert');
for (const line of fs.readFileSync('.env.local','utf-8').split('\n')){const [k,...r]=line.split('=');if(k&&r.length)process.env[k.trim()]=r.join('=').trim();}
const orig=Module._resolveFilename;
Module._resolveFilename=function(r,p,...a){ if(r==='@/utils/supabase/server')return '/stub'; try{return orig.call(this,r,p,...a)}catch{return orig.call(this,r,{...p,paths:[root+'/node_modules']},...a)} };
require.cache['/stub']={id:'/stub',filename:'/stub',loaded:true,exports:{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})}};
const load=f=>{const js=ts.transpileModule(fs.readFileSync(root+f,'utf8'),{compilerOptions:{module:1,target:7,esModuleInterop:true}}).outputText;const m=new Module(root+'/x.js');m.paths=Module._nodeModulePaths(root);m._compile(js,root+'/x.js');return m.exports;};
(async()=>{
  const { createClient } = req('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const count = async (t, active) => { let q = db.from(t).select('id', { count: 'exact', head: true }); if (active) q = q.eq('is_active', true); return (await q).count; };
  const users = (await (await load('/src/app/api/admin/list-users/route.ts').GET()).json()).users;
  const st = users.filter(u => u.role === 'student'), ad = users.filter(u => u.role === 'institute_admin');
  assert.equal(st.length, await count('students')); assert.equal(new Set(st.map(u => u.id)).size, st.length);
  assert.equal(ad.length, await count('institute_admins')); assert.equal(new Set(ad.map(u => u.id)).size, ad.length);
  const s = (await (await load('/src/app/api/admin/dashboard/route.ts').GET()).json()).stats;
  assert.equal(s.total_institutes, await count('institutes')); assert.equal(s.active_institutes, await count('institutes', true));
  assert.equal(s.total_students, await count('students')); assert.equal(s.active_students, await count('students', true));
  console.log(`ok — students ${st.length}, admins ${ad.length}, institutes ${s.total_institutes} (${s.active_institutes} active)`);
})().catch(e => { console.error(e); process.exit(1); });
