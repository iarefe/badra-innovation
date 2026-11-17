// Test the real build using ephemeral local D1. No live accounts or production calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
const root=path.resolve('dist/server');
const cfg=JSON.parse(await fs.readFile(path.join(root,'wrangler.json'),'utf8'));
const require=createRequire(import.meta.url);
const {Miniflare}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
const {parse}=require('next/dist/compiled/node-html-parser');
const modules=[];
async function collect(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await collect(p);else if(/\.m?js$/.test(p))modules.push({path:p,type:'ESModule',contents:await fs.readFile(p,'utf8')});}}
await collect(root);
modules.sort((a,b)=>Number(b.path===path.join(root,cfg.main))-Number(a.path===path.join(root,cfg.main)));
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:cfg.compatibility_date,compatibilityFlags:cfg.compatibility_flags,d1Databases:['DB'],cf:false});
try{
 const db=await mf.getD1Database('DB');
 for(const f of (await fs.readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
  const migration=await fs.readFile('drizzle/'+f,'utf8');
  for(const s of migration.split('--> statement-breakpoint').flatMap(s=>s.split(';')).filter(s=>s.trim()))await db.prepare(s).run();
 }
 const sql=(q,...args)=>db.prepare(q).bind(...args).run();
 const digest=s=>createHash('sha256').update(s).digest('hex');
 const actor=async(name,phone)=>{const id=randomUUID(),token=digest(randomUUID());await sql('INSERT INTO employees(id,name,phone,department,roles,created_at) VALUES(?,?,?, ?,?,1)',id,name,phone,'الإدارة','["innovator"]');await sql('INSERT INTO employee_sessions VALUES(?,?,?)',digest(token),id,Date.now()+360000);return {id,token};};
 const admin=await actor('مدير محلي','+966599999901'),member=await actor('عضو محلي','+966500000920'),judge=await actor('مقيم محلي','+966500000921'),outsider=await actor('موظف محلي','+966500000922');
 const peer=await actor('عضو لجنة ثانٍ','+966500000923');
 const post=async(user,body)=>{const r=await mf.dispatchFetch('https://test.local/api/teams',{method:'POST',headers:{cookie:'__Host-badra-employee='+user.token,'content-type':'application/json',origin:'https://test.local'},body:JSON.stringify(body)});assert.equal(r.status,200,body.action+': '+await r.text());};
 const get=(p,u)=>mf.dispatchFetch('https://test.local'+p,{headers:u?{cookie:'__Host-badra-employee='+u.token}:{}});
 const html=async(p,u)=>{const r=await get(p,u);assert.equal(r.status,200,p);return (await r.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');};
 const json=async(p,u)=>{const r=await get(p,u);assert.equal(r.status,200,p);return r.json();};
 const choices=[];
 for(let i=0;i<5;i++){
  const id=randomUUID(),title=['تحدي سجل الموارد','تحدي تسليم الدعم','تحدي وثائق الفريق','تحدي أوقات التدقيق','تحدي متابعة المشاريع'][i];
  const payload={title,author:admin.id,domain:'المنح والمشاريع',scope:'داخلي',situation:'يتطلب تجهيز مستندات الفريق مراجعات متعددة',need:'متابعة',impact:'تأخر الدراسة',stakeholders:'الفريق',frequency:'سنوي',evidence:'التجربة',workaround:'الاتصال',success:'انخفاض وقت المراجعة'};
  await sql("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',?,?,?)",id,'employee:'+admin.id,JSON.stringify(payload),i+1,i+1,i+1);choices.push({id,title,payload});
 }
 // The manager's approved snapshot exists but is private until an announcement creates teams.
 await sql("INSERT INTO workshop_settings(id,title,count,open,finalized,revision,intake_paused,engagement_controls_initialized,joining_open) VALUES(1,'تجربة الهاكاثون',4,0,1,2,1,1,0)");
 for(const [i,c] of choices.slice(0,4).entries())await sql('INSERT INTO workshop_selection(challenge_id,payload,votes,rank) VALUES(?,?,?,?)',c.id,JSON.stringify(c.payload),50-i,i+1);
 assert.equal((await json('/api/teams?notice=1')).announced.length,0);
 assert.equal((await json('/api/bootstrap')).workshop.announced.length,0);
 assert(!(await html('/')).includes('id="home-finalists"'),'A private selection must not render an announcement on the home page');
 await sql('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)',choices[0].id,'employee:'+judge.id);
 await sql('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)',choices[0].id,member.id,1);
 const checkRoster=async()=>{
  const doc=parse(await html('/admin?tab=challenges',admin));
  assert.equal(doc.querySelector('[role="tab"][aria-selected=true]')?.getAttribute('aria-label'),'التحديات');
  assert(!doc.querySelector('[role="tab"][aria-label="سجل الرغبات"]')&&!doc.querySelector('select option[value="teams"]'));
  const roster=doc.querySelectorAll('.ba-ch-members').find(el=>el.textContent.includes('عضو محلي'));
  assert(roster&&roster.textContent.includes('مقيم محلي')&&roster.textContent.includes('مبتكر'),'Voters, interested members and their roles visible together');
 };
 await checkRoster();
 const four=choices.slice(1);
 // Published team covers include both the domain fallback and the owner's replacement.
 await sql("INSERT INTO challenge_covers(challenge_id,object_key,status,source,updated_at) VALUES(?,?,'ready','upload',42)",four[2].id,'test-cover.webp');
 const announce=await mf.dispatchFetch('https://test.local/api/teams',{method:'POST',headers:{cookie:'__Host-badra-employee='+admin.token,'content-type':'application/json',origin:'https://test.local'},body:JSON.stringify({action:'announce',ids:four.map(c=>c.id),revision:2})});
 assert.equal(announce.status,200,'Fixture manager must be able to announce in the isolated DB');
 await checkRoster();
 await sql('INSERT INTO event_judges(person) VALUES(?)',judge.id);
 await sql('INSERT INTO team_members(team,person) VALUES(?,?)',four[0].id,member.id);
 const notes='افتح حساب العرض التجريبي.\nاختر المشروع من القائمة.',slides='https://private.team.test/presentation';
 await post(member,{action:'solution',team:four[0].id,url:'https://private.team.test/demo'});
 await post(member,{action:'instructions',team:four[0].id,text:notes});
 await post(member,{action:'slidesLink',team:four[0].id,url:slides});
 const [publicData,home,adminHtml,guest,own,jury,nonmember]=await Promise.all([json('/api/bootstrap'),html('/'),html('/admin',admin),json('/api/teams'),json('/api/teams',member),json('/api/teams',judge),json('/api/teams',outsider)]);
 assert.deepEqual(publicData.workshop.announced.map(t=>t.id),four.map(t=>t.id));
 for(const t of publicData.workshop.announced)assert.deepEqual(Object.keys(t).sort(),['id','rank','title']);
 assert.deepEqual(publicData.workshop.selected,[],'Keep private ranked snapshot private');
 assert(publicData.entries.every(e=>!('votes'in e)&&!('voters'in e)&&!('interestCount'in e)));
 const homeDom=parse(home),hero=homeDom.querySelector('#home-finalists');
 assert(hero,'Finalists should be rendered by the server on initial load');
 const skip=homeDom.querySelector('a.event-skip[href^="#"]');
 assert(skip,'The header must offer a way to skip its repeated links.');
 const destination=homeDom.querySelector(skip.getAttribute('href'));
 assert.equal(destination?.tagName,'MAIN');assert.equal(destination.getAttribute('tabindex'),'-1','Skip destination must accept keyboard focus');
 const cards=hero.querySelectorAll('a.bh-result-card');
 assert.equal(cards.length,four.length,'The hero displays every announced team once');
 for(const t of four){
  const href='/challenge/'+t.id,card=cards.find(a=>a.getAttribute('href')===href);
  assert(card&&card.textContent.includes(t.title)&&card.textContent.includes(t.payload.domain),'Open the actual challenge from its own title and category');
  assert(!card.textContent.includes(t.payload.situation),'The compact preview does not repeat the full situation');
  const image=card.querySelector('img'),entry=publicData.entries.find(e=>e.id===t.id);
  assert.equal(image?.getAttribute('src')?.replaceAll('&amp;','&'),entry.cover.url,'Reuse the challenge’s published cover (including a custom upload)');
  assert.equal(homeDom.querySelectorAll('main a[href="'+href+'"]').length,1,'Do not repeat the finalist gallery below the hero');
 }
 assert(!hero.textContent.includes(choices[0].title),'The published distractor is not a finalist');
 assert(hero.querySelector('a[href="#home-program"]')&&homeDom.querySelector('#home-program'),'The secondary link opens the real program');
 assert(hero.querySelector('a[href="#finalist-challenges"]')&&homeDom.querySelector('#finalist-challenges'),'Visitors can browse approved challenges immediately');
 const [memberHero,outsiderHero,adminHero]=(await Promise.all([html('/',member),html('/',outsider),html('/',admin)])).map(page=>parse(page).querySelector('#home-finalists'));
 assert(memberHero.querySelector('a[href="/teams"]')?.textContent.includes('فريق'),'Team members get a direct workspace action');
 assert(outsiderHero.querySelector('a[href="#finalist-challenges"]')&&!outsiderHero.querySelector('a[href="/teams"]'),'Signing in is not the same as being assigned to a team');
 assert(adminHero.querySelector('a[href="/admin"]'),'Managers can open readiness directly');
 assert(!home.includes('https://private.team.test/demo'));
 assert(!home.includes('ملخص إحصائيات الإدارة'));
 assert(!adminHtml.includes('إعادة فتح التصويت'),'No impossible voting action in announced manager state');
 const readyRows=parse(adminHtml).querySelectorAll('section[aria-label="جاهزية الفرق"] tbody tr');
 assert.equal(readyRows.length,4,'The first view must include one readiness row per announced team');
 for(const [i,t] of four.entries()){
  const row=readyRows.find(r=>r.textContent.includes(t.title));assert(row,'Missing readiness row');
  assert(row.querySelector('a')?.getAttribute('href').replaceAll('&amp;','&')==='/teams?team='+t.id+(i===0?'&view=preview':'#deliverables'));
  assert.equal(row.textContent.includes('ينقص العرض'),i!==0,'Preview only when all three deliverables exist');
 }
 assert(!readyRows[0].textContent.includes('https://private.team.test/'),'Dashboard is a status view, not a credentials list');
 assert((await get('/api/team-readiness',outsider)).status>=400);
 assert.equal((await get('/admin',outsider)).status,404);
 assert.deepEqual(guest.teams,[]);assert.deepEqual(nonmember.teams,[]);
 assert.deepEqual(own.teams.map(t=>t.id),[four[0].id]);assert.equal(own.teams[0].solution,'https://private.team.test/demo');
 assert.equal(jury.teams.length,4);assert(!jury.teams.some(t=>'audience'in t));
 // Exercise the compiled routes with two real fixture identities. The second judge is on
 // the last team; their private notes must never appear in their colleague's page.
 await post(admin,{action:'judge',person:peer.id,enabled:true});
 await post(admin,{action:'member',team:four[3].id,person:peer.id,enabled:true});
 const score=(rating,signature)=>({action:'score',team:four[0].id,scores:Array(6).fill(rating),notes:Array(6).fill('ملاحظة خاصة '+signature),signature});
 await post(judge,score(4,'توقيع المقيم الأول'));
 const liveResult=async()=>(await json('/api/teams?view=results',admin)).teams.find(t=>t.id===four[0].id).result;
 assert.deepEqual(await liveResult(),{required:2,submitted:1,committee:56,audience:null,final:null});
 const firstOnly=()=>html('/teams?team='+four[0].id+'#judging-results',admin);
 const cardResult=doc=>parse(doc).querySelector('#results-'+four[0].id);
 assert(cardResult(await firstOnly()).textContent.includes('اللجنة فقط: 56.00 / 70'));
 await post(admin,{action:'audience',team:four[0].id,value:12.5});
 assert.equal((await liveResult()).final,68.5);
 assert(cardResult(await firstOnly()).textContent.includes('النتيجة الحالية: 68.50 / 100'));
 await post(peer,score(5,'توقيع المقيم الثاني'));
 assert.equal((await liveResult()).final,75.5);
 const [visitorDesk,memberDesk,judgeDesk,peerDesk,managerDesk,managerResults,judgeHome]=await Promise.all([
  html('/teams'),html('/teams',member),html('/teams',judge),html('/teams',peer),html('/teams',admin),html('/admin?tab=results',admin),html('/',judge)
 ]);
 assert(four.every(c=>visitorDesk.includes(c.title))&&!visitorDesk.includes('https://private.team.test/demo'));
 for(const doc of [memberDesk,judgeDesk,managerDesk]){
  assert(doc.includes('href="https://private.team.test/demo"')&&doc.includes('href="'+slides+'"'),'Committee and team need usable links to both deliverables');
  assert(doc.includes('افتح حساب العرض التجريبي.')&&doc.includes('اختر المشروع من القائمة.'),'Both lines of the private instructions should be visible');
 }
 assert(memberDesk.includes('إرشادات وبيان الحل')&&memberDesk.includes('<textarea'),'A team member can edit the instructions as a paragraph');
 for(const doc of [visitorDesk,home,JSON.stringify(publicData)]){
  assert(!doc.includes(slides)&&!doc.includes('افتح حساب العرض التجريبي.'),'Private operating instructions and presentation link must stay out of public views');
 }
 for(const doc of [visitorDesk,memberDesk])assert(!doc.includes('توقيع المقيم الأول')&&!doc.includes('توقيع المقيم الثاني')&&!doc.includes('توقيع المقيّم (الاسم)'));
 const previewPath='/teams?team='+four[0].id+'&view=preview';
 for(const who of [member,judge,admin]){
  const preview=parse(await html(previewPath,who)).querySelector('main');
  assert.equal(preview?.querySelector('h1')?.textContent,four[0].title);
  assert(preview.querySelector('a[href="'+slides+'"]')&&preview.querySelector('a[href="https://private.team.test/demo"]')&&preview.textContent.includes('اختر المشروع من القائمة.'));
  assert.equal(preview.querySelector('form,input,textarea'),null,'Reviewer preview must contain no edits, scores or vote actions');
 }
 for(const who of [null,outsider])assert.equal((await get(previewPath,who)).status,404,'No private preview by guessing a team ID');
 const deep=parse(await html('/teams?team='+four[2].id+'#deliverables',admin));
 assert(deep.querySelector('button[aria-pressed="true"][aria-controls="team-workspace"]')?.textContent.includes(four[2].title),'A missing-deliverables link must select its own team');
 assert(judgeDesk.includes('https://private.team.test/demo')&&!judgeDesk.includes('type="file"'));
 assert(/تحكيم|تقييم/.test(parse(judgeHome).querySelector('#home-finalists a[href="/teams"]')?.textContent||''),'A judge gets an evaluation action in the hero');
 const navLink=(doc,href)=>parse(doc).querySelector('header nav a[href="'+href+'"]');
 assert.equal(navLink(judgeHome,'/teams')?.textContent,'بطاقات التحكيم','Assigned judges can discover their cards from the initial homepage');
 assert.equal(navLink(judgeDesk,'/teams')?.getAttribute('aria-current'),'page');
 assert.equal(navLink(memberDesk,'/teams')?.textContent,'تحديات الفريق');
 assert.equal(navLink(visitorDesk,'/admin'),null);
 for(const u of [judge,member,outsider])assert.equal((await get('/admin?tab=results',u)).status,404,'Manager results must not render to other employees');

 const juryDoc=parse(judgeDesk),forms=juryDoc.querySelectorAll('section.jury-card form');
 assert.equal(forms.length,4,'Each eligible team has an independent personal card');
 const visibleForms=forms.filter(f=>!f.closest('[hidden],details:not([open])'));
 assert.equal(visibleForms.length,1,'Exactly one working card is open before hydration');
 const current=visibleForms[0].closest('section.jury-card');
 assert(current.textContent.includes(four[1].title)&&current.textContent.includes('مقيم محلي'),'Open the first eligible unfinished team and identify the evaluator');
 const selected=juryDoc.querySelector('button[aria-pressed="true"][aria-controls="team-workspace"]');
 assert(selected?.textContent.includes(four[1].title),'The team selector and visible rubric must agree');
 const criteria=current.querySelectorAll('fieldset'),weights=[20,15,15,10,5,5];
 assert.equal(criteria.length,weights.length,'Use the six criteria from the supplied card');
 for(const [i,field] of criteria.entries()){
  const options=field.querySelectorAll('input[type="radio"][required]');
  assert.deepEqual(options.map(o=>Number(o.getAttribute('value'))),[1,2,3,4,5],'Five score choices per criterion');
  for(const option of options){
   const verbal=option.closest('label')?.querySelector('em')?.textContent.trim();
   assert(verbal&&option.getAttribute('aria-label')?.includes(verbal),'The visible grade meaning must match its spoken name');
  }
  assert.equal(new Set(options.map(o=>o.getAttribute('name'))).size,1);
  assert(field.querySelector('output')?.textContent.trim().endsWith('/ '+weights[i]),'Incorrect criterion weight');
  assert(field.querySelector('textarea'),'Each criterion accepts its own evaluator notes');
 }
 assert(current.querySelector('input[name="signature"][required]')&&current.querySelector('button[type="submit"]'));
 assert(judgeDesk.includes('ملاحظة خاصة توقيع المقيم الأول')&&!judgeDesk.includes('توقيع المقيم الثاني'),'Judges see only their own saved cards');
 assert(!peerDesk.includes('توقيع المقيم الأول')&&peerDesk.includes('توقيع المقيم الثاني'));
 const peerForms=parse(peerDesk).querySelectorAll('section.jury-card');
 assert.equal(peerForms.length,3);assert(!peerForms.some(c=>c.textContent.includes(four[3].title)),'Membership excludes the team from this judge’s cards');
 for(const doc of [visitorDesk,memberDesk,judgeDesk,peerDesk])assert.equal(parse(doc).querySelector('input[name="audience"]'),null,'Only management edits the audience grade');

 const resultsDoc=parse(managerResults),tab=resultsDoc.querySelector('[role="tab"][aria-selected="true"]'),panel=resultsDoc.querySelector('[role="tabpanel"]');
 assert.equal(tab?.getAttribute('aria-label'),'نتائج التحكيم','The result deep link must select the actual results tab, not the default list');
 assert.equal(tab.getAttribute('aria-controls'),panel?.id);assert.equal(panel.querySelector('h2')?.textContent,'نتائج التحكيم');
 assert.equal(navLink(managerResults,'/admin')?.getAttribute('aria-current'),'page');
 const management=parse(managerDesk);
 const first=management.querySelector('#results-'+four[0].id);
 assert(first?.textContent.includes('توقيع المقيم الأول')&&first.textContent.includes('توقيع المقيم الثاني'),'Manager can inspect each distinct committee card');
 assert(first.querySelector('input[name="audience"][min="0"][max="30"]'),'Audience input is limited to its own 30 points');
 assert(first.textContent.includes('63.00 / 70')&&first.textContent.includes('75.50 / 100'),'Final = average of both committee cards + audience grade');
 for(const c of four.slice(1))assert(!management.querySelector('#results-'+c.id)?.textContent.includes('/ 100'),'Teams with missing grades must not have a final result');
 // Follow the QR landing route with a fresh attendee; simply opening a link never records a vote or attendance.
 const finalPost=async(user,body)=>{const r=await mf.dispatchFetch('https://test.local/api/final-vote',{method:'POST',headers:{cookie:'__Host-badra-employee='+user.token,origin:'https://test.local','content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,body.action+': '+await r.text());};
 const checkFinal=()=>json('/api/final-vote?admin=1',admin);
 const unopened=await html('/final-vote');assert(unopened.includes('لم يُفتح التصويت'));
 const dashboard=parse(await html('/admin?tab=attendance',admin));
 assert(dashboard.querySelector('[role="tabpanel"]')?.textContent.includes('الحضور وتصويت الختام'),'Direct manager URL selects attendance');
 assert.equal((await get('/admin?tab=attendance',member)).status,404);
 await finalPost(admin,{action:'open'});
 const openHome=parse(await html('/'));
 assert(openHome.querySelectorAll('main a[href="/final-vote"]').some(a=>!a.closest('#home-finalists')),'An open final ballot remains discoverable without competing with the hero action');
 const [guestBallot,waitingBallot,projector]=await Promise.all([html('/final-vote'),html('/final-vote',outsider),html('/final-vote/screen')]);
 assert(guestBallot.includes('href="/login?returnTo=/final-vote"'),'Open ballot login link must return user to the ballot');
 assert(!waitingBallot.includes('name="final-team"')&&waitingBallot.includes('بانتظار تسجيل حضورك'));
 assert(!projector.includes('موظف محلي')&&!projector.includes('ملاحظة خاصة')&&projector.includes('تصويت'),'Public projection must not reveal staff or reviews');
 const qr=parse(projector).querySelector('svg[role="img"][aria-label*="QR"]');
 assert(qr,'An open ballot should render the projector code immediately');
 const side=Number(qr.querySelector('rect').getAttribute('width')),scale=6,width=side*scale;
 const pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(const match of qr.querySelector('path').getAttribute('d').matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)){
  const [x,y,length]=match.slice(1).map(Number);
  for(let py=y*scale;py<(y+1)*scale;py++)for(let px=x*scale;px<(x+length)*scale;px++){const i=(py*width+px)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 }
 assert.equal(jsQR(pixels,width,width)?.data,'https://example.invalid/final-vote','Scan the actual served SVG geometry, not a separate test encoder');
 assert.equal((await checkFinal()).cast,0);
 await finalPost(admin,{action:'attendance',person:outsider.id,attending:true});
 const ballot=parse(await html('/final-vote',outsider));assert.deepEqual(ballot.querySelectorAll('input[name="final-team"]').map(el=>el.getAttribute('value')).sort(),four.map(t=>t.id).sort());
 for(const candidate of ballot.querySelectorAll('input[name="final-team"]')){
  const resolved=four.find(team=>team.id===candidate.getAttribute('value'));
  assert(candidate.closest('label')?.textContent.includes(resolved.title),'Voter options must be identified by the actual visible team name');
 }
 const confirmBallot=ballot.querySelector('button[type="submit"]'),described=(confirmBallot?.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);
 assert(described.length>0&&described.every(ref=>ballot.querySelector('#'+ref)),'Confirmation guidance must resolve before the attendee chooses');
 assert(ballot.querySelector('#fv-choice-note')?.textContent.includes('اختر فريقًا'),'The button should explain what to do before confirmation');
 assert(ballot.querySelector('main [role="status"][aria-atomic="true"]'),'A changing ballot state must have a persistent announcement region');
 assert(ballot.querySelector('button[type="submit"]')?.hasAttribute('disabled'),'Picking and confirming is explicit');
 await finalPost(outsider,{action:'vote',team:four[2].id});await finalPost(admin,{action:'close'});
 const saved=parse(await html('/final-vote',outsider));assert(saved.textContent.includes(four[2].title));assert(!saved.querySelector('input[name="final-team"]'));
 assert.equal((await checkFinal()).cast,1);assert((await html('/final-vote')).includes('أُغلق تصويت الختام'));
 assert.equal(parse(await html('/final-vote/screen')).querySelector('svg[role="img"][aria-label*="QR"]'),null,'Stop offering the code on the projector after close');
 // A new event stays private until a manager reviews and publishes. Then both the guest
 // homepage and the shareable results page must contain the actual highest-scoring team.
 assert.equal((await json('/api/results')).publication,null);assert((await html('/results')).includes('عند تعميمها'));
 for(const [i,t] of four.entries()){
  await post(judge,{...score(4,'بطاقة نهائية خاصة'),team:t.id});
  await post(admin,{action:'audience',team:t.id,value:i===2?30:3});
 }
 const draft=await json('/api/results?preview=1',admin);
 assert.equal(draft.reason,null);assert.equal(draft.standings[0].id,four[2].id);
 const posted=await mf.dispatchFetch('https://test.local/api/results',{method:'POST',headers:{cookie:'__Host-badra-employee='+admin.token,'content-type':'application/json',origin:'https://test.local'},body:JSON.stringify({fingerprint:draft.fingerprint,revision:draft.revision})});
 assert.equal(posted.status,200,await posted.text());
 const publicPage=parse(await html('/results')),front=parse(await html('/'));
 assert.equal(publicPage.querySelectorAll('.bp-rank li').length,4);
 assert(publicPage.querySelector('.bp-champion').textContent.includes(four[2].title));
 assert(front.querySelector('.bh-results-message p').textContent.includes(four[2].title));
 assert(front.querySelector('.bh-results-message a[href="/results"]'));
 assert(!publicPage.textContent.includes('بطاقة نهائية خاصة'));assert((await html('/final-vote')).includes('href="/results"'));
 console.log('PASS: role-based navigation and focusable skip link, readiness/preview privacy, visibly and accessibly labeled jury grades, explicit ballot confirmation, projector QR and saved individual receipt.');
}finally{await mf.dispose();}
