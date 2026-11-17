import assert from 'node:assert/strict';
import {sql,load,env,req,seedEmployee} from './test-fixture.mjs';
const api=await load('app/api/challenges/route.ts'),bootstrap=await load('app/api/bootstrap/route.ts'),work=await load('app/api/workshop/route.ts'),covers=await load('app/api/challenge-cover/route.ts'),lib=await load('lib/challenges.ts');
const owner=seedEmployee('951'),voter=seedEmployee('952');
const add=async(submit=true)=>{const response=await api.POST(req(owner,{challenge:lib.exampleChallenges[0].challenge,submit}));assert.equal(response.status,200);return (await response.json()).id};
const feed=async user=>(await (await api.GET(req(user))).json()).entries;
const ws=async user=>(await (await work.GET(req(user))).json());
const publication=await load('lib/server/direct-publication.ts');
const id=await add();
assert.equal((await feed(null))[0].hasVotes,false);assert.equal(lib.voteLabel((await feed(null))[0]),'كن أول مصوّت');
const vote=await api.PATCH(req(voter,{id,action:'vote',active:true},'PATCH'));assert.equal(vote.status,200);assert.equal((await vote.json()).votes,undefined,'Vote responses cannot reveal counts');
await api.PATCH(req(voter,{id,action:'interest',active:true},'PATCH'));
for(const user of [null,owner,voter]){
 for(const data of [{entries:await feed(user)},await (await bootstrap.GET(req(user))).json()]){
  const card=data.entries.find(e=>e.id===id);assert.equal(card.hasVotes,true);
  for(const field of ['votes','interestCount','voters','interestedMembers'])assert.equal(field in card,false,field+' is manager-only');
  assert.equal(card.voted,user===voter);assert.equal(card.interested,user===voter);
  if(data.workshop)assert.deepEqual(data.workshop.selected,[]);
 }
 assert.deepEqual((await ws(user)).selected,[],'Ranking endpoint is also private');
}
assert.equal(lib.voteLabel((await feed(owner))[0]),'انضم للمصوّتين');assert.equal(lib.voteLabel((await feed(voter))[0]),'صوّتّ له');
const managerCard=(await feed('manager'))[0];assert.equal(managerCard.votes,1);assert.equal(managerCard.interestCount,1);assert.equal(managerCard.voters.length,1);assert.equal(managerCard.interestedMembers.length,1);
// An old pending submission is published; private and returned drafts stay private.
const pending=await add(false),returned=await add(false),draft=await add(false);
sql.prepare("UPDATE challenges SET status='pending',updated_at=123456,review_note='old' WHERE id=?").run(pending);
sql.prepare("UPDATE challenges SET status='returned' WHERE id=?").run(returned);
await publication.publishSubmittedChallenges();
assert.equal(sql.prepare('SELECT status FROM challenges WHERE id=?').get(pending).status,'published');assert.equal(sql.prepare('SELECT published_at FROM challenges WHERE id=?').get(pending).published_at,123456);
assert.equal(sql.prepare('SELECT status FROM challenges WHERE id=?').get(draft).status,'draft');assert.equal(sql.prepare('SELECT status FROM challenges WHERE id=?').get(returned).status,'returned');
// Forbidden attempts must leave every related record intact.
for(const user of [null,voter])assert.equal((await api.DELETE(req(user,{id},'DELETE'))).status,403);
assert.equal((await api.DELETE(req('manager',{id},'DELETE',{origin:'https://evil.test'}))).status,403);
const spoof=req(null,{id},'DELETE',{headers:{'x-phone':'+966599999901','oai-authenticated-user-email':'manager@test.local'}});assert.equal((await api.DELETE(spoof)).status,403);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(id).n,1);
// Owners can delete only their own challenge; a finalized publication belongs to the locked selection.
const ownRemovable=await add();
await api.PATCH(req(voter,{id:ownRemovable,action:'vote',active:true},'PATCH'));
assert.equal((await api.DELETE(req(owner,{id:ownRemovable},'DELETE',{origin:'https://evil.test'}))).status,403);
assert.equal((await api.DELETE(req(owner,{id:ownRemovable},'DELETE'))).status,200);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(ownRemovable).n,0);
assert(sql.prepare('SELECT actor FROM security_audit WHERE action=?').get('حذف تحدي: '+ownRemovable).actor.endsWith(owner.id));
// Deletion clears votes/interests/cover/final snapshot atomically, without reopening votes or replacing other winners.
const key='challenge-covers/'+id+'/test.webp',objects=new Set([key]);env.BUCKET={async delete(k){objects.delete(k)}};
sql.prepare("INSERT INTO challenge_covers(challenge_id,object_key,status) VALUES(?,?,'ready')").run(id,key);
let state=await ws('manager');await work.POST(req('manager',{action:'finalize',revision:state.revision}));state=await ws('manager');assert(state.selected.some(e=>e.id===id));
assert.deepEqual((await ws(null)).selected,[],'Closed snapshots do not expose counts');
assert.equal((await api.DELETE(req(owner,{id},'DELETE'))).status,409);
const removed=await api.DELETE(req('manager',{id},'DELETE'));assert.equal(removed.status,200);
for(const [table,column] of [['challenges','id'],['challenge_votes','challenge_id'],['challenge_interests','challenge_id'],['challenge_covers','challenge_id'],['workshop_selection','challenge_id']])assert.equal(sql.prepare('SELECT COUNT(*) n FROM '+table+' WHERE '+column+'=?').get(id).n,0,table);
const after=await ws('manager');assert.equal(after.finalized,true);assert.equal(after.open,false);assert(after.revision>state.revision);assert(!after.selected.some(e=>e.id===id));assert(after.selected.some(e=>e.id===pending));assert.equal(objects.size,0);
assert(!(await feed(null)).some(e=>e.id===id));assert.equal((await covers.GET(new Request('https://site.test/api/challenge-cover?id='+id))).status,404);
assert.equal((await api.DELETE(req('manager',{id},'DELETE'))).status,404);
assert(sql.prepare("SELECT action FROM security_audit WHERE action=?").get('حذف تحدي: '+id));
assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
sql.close();console.log('PASS: direct publication and pending migration; private drafts; count and ranking privacy across endpoints/roles; encouragement states; owner-scoped deletion, frozen-list protection and manager deletion; cascade and snapshot cleanup; audit; cover removal.');
