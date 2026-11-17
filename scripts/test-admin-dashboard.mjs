import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,sql,req,seedEmployee} from './test-fixture.mjs';
const lib=await load('lib/challenges.ts'),view=await load('lib/admin-dashboard.ts'),boot=await load('app/api/bootstrap/route.ts'),admin=await load('app/api/participation/route.ts'),work=await load('app/api/workshop/route.ts');
const actor=seedEmployee('710'),voter=seedEmployee('711'),ids=[];
for(const [index,pub,status] of [[0,330,'published'],[1,250,'published'],[2,110,'published'],[3,115,'published'],[4,null,'draft']]){
 const id=randomUUID();ids.push(id);sql.prepare('INSERT INTO challenges(id,owner,payload,status,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?)').run(id,'employee:'+actor.id,JSON.stringify({...lib.exampleChallenges[0].challenge,title:'تحدي اختبار '+index}),status,500-index,1,pub);
}
for(const i of [0,1,2])sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(ids[i],'employee:'+voter.id);
sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(ids[1],'employee:sample-second');
sql.prepare('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)').run(ids[0],voter.id,1);
const state=async user=>await(await boot.GET(req(user))).json();
let b=await state('manager'),w=b.workshop;assert.deepEqual(w.rankedIds,[ids[1],ids[2],ids[0],ids[3]]);assert.equal(w.selected.length,3);assert(!('rankedIds' in (await state(null)).workshop));
const stats=view.adminTotals([...b.entries,...lib.exampleChallenges]);assert.deepEqual([stats.all.length,stats.published.length,stats.drafts,stats.votes,stats.interests,stats.interestedChallenges],[5,4,1,4,1,1]);
for(const n of [1,2,3,4,5,20]){const rows=view.adminRanking(b.entries,b.homeVoteOrder,w,n);assert.deepEqual(rows.map(e=>e.id),w.rankedIds);assert.equal(rows.filter(e=>e.inside).length,Math.min(4,n));assert(rows.every((e,i)=>e.rank===i+1))}
assert.equal((await work.POST(req('manager',{action:'finalize',revision:w.revision}))).status,200);
b=await state('manager');w=b.workshop;assert(w.finalized);const snap=w.selected.map(s=>[s.id,s.votes,s.challenge.title]);
const changed=b.entries.map(e=>({...e,votes:87,challenge:{...e.challenge,title:'عنوان أحدث'}}));let frozen=view.adminRanking(changed,b.homeVoteOrder,w,20);
assert.deepEqual(frozen.filter(e=>e.inside).map(s=>[s.id,s.votes,s.challenge.title]),snap);assert.equal(frozen.at(-1).inside,false);
sql.prepare('DELETE FROM workshop_selection WHERE challenge_id=?').run(ids[2]);b=await state('manager');assert.equal(view.adminRanking(b.entries,b.homeVoteOrder,b.workshop,3).filter(e=>e.inside).length,2,'No automatic backfill');
for(let i=0;i<15;i++)sql.prepare('INSERT INTO security_audit(id,actor,action,created_at) VALUES(?,?,?,?)').run(randomUUID(),'test','إجراء تجريبي '+i,i+1);
const d=await(await admin.GET(req('manager'))).json();assert.deepEqual(d.channels,['sms','whatsapp']);assert.equal(d.logs.length,12);assert.equal(d.logTotal,sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n);assert(d.logs.every(e=>Object.keys(e).sort().join()==='action,created_at'));assert.equal((await admin.GET(req(actor))).status,403);
assert(view.personMatches('مُشارك الاختبار','+966500000222','مشارك'));assert(view.personMatches('موظف','+966500000222','٠٥٠٠٠٠٠٢٢٢'));assert(!view.personMatches('موظف',null,'00'));
const candidate={linkedEmployeeId:null,registeredEmployeeId:null,declined:false};assert(view.prospectMatches(candidate,'unregistered'));assert(!view.prospectMatches({...candidate,registeredEmployeeId:'x'},'unregistered'));assert(!view.prospectMatches({...candidate,declined:true},'unregistered'));assert(view.prospectMatches({...candidate,linkedEmployeeId:'x'},'confirmed'));
sql.close();console.log('PASS: manager-only full ranking, published-time tiebreaker, cutoff 1–20, frozen titles/votes and no backfill, live counts, stored channels, exact audit total, Arabic search and distinct registration states.');
