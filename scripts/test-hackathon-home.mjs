import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load,sql,req,seedEmployee} from './test-fixture.mjs';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler/package.json'))('esbuild');
const built=await build({stdin:{contents:"export {default as Home} from './app/components/hackathon-home';export * from './lib/hackathon-event';export {startHomeCounters} from './app/components/use-home-motion';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/*']});
const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
const {Home,riyadhEventDay,eventCalendar,eventProgram,evaluationCriteria,homeFaqs}=mod.exports;
assert.equal(riyadhEventDay(new Date('2026-11-11T21:01:00Z')),'2026-11-12');assert.equal(riyadhEventDay(new Date('2026-11-11T20:59:00Z')),'2026-11-11');
for(const [date,label] of [['01','11 يومًا متبقيًا'],['03','9 أيام متبقية'],['10','يومان متبقيان'],['11','يوم متبقٍ'],['12','آخر يوم']])assert.equal(eventCalendar('2026-11-'+date).badge,label);
for(const [date,idx,period] of [['2026-10-31',-1,'before'],['2026-11-12',0,'submit'],['2026-11-13',1,'sort'],['2026-11-14',1,'sort'],['2026-11-15',-1,'between'],['2026-11-16',2,'build'],['2026-11-17',3,'present'],['2026-11-18',-1,'after']]){const cal=eventCalendar(date);assert.equal(cal.current,idx);assert.equal(cal.period,period);assert(cal.progress>=0&&cal.progress<=1)}
assert.equal(eventCalendar('2026-11-01').progress,0);assert.equal(eventCalendar('2026-11-13').progress,1/3);assert.equal(eventCalendar('2026-11-16').progress,2/3);assert.equal(eventCalendar('2026-11-17').progress,1);
assert.deepEqual(eventProgram.map(d=>d.items.length),[7,5]);assert.equal(evaluationCriteria.reduce((t,c)=>t+c.weight,0),100);assert.deepEqual(homeFaqs.slice(0,3).map(f=>f.question),['من يستطيع المشاركة والتصويت؟','ما الفرق بين التصويت وتسجيل الرغبة؟','هل تسجيل رغبتي يعني أنني أصبحت ضمن الفريق؟']);
const api=await load('app/api/challenges/route.ts'),boot=await load('app/api/bootstrap/route.ts'),lib=await load('lib/challenges.ts');
const a=seedEmployee('671'),b=seedEmployee('672'),v=seedEmployee('673');
const add=async(user,title,submit=true)=>{const r=await api.POST(req(user,{challenge:{...lib.exampleChallenges[0].challenge,title},submit}));assert.equal(r.status,200);return(await r.json()).id};
const first=await add(a,'تحدي اختبار أولويات القراءة'),second=await add(b,'تحدي اختبار ترتيب المشاركات'),draft=await add(a,'مسودة لا تدخل ترتيب التحديات',false);
sql.prepare('UPDATE challenges SET published_at=? WHERE id=?').run(100,first);sql.prepare('UPDATE challenges SET published_at=? WHERE id=?').run(200,second);
const get=async(user)=>(await(await boot.GET(req(user))).json());const vote=async(user,id,active)=>api.PATCH(req(user,{id,action:'vote',active},'PATCH'));
assert.equal((await vote(a,first,true)).status,403);assert.equal((await vote(v,second,true)).status,200);
let guest=await get(null);assert.equal(guest.homeVoteOrder[0],second);assert(!guest.homeVoteOrder.includes(draft));assert(guest.entries.every(e=>e.votes===undefined&&e.voters===undefined));
const html=(e,extra={})=>renderToStaticMarkup(createElement(Home,{entries:e,initialDay:'2026-11-03',loading:false,failed:false,signedIn:false,votingOpen:true,joiningOpen:true,busy:false,onAction(){},onStart(){},...extra}));
let out=html(guest.entries);assert(out.indexOf('تحدي اختبار ترتيب المشاركات')<out.indexOf('تحدي اختبار أولويات القراءة'));assert(!out.includes('<b>1</b>'));assert.deepEqual([...out.matchAll(/data-home-block="([^"]+)"/g)].map(m=>m[1]),['roles','journey','program','evaluation','challenges','faq','invite']);assert(out.includes('data-home-count="20000" aria-hidden="true">20,000'));
// Ranking alone is never an announcement: only confirmed team IDs get finalist cards.
const confirmed=html(guest.entries,{announced:[{id:first,title:'تحدي اختبار أولويات القراءة',rank:1}],initialDay:'2026-11-15',votingOpen:false,joiningOpen:false});
assert(confirmed.includes('id="home-finalists"'));assert(confirmed.includes('href="#finalist-challenges"'));assert(!confirmed.includes('أربع فرق'));assert(confirmed.includes('href="#home-program"'));assert(confirmed.includes('id="home-program"'));assert.equal((confirmed.match(/class="bh-result-card"/g)||[]).length,1);
assert(confirmed.includes('تحدي اختبار أولويات القراءة'));assert(!confirmed.includes('تحدي اختبار ترتيب المشاركات'));assert(!confirmed.includes('يمكنك طرح تحدٍّ، أو التصويت لتحديات زملائك'));
assert(confirmed.includes('أثر الحل في التشغيل'));assert(!confirmed.includes('أثر الحل على المؤسسة والمستفيدين'));assert(!out.includes('id="home-finalists"'));
const selected=(await get(v)).entries;assert(html(selected).includes('سحب صوتي'));assert(html((await get(a)).entries).includes('تحدّيك'));assert(html([],{}).includes('استعرض المثال'));assert(!html([],{}).includes('class="bh-vote"'));
const manager=await get('manager');assert(manager.entries.some(e=>e.votes===1));assert(!out.includes('class="bh-my-participation"')&&!out.includes('الأكثر تصويتًا'));
for(const range of ['1–12','13–14']){const [start,end]=range.split('–');assert(out.includes('من <bdi dir="ltr">'+start+'</bdi> إلى <bdi dir="ltr">'+end+'</bdi></span> نوفمبر'));}
assert(out.includes('<span dir="ltr" style="unicode-bidi:isolate;white-space:nowrap">16–17</span> نوفمبر'));
assert(out.includes('طرح التحديات متاح حتى 12 نوفمبر، ويستمر التصويت والانضمام حتى 14 نوفمبر')&&out.includes('تطرح وتصوّت وتنضم'));
// Both banners distinguish the submission deadline from continued voting/joining.
const banners=extra=>{const markup=html(guest.entries,extra);return [markup.match(/<div class="bh-status"[^]*?<\/div><\/div>/)?.[0]||'',markup.match(/<div class="bh-invite-copy"[^]*?<\/div>/)?.[0]||''];};
for(const day of ['2026-11-07','2026-11-12']){
 for(const banner of banners({initialDay:day}))assert(banner.includes('طرح التحديات متاح حتى 12 نوفمبر، ويستمر التصويت والانضمام حتى 14 نوفمبر'));
 for(const banner of banners({initialDay:day,votingOpen:false})){assert(banner.includes('طرح التحديات متاح حتى 12 نوفمبر، ويستمر الانضمام حتى 14 نوفمبر'));assert(banner.includes('التصويت موقوف'));assert(!banner.includes('يستمر التصويت'));}
}
for(const day of ['2026-11-13','2026-11-14']){
 for(const banner of banners({initialDay:day}))assert(banner.includes('انتهى طرح التحديات، ويستمر التصويت والانضمام حتى 14 نوفمبر'));
 for(const banner of banners({initialDay:day,votingOpen:false})){assert(banner.includes('انتهى طرح التحديات، ويستمر الانضمام حتى 14 نوفمبر'));assert(banner.includes('التصويت موقوف'));assert(!banner.includes('يستمر التصويت'));}
}
const closedHome=html(guest.entries,{initialDay:'2026-11-13'});
assert(!closedHome.includes('class="bh-add-strip"')&&!closedHome.includes('data-badra-anchor="participate"')&&!closedHome.includes('اطرح تحدّيك'));
assert(closedHome.includes('/challenges?participate=vote')&&closedHome.includes('/challenges?participate=join'));
assert(closedHome.indexOf('id="challenges"')<closedHome.indexOf('id="home-roles"'),'After intake, actual cards are the first section under the hero.');
assert(!html(guest.entries,{initialDay:'2026-11-13',votingOpen:false}).includes('/challenges?participate=vote'));
for(const banner of banners({initialDay:'2026-11-15'}))assert(!banner.includes('يستمر التصويت والانضمام'));
assert(!html(guest.entries,{votingOpen:false}).includes('يستمر التصويت والانضمام')&&html(guest.entries,{votingOpen:false}).includes('التصويت موقوف'));
// Registering a team preference on the home card does not cast a vote or end when voting pauses.
const interest=await api.PATCH(req(v,{id:first,action:'interest',active:true},'PATCH'));assert.equal(interest.status,200);
const viewerEntries=(await get(v)).entries,joined=viewerEntries.find(e=>e.id===first);
assert.equal(joined.voted,false);assert.equal(joined.interested,true);
const card=(entry,extra={})=>html([entry],extra).match(/<article class="bh-challenge-card[^]*?<\/article>/)?.[0]||'';
const closedCard=card(joined,{votingOpen:false});
assert.match(closedCard,/<button[^>]*class="bh-vote"[^>]* disabled/);
const interestButton=closedCard.match(/<button[^>]*class="bh-join"[^>]*>/)?.[0]||'';
assert(interestButton.includes('aria-pressed="true"')&&!interestButton.includes('disabled')&&closedCard.includes('سجّلت رغبتي'));
for(const blocked of [card((await get(a)).entries.find(e=>e.id===first)),html([])]){
 assert(!blocked.includes('class="bh-join"')&&!blocked.includes('class="bh-vote"'));
}
const counts={...joined,votes:41,interestCount:67};
for(const markup of [card(counts),card(counts,{signedIn:true}),html(manager.entries,{signedIn:true})]){
 const buttons=markup.match(/<button[^>]*class="bh-(?:join|vote)"[^]*?<\/button>/g);assert(buttons?.length);
 assert(buttons.every(button=>!button.includes('<b>')&&!button.includes('عدد الأصوات')&&!button.includes('عدد الراغبين')));
}
const ownFeed=(await get(a)).entries;
assert(html(ownFeed,{signedIn:true}).includes('طرحت <b>'+Number(1).toLocaleString('ar-SA')+'</b>'),'private drafts do not count as submissions');
const mine=card(ownFeed.find(e=>e.id===first));assert(mine.includes('data-kind="own"')&&mine.includes('?edit=1'));
assert(html([]).includes('data-kind="example"'));
const summary=html(viewerEntries,{signedIn:true}).match(/<aside class="bh-my-participation"[^]*?<\/aside>/)[0];
assert(summary.includes('شكرًا لمشاركتك')&&summary.includes('سجّلت رغبتك في <b>'+Number(1).toLocaleString('ar-SA')+'</b>'));
assert.equal((await vote(v,second,false)).status,200);guest=await get(null);assert.equal(guest.homeVoteOrder[0],first);
const latest=html(guest.entries);
assert(latest.indexOf('تحدي اختبار ترتيب المشاركات')<latest.indexOf('تحدي اختبار أولويات القراءة'),'Home stays newest first even when the admin ranking reverses');
assert(!html(guest.entries,{loading:true}).includes('class="bh-challenge-card'));assert(!html(guest.entries,{failed:true}).includes('class="bh-challenge-card'));
// A hidden document or a suspended animation-frame clock must never leave a prize at zero.
function clock({hidden=false,reduce=false}={}){
 let serial=0;const frames=new Map(),timers=new Map(),media=Object.assign(new EventTarget(),{matches:reduce});
 const doc=Object.assign(new EventTarget(),{hidden,defaultView:{matchMedia:()=>media,performance:{now:()=>0},requestAnimationFrame:f=>{frames.set(++serial,f);return serial},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(f,ms)=>{timers.set(++serial,{f,ms});return serial},clearTimeout:id=>timers.delete(id)}});
 const nodes=[70,30,20000].map(n=>({textContent:'',dataset:{homeCount:String(n)}}));
 mod.exports.startHomeCounters({ownerDocument:doc,querySelectorAll:()=>nodes});
 return {doc,media,timers,frames,values:()=>nodes.map(n=>n.textContent),step:t=>{const batch=[...frames.values()];frames.clear();batch.forEach(f=>f(t))}};
}
const end=['70','30','20,000'];
for(const config of [{hidden:true},{reduce:true}]){const c=clock(config);assert.deepEqual(c.values(),end);assert.equal(c.frames.size,0)}
const running=clock();running.step(800);assert.deepEqual(running.values(),['61','26','17,500']);running.step(1600);assert.deepEqual(running.values(),end);
const background=clock();background.step(300);background.doc.hidden=true;background.doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(background.values(),end);assert.equal(background.frames.size,0);
const stalled=clock();assert.deepEqual(stalled.values(),['0','0','0']);const deadline=[...stalled.timers.values()][0];assert(deadline.ms>1600&&deadline.ms<=2000);deadline.f();assert.deepEqual(stalled.values(),end);
const toggled=clock();toggled.media.matches=true;toggled.media.dispatchEvent(new Event('change'));assert.deepEqual(toggled.values(),end);
sql.close();console.log('PASS: Riyadh midnight and cutoff grammar; all four milestones and the gap; program and weights; SSR final values, reduced motion, background and stalled frames; tabs and published-only ranking; toggling, ownership, private counts and private drafts.');
