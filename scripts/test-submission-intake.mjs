import assert from 'node:assert/strict';
import {sql,load,req,seedEmployee} from './test-fixture.mjs';

const [policy,api,admin,windowApi,chat,lib,chatLib,presentation,publication]=await Promise.all([
 'lib/hackathon-intake.ts','app/api/challenges/route.ts','app/api/workshop/route.ts','app/api/intake/route.ts','app/api/chat/route.ts',
 'lib/challenges.ts','lib/ai-challenge.ts','app/api/presentation/route.ts','lib/server/direct-publication.ts'].map(load));
const cutoff=Date.parse('2026-11-13T00:00:00+03:00');assert.equal(policy.intakeClosesAt,cutoff);
let workerTime=cutoff-16000,dbTime=workerTime;Date.now=()=>workerTime;sql.function('unixepoch',w=>{assert.equal(w,'now');return Math.floor(dbTime/1000)});
const clock=t=>{workerTime=t;dbTime=t};
const owner=seedEmployee('731'),voter=seedEmployee('732'),card=lib.exampleChallenges[0].challenge;
const current=async()=>(await (await windowApi.GET()).json());
const settings=async()=>(await (await admin.GET(req('manager')))).json();
const toggle=async(who,action,revision)=>admin.POST(req(who,{action,revision:revision??(await settings()).revision}));
const add=(submit,id,who=owner)=>api.POST(req(who,{challenge:card,submit,...(id?{id}:{})}));
const blocked=async response=>{assert.equal(response.status,409);assert.equal((await response.json()).code,'INTAKE_CLOSED')};
const vote=(id,action)=>api.PATCH(req(voter,{id,action,active:true},'PATCH'));
const startChat=(completionId)=>chat.POST(req(owner,{messages:[{role:'user',content:'انتهيت'}],draft:chatLib.emptyChatDraft,...(completionId?{completionId}:{})}));
const res1=await add(true),res2=await add(false);assert.equal(res1.status,200);assert.equal(res2.status,200);const pub=(await res1.json()).id,draft=(await res2.json()).id;
assert.equal((await current()).phase,'open');assert.equal(policy.intakeWindow({},cutoff-1).phase,'open');
assert.equal(policy.intakeWindow({},policy.intakeStartsAt-1).phase,'before');assert.equal(policy.intakeWindow({},policy.intakeStartsAt).phase,'open');
assert.equal((await toggle(voter,'pause-intake',0)).status,403);assert.equal((await toggle(null,'pause-intake',0)).status,403);
const rev=(await settings()).revision;assert.equal((await toggle('manager','pause-intake',rev)).status,200);
assert.equal((await current()).phase,'paused');assert.equal((await settings()).open,true);assert.equal((await toggle('manager','resume-intake',rev)).status,409);
await blocked(await add(true));await blocked(await add(false));await blocked(await add(true,draft));await blocked(await add(true,undefined,'manager'));await blocked(await startChat());
assert.equal((await add(false,draft)).status,200);
assert.equal((await vote(pub,'vote')).status,200);assert.equal((await vote(pub,'interest')).status,200);
const deck=await (await presentation.GET()).json();assert.equal(deck.intake.phase,'paused');assert.equal(deck.votingOpen,true);
assert.equal((await toggle('manager','resume-intake')).status,200);assert.equal((await current()).phase,'open');
clock(cutoff-1);const last=await add(true);assert.equal(last.status,200,'Last millisecond of Nov 12 is eligible.');
dbTime=cutoff; // request already validated on the Worker but the actual write happens at midnight
await blocked(await add(true));await blocked(await add(true,draft));
clock(cutoff);assert.equal((await current()).phase,'ended');assert.equal((await (await windowApi.GET()).headers.get('cache-control')).includes('no-store'),true);
await blocked(await add(true));await blocked(await add(true,draft));assert.equal((await add(false,draft)).status,200);
assert.equal((await toggle(voter,'resume-intake')).status,403);
assert.equal((await toggle('manager','resume-intake')).status,200);
assert.equal(policy.advanceWindow(await current(),cutoff+1000).phase,'open');assert.equal((await add(true)).status,200);
assert.equal((await toggle('manager','pause-intake')).status,200);await blocked(await add(true));
const dbrow=sql.prepare('SELECT status FROM challenges WHERE id=?').get(draft);assert.equal(dbrow.status,'draft');
const card2=(await last.json()).id;assert.equal((await vote(card2,'vote')).status,200);assert.equal((await vote(card2,'interest')).status,200);
const self=await api.PATCH(req(owner,{id:pub,action:'vote',active:true},'PATCH'));assert.equal(self.status,403);
sql.prepare("UPDATE challenges SET status='pending' WHERE id=?").run(draft);await publication.publishSubmittedChallenges();assert.equal(sql.prepare('SELECT status FROM challenges WHERE id=?').get(draft).status,'pending');
assert.equal(policy.engagementFocus(await current()),'vote-join');
assert.equal((await toggle('manager','pause')).status,200);assert.equal(policy.engagementFocus(await current()),'join');assert.equal((await vote(pub,'vote')).status,409);assert.equal((await vote(pub,'interest')).status,200);
assert.equal((await toggle('manager','resume')).status,200);assert.equal((await current()).phase,'paused');
clock(policy.engagementEndsAt);assert.equal(policy.engagementFocus(await current()),'browse');
const logs=sql.prepare("SELECT COUNT(*) n FROM security_audit WHERE action IN ('إيقاف استقبال التحديات الجديدة','فتح استقبال التحديات')").get();
assert.equal(logs.n,4);
console.log('PASS: Riyadh inclusive day, DB-write race, manager-only pause/resume and audit, stale revision, old tab, new/draft/legacy publication denied, private saves retained, independent voting and joining, public presentation and dates.');
