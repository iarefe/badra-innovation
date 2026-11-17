// Smoke-test the actual production Worker artifact, not a simulated document.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),runtimeRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=runtimeRequire('miniflare');
const root=path.resolve('dist/server'),config=JSON.parse(await fs.readFile(path.join(root,'wrangler.json'),'utf8'));
const modules=[];
async function collect(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory()){await collect(file);continue}if(!item.name.endsWith('.js')&&!item.name.endsWith('.mjs'))continue;modules.push({path:file,type:'ESModule',contents:await fs.readFile(file,'utf8')})}}
await collect(root);modules.sort((a,b)=>a.path===path.join(root,config.main)?-1:b.path===path.join(root,config.main)?1:0);
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const f of (await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()){for(const statement of (await fs.readFile(path.join('drizzle',f),'utf8')).split('--> statement-breakpoint')){for(const part of statement.split(';').filter(x=>x.trim()))await db.prepare(part.trim()).run()}}
 const fields={title:'فحص ملف بطاقة التحدي',scope:'داخلي',domain:'المعرفة والبيانات',department:'فريق التحقق',author:'صاحب الاختبار',ownership:'individual',initialSolutionStatus:'none',situation:'وصف الحالة',stakeholders:'المشاركون',need:'توضيح الحاجة',frequency:'أسبوعيًا',impact:'وضوح الأثر',evidence:'شاهد مسجّل',workaround:'الوضع الحالي',success:'زيادة الوضوح',question:'كيف نتحقق من الأثر؟'};
 const id=randomUUID(),employee=randomUUID(),secret='b'.repeat(64),digest=x=>createHash('sha256').update(x).digest('hex');
 await db.prepare('INSERT INTO employees(id,number,name,email,department,phone,active,created_at,roles) VALUES(?,?,?,?,?,?,1,?,?)').bind(employee,'qa','صاحب الاختبار','qa@example.invalid','فريق التحقق','+12025550155',Date.now(),'["innovator"]').run();
 await db.prepare('INSERT INTO employee_sessions(digest,employee_id,expires_at) VALUES(?,?,?)').bind(digest(secret),employee,Date.now()+600000).run();
 await db.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,updated_at) VALUES(?,?,?,'draft',1,1)").bind(id,'employee:'+employee,JSON.stringify(fields)).run();
 const get=(key,cookie='')=>mf.dispatchFetch('https://site.test/api/challenge-pdf?id='+key,{headers:cookie?{Cookie:'__Host-badra-employee='+cookie}:{}});
 assert.equal((await get(id)).status,404,'A guest cannot download a private draft.');
 assert.equal((await get(id,'c'.repeat(64))).status,404);
 const verify=async(r)=>{assert.equal(r.status,200,'Download status');assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('content-disposition'),/attachment;.*filename\*=UTF-8''/);assert.match(r.headers.get('cache-control'),/no-store/);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(0,5).toString(),'%PDF-');assert(b.length>7000);return b};
 await verify(await get(id,secret));
 await db.prepare("UPDATE challenges SET status='published' WHERE id=?").bind(id).run();
 await verify(await get(id));const sample=await verify(await get('example-1'));if(process.argv[2])await fs.writeFile(process.argv[2],sample);
 assert.equal((await get('missing')).status,404);
 console.log('PASS: production Worker serves real Arabic PDF downloads for published challenges and examples; drafts require their owner or manager, invalid sessions and missing IDs are denied.');
}finally{await mf.dispose()}
