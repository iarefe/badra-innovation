import assert from 'node:assert/strict';
import {sql,load,seedEmployee,req} from './test-fixture.mjs';
const api=await load('app/api/challenges/route.ts'),work=await load('app/api/workshop/route.ts'),lib=await load('lib/challenges.ts');
const owner=seedEmployee('961'),other=seedEmployee('962');
const feed=async user=>(await (await api.GET(req(user))).json()).entries;
const act=(user,id,action,active=true)=>api.PATCH(req(user,{id,action,active},'PATCH'));
const add=async user=>{const r=await api.POST(req(user,{challenge:lib.exampleChallenges[0].challenge,submit:true}));assert.equal(r.status,200);return (await r.json()).id};
const id=await add(owner),managerId=await add('manager');
for(const [user,challenge] of [[owner,id],['manager',managerId]])for(const action of ['vote','interest'])for(const active of [true,false])assert.equal((await act(user,challenge,action,active)).status,403,'Ownership is enforced even for a manager');
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_interests').get().n,0);
for(const action of ['vote','interest']){
 assert.equal((await act(other,id,action)).status,200);
 assert.equal((await act(other,id,action)).status,200,'Other participants remain idempotent');
 for(const example of lib.exampleChallenges)assert.equal((await act(other,example.id,action)).status,400,'Examples are not real server records');
}
// Existing self-participation never contributes to live totals, member lists or a new shortlist.
sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(id,'employee:'+owner.id);
sql.prepare('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)').run(id,owner.id,Date.now());
const admin=(await feed('manager')).find(e=>e.id===id),mine=(await feed(owner)).find(e=>e.id===id);
assert.equal(admin.votes,1);assert.equal(admin.interestCount,1);
assert.deepEqual(admin.voters,[{name:'موظف الاختبار 962'}]);assert.equal(admin.interestedMembers.length,1);assert.equal(admin.interestedMembers[0].name,'موظف الاختبار 962');
assert.equal(mine.mine,true);assert.equal(mine.voted,false);assert.equal(mine.interested,false);assert.equal(mine.votes,undefined);
let workshop=await (await work.GET(req('manager'))).json();assert.equal(workshop.selected.find(e=>e.id===id).votes,1);
assert.equal((await work.POST(req('manager',{action:'finalize',revision:workshop.revision}))).status,200);
workshop=await (await work.GET(req('manager'))).json();assert.equal(workshop.selected.find(e=>e.id===id).votes,1);
assert.equal((await act(other,id,'vote',false)).status,409);assert.equal((await act(other,id,'interest',false)).status,200);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(id).n,2,'Historic records remain intact');
const base={...lib.exampleChallenges[0],example:false};
const entries=[{...base,id:'older',createdAt:1},{...base,id:'private',status:'draft',createdAt:99},{...base,id:'newer',createdAt:2},...lib.exampleChallenges];
const before=entries.map(e=>e.id);
assert.deepEqual(lib.challengeFeed(entries).map(e=>e.id),['newer','older',...lib.exampleChallenges.map(e=>e.id)]);
assert.deepEqual(lib.challengeFeed(entries,1).map(e=>e.id),['newer',...lib.exampleChallenges.map(e=>e.id)],'Home limit applies only to real challenges');
assert.deepEqual(lib.challengeFeed([{...base,status:'draft'}]),lib.exampleChallenges);
assert.deepEqual(entries.map(e=>e.id),before,'Preparing the feed does not mutate source data');
assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();
console.log('PASS: persistent inspiration examples; owner and manager self-participation denied; other participants unaffected; legacy self-actions excluded from totals, lists and new ranking; examples cannot receive actions.');
