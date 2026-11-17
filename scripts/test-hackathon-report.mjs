// Exercise the real Worker, D1 joins and PDF stream with invented people only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';

const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const model=await build({entryPoints:['lib/server/hackathon-report.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {readHackathonReport,reportDay}=await import('data:text/javascript;base64,'+Buffer.from(model.outputFiles[0].text).toString('base64'));
const renderModel=await build({entryPoints:['lib/server/hackathon-report-summary.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {reportOverview}=await import('data:text/javascript;base64,'+Buffer.from(renderModel.outputFiles[0].text).toString('base64'));
assert.equal(reportDay(Date.parse('2026-11-11T21:05:00Z')),'2026-11-12');
const root=path.resolve('dist/server'),config=JSON.parse(await fs.readFile(path.join(root,'wrangler.json'),'utf8')),modules=[];
async function collect(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await collect(file);else if(/\.m?js$/.test(item.name))modules.push({path:file,type:'ESModule',contents:await fs.readFile(file,'utf8')})}}
await collect(root);modules.sort((a,b)=>a.path===path.join(root,config.main)?-1:b.path===path.join(root,config.main)?1:0);
// No R2 import: the production directory/photo seed must never appear in a test PDF.
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,d1Databases:['DB'],cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const f of (await fs.readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const s of (await fs.readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))for(const stmt of s.trim().split(';').filter(x=>x.trim()))await db.prepare(stmt).run();
 const run=(s,...p)=>db.prepare(s).bind(...p).run();
 const emp=async(name,phone,{num=null,mark=null,roles='[]',active=1,dept=''}={})=>{const id=randomUUID();await run('INSERT INTO employees(id,name,number,phone,roles,active,department,created_at,signed_in) VALUES(?,?,?,?,?,?,?,1,?)',id,name,num,phone,roles,active,dept,mark);return id};
 const session=async id=>{const key=createHash('sha256').update(randomUUID()).digest('hex');await run('INSERT INTO employee_sessions VALUES(?,?,?)',createHash('sha256').update(key).digest('hex'),id,Date.now()+600000);return key};
 const get=(p,token,headers={})=>mf.dispatchFetch('https://site.test'+p,{headers:{...headers,...(token?{Cookie:'__Host-badra-employee='+token}:{})}});
 const url='/api/admin/hackathon-report';
 assert.equal((await get(url,null,{'oai-authenticated-user-email':'admin@example.invalid'})).status,401);
 let data=await readHackathonReport(db);assert.deepEqual([data.published,data.reach.entered,data.voters,data.joiners],[0,0,0,0]);
 const reachUrl='/api/admin/employee-reach',visitUrl='/api/portal-visit';
 assert.equal((await get(reachUrl)).status,401);
 const admin=await emp('مدير تجريبي','+966599999901',{roles:'["innovator"]',dept:'التطوير'}),adminCookie=await session(admin);
 const other=await emp('مشارك تجريبي','+12025550101',{roles:'["innovator"]',dept:'المنح'}),otherCookie=await session(other);
 assert.equal((await get(url,otherCookie)).status,403);assert.equal((await get(reachUrl,otherCookie)).status,403);
 const anonPage=await get('/admin');assert.equal(anonPage.status,404);assert(!(await anonPage.text()).includes('تصدير تقرير الهاكاثون'));
 const verified=async(res)=>{assert.equal(res.status,200);assert.match(res.headers.get('Content-Type'),/^application\/pdf/);assert.match(res.headers.get('Content-Disposition'),/attachment;.*filename\*=UTF-8''/);assert.match(res.headers.get('Cache-Control'),/no-store/);const b=Buffer.from(await res.arrayBuffer());assert.equal(b.subarray(0,5).toString(),'%PDF-');return b};
 await verified(await get(url,adminCookie)); // No challenges or prospective employees.
 const prospect=async(name,phone,link=null)=>{const id=randomUUID();await run('INSERT INTO prospective_employees(id,name,phone,linked_employee_id,created_at,updated_at) VALUES(?,?,?,?,1,1)',id,name,phone,link);return id};
 await prospect('اسم الموظف في الدليل','+12025550101',other);
 const noName=await emp('','+12025550102');await prospect('اسم مقترح للتجربة','+12025550102');
 const declined=await emp('مشاركة باسمها','+12025550103');const denied=await prospect('سجل ينتظر المطابقة','+12025550103');
 await run('INSERT INTO prospective_declines VALUES(?,?,0)',declined,denied);
 await emp('حساب مُجهّز','+12025550104',{num:'new',mark:0,dept:'المعرفة والبيانات'});await prospect('حساب مُجهّز','+12025550104');
 await emp('سجل قديم','+12025550105',{num:'old'});await prospect('سجل قديم','+12025550105');
 await emp('حساب سبق دخوله','+12025550106',{num:'left',mark:1,active:0,dept:'العمليات'}); // No session, currently suspended.
 await prospect('موظفة من الدليل','+12025550107');
 const addCard=async(title,status,owner=admin,name='مدير تجريبي')=>{const id=randomUUID();await run('INSERT INTO challenges(id,owner,payload,status,created_at,updated_at,published_at) VALUES(?,?,?,?,1,1,?)',id,'employee:'+owner,JSON.stringify({title,author:name}),status,status==='published'?1:null);return id};
 const a=await addCard('تقليل زمن متابعة طلبات المنح','published'),b=await addCard('توحيد بيانات المستفيدين في ERP 2026','published'),draft=await addCard('تحسين إجراءات الاجتماعات الداخلية','draft');
 const vote=(card,actor)=>run('INSERT INTO challenge_votes VALUES(?,?)',card,actor);
 const join=(card,user)=>run('INSERT INTO challenge_interests VALUES(?,?,1)',card,user);
 for(const card of [a,b]){await vote(card,'employee:'+other);await join(card,other)}
 await vote(a,'employee:'+admin);await vote(a,'guest:old');await join(a,admin);
 await vote(b,'employee:'+declined);await vote(draft,'employee:'+noName);await join(draft,noName);
 data=await readHackathonReport(db);
 assert.deepEqual([data.reach.confirmed,data.published,data.voters,data.joiners,data.reach.total],[1,2,2,1,6]);
 assert.deepEqual(data.challenges.map(c=>[c.title,c.votes,c.interests]).sort(),[
  ['تقليل زمن متابعة طلبات المنح',1,1],['توحيد بيانات المستفيدين في ERP 2026',2,1],['تحسين إجراءات الاجتماعات الداخلية',1,1]].sort());
 assert.deepEqual([data.reach.entered,data.reach.waiting,data.reach.unknown,data.reach.outside.length],[2,2,2,3]);
 const overview=reportOverview(data);
 assert.deepEqual([overview.voteTotal,overview.interestTotal,overview.voted,overview.withInterest,overview.draftCount],[3,2,2,2,1]);
 assert.equal(overview.approved,false);assert.deepEqual(overview.picks.map(c=>c.id),[b,a]);
 // Switching to the final list must use the snapshot even if the live name, count, or ordering differs.
 await run("INSERT INTO workshop_settings(id,title,count,open,finalized) VALUES(1,'هاكاثون الابتكار الرقمي',1,0,1)");
 await run('INSERT INTO workshop_selection(challenge_id,payload,votes,rank) VALUES(?,?,7,1)',a,JSON.stringify({title:'عنوان محفوظ عند اعتماد القائمة'}));
 const frozen=reportOverview(await readHackathonReport(db));
 assert.equal(frozen.approved,true);assert.deepEqual(frozen.picks.map(c=>[c.id,c.title,c.votes]),[[a,'عنوان محفوظ عند اعتماد القائمة',7]]);
 await verified(await get(url,adminCookie));await run('UPDATE workshop_settings SET finalized=0,open=0 WHERE id=1');
 assert.equal((await readHackathonReport(db)).workshop.state,'paused');
 assert.equal((await readHackathonReport(db)).workshop.selection.length,0);
 await run('UPDATE workshop_settings SET open=1,count=3 WHERE id=1');
 const none=reportOverview({...data,published:0,challenges:data.challenges.filter(c=>c.status!=='published')});assert.equal(none.picks.length,0);assert.equal(none.voteTotal,0);
 const tied=reportOverview({...data,challenges:data.challenges.map(c=>({...c,votes:1,publishedAt:c.id===a?20:10}))});
 assert.deepEqual(tied.published.map(c=>c.id),[b,a]);
 const find=(reach,name)=>reach.rows.find(p=>p.name===name);
 assert.equal(find(data.reach,'اسم الموظف في الدليل').status,'entered');
 assert.equal(find(data.reach,'اسم مقترح للتجربة').status,'entered'); // Display the directory name, not a masked number.
 assert.equal(find(data.reach,'حساب مُجهّز').status,'waiting');assert.equal(find(data.reach,'سجل قديم').status,'unknown');
 assert(!JSON.stringify(data).includes('+1202'));assert(!JSON.stringify(data).includes(adminCookie));
 assert.deepEqual(await (await get(reachUrl,adminCookie)).json(),data.reach,'The PDF and dashboard use identical numbers and people.');
 const passive=await emp('ملف مكتمل بلا دخول','+12025550108',{num:'passive',roles:'["innovator"]',mark:0});
 await prospect('موظف بجلسة محفوظة','+12025550108',passive);
 const oldOnly=await emp('حساب قديم مسجل','+12025550109',{roles:'["developer"]'});
 await prospect('سجل قديم بلا دخول موثّق','+12025550109',oldOnly);
 let presence=(await readHackathonReport(db)).reach;
 assert.equal(find(presence,'موظف بجلسة محفوظة').status,'waiting','Confirmed name, roles and a phone-number match are not proof of login.');
 assert.equal(find(presence,'سجل قديم بلا دخول موثّق').status,'unknown','A historical registration alone is not evidence.');
 const visit=(cookie,extra={})=>mf.dispatchFetch('https://site.test'+visitUrl,{method:'POST',headers:{'X-Badra-Visit':'visible',...(cookie?{Cookie:'__Host-badra-employee='+cookie}:{}),...extra}});
 assert.equal((await visit('')).status,401);const remember=await session(passive);
 assert.equal((await visit(remember,{Origin:'https://external.invalid'})).status,403);
 const before=Date.now();assert.equal((await visit(remember)).status,204);assert.equal((await visit(remember)).status,204);
 await run('DELETE FROM employee_sessions WHERE employee_id=?',passive);
 presence=(await readHackathonReport(db)).reach;
 assert.equal(presence.entered,3);assert.equal(presence.total,8);assert.equal(presence.rows.length,presence.total);
 assert(find(presence,'موظف بجلسة محفوظة').lastAccessAt>=before);assert.equal(find(presence,'سجل قديم بلا دخول موثّق').lastAccessAt,null);
 assert.equal(presence.entered+presence.waiting+presence.unknown,presence.total);
 const samples=process.argv[3]==='sample';
 if(samples){
  await run("INSERT OR REPLACE INTO workshop_settings(id,title,count,open) VALUES(1,?,3,1)",'مثال توضيحي ببيانات تجريبية · هاكاثون الابتكار الرقمي');
  await run('UPDATE employees SET signed_in=0 WHERE number=?','old');await run('DELETE FROM prospective_declines WHERE prospective_id=?',denied);
  await run('UPDATE employees SET signed_in=0 WHERE id=?',oldOnly);
  // Distinct fictitious names and issues make the public, clearly marked layout sample legible.
  for(const [from,to] of [['اسم الموظف في الدليل','سالم العبدلي'],['اسم مقترح للتجربة','ريم السالم'],['سجل ينتظر المطابقة','مشارك تجريبي الناصر'],['موظف بجلسة محفوظة','سارة الحامد'],['حساب مُجهّز','هادي الواصل'],['سجل قديم','أميرة الغامدي'],['سجل قديم بلا دخول موثّق','مشعل المنيع'],['موظفة من الدليل','هند الراشد']])await run('UPDATE prospective_employees SET name=? WHERE name=?',to,from);
  await run('UPDATE employees SET name=?,last_access_at=? WHERE id=?','سالم العبدلي',Date.now()-86400000,other);
  await run('UPDATE employees SET name=?,last_access_at=? WHERE id=?','ريم السالم',Date.now()-3600000,noName);
  await run('UPDATE employees SET name=? WHERE id=?','منسق المبادرة',admin);
  await run("UPDATE employees SET name='محللة المنح' WHERE number='left'");
  const edits=[
   [a,'تقليل زمن متابعة طلبات المنح','سالم العبدلي','المنح والمشاريع','داخلي وخارجي','تتوزع مستندات الطلب بين قنوات مختلفة، فيضطر الفريق إلى سؤال الجهة أكثر من مرة عن المرفق نفسه.'],
   [b,'توحيد بيانات المستفيدين بين إدارات المؤسسة','ريم السالم','المعرفة والبيانات','داخلي','تُحدّث الإدارات بيانات المستفيدين في ملفات منفصلة، فيستغرق إعداد تقرير موحّد وقتًا في مطابقة الأسماء.'],
   [draft,'متابعة قرارات الاجتماعات حتى التنفيذ','سارة الحامد','العمليات والاجتماعات','داخلي','تُحفظ القرارات في محاضر متفرقة، ولا يرى فرق العمل مَن يتابع كل قرار أو متى يستحق.']
  ];
  const extra=await addCard('وضوح متطلبات المنحة للجهات الجديدة','published',other,'مشارك تجريبي الناصر');
  edits.push([extra,'وضوح متطلبات المنحة للجهات الجديدة','مشارك تجريبي الناصر','تجربة الجهات المستفيدة','خارجي','تعود بعض الجهات للاستفسار عن المستندات المطلوبة بعد رفع طلبها الأول، مما يؤخر استكمال الدراسة.']);
  const archive=await addCard('الوصول إلى النسخة المعتمدة من الإجراء','published',passive,'سارة الحامد');
  edits.push([archive,'الوصول إلى النسخة المعتمدة من الإجراء','سارة الحامد','المعرفة والبيانات','داخلي','يصعب على الموظف معرفة آخر نسخة معتمدة من إجراء العمل عندما تصل التحديثات عبر البريد فقط.']);
  for(const [id,title,author,domain,scope,situation] of edits)await run('UPDATE challenges SET payload=? WHERE id=?',JSON.stringify({title,author,domain,scope,situation}),id);
  await run('UPDATE challenges SET owner=? WHERE id=?','employee:'+other,a);await run('UPDATE challenges SET owner=? WHERE id=?','employee:'+noName,b);await run('UPDATE challenges SET owner=? WHERE id=?','employee:'+declined,extra);
  await vote(a,'employee:'+passive);await vote(b,'employee:'+passive);await vote(extra,'employee:'+noName);await vote(extra,'employee:'+declined);
  await join(extra,passive);await join(extra,noName);await join(b,declined);

 }else{
 for(let i=1;i<=30;i++)await prospect('موظف تجريبي '+i,null);
 const titles=['تقليص وقت مطابقة بيانات المشاريع بين الإدارات عند إعداد تقارير الأثر','تتبّع طلبات الصرف من اكتمال المسوغات إلى اعتماد الدفعة','تنسيق مواعيد اجتماعات اللجان ومتابعة قراراتها'];
 for(let i=1;i<=12;i++)await addCard(titles[i%3]+' '+i,i%5===0?'draft':'published',other,'مشارك تجريبي');
 }
 const file=await verified(await get(url,adminCookie));if(process.argv[2])await fs.writeFile(process.argv[2],file);
 const panel=await get('/admin',adminCookie);assert.equal(panel.status,200);const html=await panel.text();assert(html.includes('التشغيل والأدوات'),'The manager can reach the operations section.');const reportControl=await fs.readFile('app/components/admin-report-download.tsx','utf8');assert(reportControl.includes(url)&&reportControl.includes('تصدير تقرير الهاكاثون'),'The report control retains its authenticated download route.');
 await run('UPDATE employees SET active=0 WHERE id=?',admin);assert.equal((await get(url,adminCookie)).status,401);assert.equal((await get(reachUrl,adminCookie)).status,401);
 console.log('PASS: manager-only download; real Arabic A4 PDF; fresh counts of distinct participants; owner/guest/draft rules; directory-based denominator, unique verified employees, no account/confirmation proxy, real return visits and timestamps, historical uncertainty, unlinked accounts and multi-page layout; revoked manager denied.');
}finally{await mf.dispose()}
