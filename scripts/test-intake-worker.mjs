// Run the built Worker with isolated D1. Never changes the live workshop or sends a verification code.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wr('miniflare'),root=path.resolve('dist/server'),config=JSON.parse(await fs.readFile(path.join(root,'wrangler.json'),'utf8')),modules=[];
async function collect(dir){for(const it of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,it.name);if(it.isDirectory())await collect(f);else if(/\.m?js$/.test(it.name))modules.push({path:f,type:'ESModule',contents:await fs.readFile(f,'utf8')})}}
await collect(root);modules.sort((a,b)=>a.path===path.join(root,config.main)?-1:b.path===path.join(root,config.main)?1:0);
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const f of (await fs.readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const s of (await fs.readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))for(const part of s.split(';').filter(x=>x.trim()))await db.prepare(part).run();
 const get=(p,ck)=>mf.dispatchFetch('https://site.test'+p,{headers:ck?{Cookie:'__Host-badra-employee='+ck}:{}});
 const visible=async(p,ck)=>{const res=await get(p,ck);assert.equal(res.status,200);return (await res.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')};
 await db.prepare("INSERT INTO workshop_settings(id,title,count,open,finalized,revision,intake_paused) VALUES(1,'هاكاثون الابتكار الرقمي',3,1,0,0,1)").run();
 const actor=randomUUID(),cookie=createHash('sha256').update(randomUUID()).digest('hex'),id=randomUUID();
 await db.prepare("INSERT INTO employees(id,name,phone,department,roles,created_at) VALUES(?,'مدير تجريبي',?,'الإدارة','[\"innovator\"]',1)").bind(actor,'+966599999901').run();
 await db.prepare('INSERT INTO employee_sessions VALUES(?,?,?)').bind(createHash('sha256').update(cookie).digest('hex'),actor,Date.now()+60000).run();
 await db.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',1,1,1)").bind(id,'employee:'+actor,JSON.stringify({title:'تحدي متابعة المنح في إدارة المشاريع',domain:'المنح والمشاريع',scope:'داخلي',author:'فريق تجريبي',situation:'يتأخر حصر المستندات المستلمة وتحديد متطلبات الصرف في المشاريع المدعومة.',stakeholders:'فريق المنح',need:'متابعة الحالة',frequency:'أسبوعيًا',impact:'تأخر الدراسة',evidence:'التجربة',workaround:'الاستفسار',success:'انخفاض الوقت',department:'المنح'})).run();
 const gate=await get('/api/intake'),state=await gate.json();assert.equal(state.manualPause,true);assert.match(gate.headers.get('Cache-Control'),/no-store/);
 const [home,submit,wall,deck,admin]=await Promise.all(['/','/submit','/challenges?participate=join','/presentation','/admin'].map((p,i)=>visible(p,i===4?cookie:undefined)));
 assert(!home.includes('class="bh-add-strip"'));assert(!home.includes('data-badra-anchor="participate"'));assert(!deck.includes('href="https://example.invalid/submit"'));assert(deck.includes('https://example.invalid/challenges'));
 assert(submit.includes('id="intake-title"'));assert(!submit.includes('registration-stage'));assert(!wall.includes('> أضف تحديًا</button>'));
 assert(admin.includes('aria-label="استقبال التحديات"')&&admin.includes('جدولة المشاركة'));assert.equal((await get('/admin')).status,404);
 if(state.serverNow>=state.opensAt&&state.serverNow<state.engagementEndsAt){
  assert(home.indexOf('id="challenges"')<home.indexOf('id="home-roles"'));assert(home.includes('/challenges?participate=vote')&&home.includes('/challenges?participate=join'));
  if(state.serverNow<state.closesAt)assert(admin.includes('استئناف الاستقبال ضمن الموعد'));
 }
 console.log('PASS: built site serves the stored schedule, non-publishing submit landing, correct library and kiosk links, contextual home, and manager-only controls.');
}finally{await mf.dispose()}
