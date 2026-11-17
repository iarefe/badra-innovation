import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sql,load,env,req,seedEmployee} from './test-fixture.mjs';

const api=await load('app/api/challenges/route.ts'),lib=await load('lib/challenges.ts');
const owner=seedEmployee('category-owner'),other=seedEmployee('category-other');
const created=await api.POST(req(owner,{challenge:lib.exampleChallenges[0].challenge,submit:true}));
assert.equal(created.status,200);const {id}=await created.json();
const row=()=>sql.prepare('SELECT * FROM challenges WHERE id=?').get(id);
const category=()=>JSON.parse(row().payload).domain;
const edit=(user,domain,previousDomain=category(),options={},extra={})=>api.PATCH(req(user,{id,action:'category',domain,previousDomain,...extra},'PATCH',options));
const target=lib.domains.find(d=>d!==category());
await api.PATCH(req(other,{id,action:'vote',active:true},'PATCH'));
await api.PATCH(req(other,{id,action:'interest',active:true},'PATCH'));
sql.prepare("INSERT INTO challenge_covers(challenge_id,object_key,status) VALUES(?,?,'ready')").run(id,'fixture-cover');
const related=()=>Object.fromEntries(['challenge_votes','challenge_interests','challenge_covers'].map(table=>[table,sql.prepare('SELECT * FROM '+table+' WHERE challenge_id=?').all(id)]));
const before=row(),relations=related();
for(const [user,status,options] of [[null,401,{}],[other,403,{}],[owner,403,{origin:'https://evil.test'}],[owner,403,{headers:{'sec-fetch-site':'cross-site'}}],[null,401,{headers:{'x-phone':'+966599999901','oai-authenticated-user-email':'manager@test.local'}}]])assert.equal((await edit(user,target,category(),options)).status,status);
assert.equal((await edit(owner,'فئة غير موجودة')).status,400);
assert.equal((await edit(owner,target,category(),{},{payload:{title:'لا يتغيّر'}})).status,400);
assert.deepEqual(row(),before);assert.deepEqual(related(),relations);
assert.equal((await edit(owner,target)).status,200);
const after=row();assert.equal(category(),target);
assert.deepEqual(JSON.parse(after.payload),{...JSON.parse(before.payload),domain:target});
for(const key of ['id','owner','status','created_at','published_at','review_note'])assert.equal(after[key],before[key],key);
assert.deepEqual(related(),relations);
let audit=sql.prepare("SELECT * FROM security_audit WHERE action LIKE 'تعديل فئة تحدي:%'").all();assert.equal(audit.length,1);assert.equal(audit[0].actor,'employee:'+owner.id);
assert.equal((await edit(owner,target)).status,200);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n,1,'No-op does not add an audit event');
const stale=await edit(owner,lib.domains[5],JSON.parse(before.payload).domain);assert.equal(stale.status,409);assert.equal((await stale.json()).currentDomain,target);assert.equal(category(),target);
assert.equal((await edit('manager',lib.domains[5])).status,200);
assert.equal(category(),lib.domains[5]);assert.deepEqual(related(),relations);
audit=sql.prepare("SELECT * FROM security_audit WHERE action LIKE 'تعديل فئة تحدي:%'").all();assert.equal(audit.length,2);assert.notEqual(audit[1].actor,'employee:'+owner.id);
for(const user of [null,owner,other]){
 const entries=(await (await api.GET(req(user))).json()).entries,entry=entries.find(e=>e.id===id);
 assert.equal(entry.challenge.domain,lib.domains[5]);
 for(const key of ['votes','interestCount','voters','interestedMembers'])assert.equal(key in entry,false,'Category update must not reveal '+key);
}
// A separate field changed after the read survives the category-only update.
const batch=env.DB.batch;
env.DB.batch=async statements=>{sql.prepare("UPDATE challenges SET payload=json_set(payload,'$.evidence',?) WHERE id=?").run('شاهد أحدث محفوظ بالتزامن مع تعديل الفئة.',id);return batch(statements)};
assert.equal((await edit(owner,target)).status,200);env.DB.batch=batch;
assert.equal(JSON.parse(row().payload).evidence,'شاهد أحدث محفوظ بالتزامن مع تعديل الفئة.');
// A race with another category edit neither overwrites it nor records a false success.
let auditCount=sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n;
env.DB.batch=async statements=>{sql.prepare("UPDATE challenges SET payload=json_set(payload,'$.domain',?) WHERE id=?").run(lib.domains[4],id);return batch(statements)};
assert.equal((await edit(owner,lib.domains[5])).status,409);env.DB.batch=batch;
assert.equal(category(),lib.domains[4]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n,auditCount);
// A finalized list is immutable, including the race between check and write.
env.DB.batch=async statements=>{sql.prepare('UPDATE workshop_settings SET finalized=1,open=0 WHERE id=1').run();return batch(statements)};
assert.equal((await edit(owner,target)).status,409);env.DB.batch=batch;
for(const user of [owner,'manager'])assert.equal((await edit(user,target)).status,409);
assert.equal(category(),lib.domains[4]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n,auditCount);
sql.prepare('UPDATE workshop_settings SET finalized=0,open=1 WHERE id=1').run();
// Recheck ownership at write time as well.
env.DB.batch=async statements=>{sql.prepare('UPDATE challenges SET owner=? WHERE id=?').run('employee:'+other.id,id);return batch(statements)};
assert.equal((await edit(owner,target)).status,409);env.DB.batch=batch;
assert.equal(category(),lib.domains[4]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n,auditCount);
sql.prepare('UPDATE challenges SET owner=? WHERE id=?').run('employee:'+owner.id,id);
const incompleteId=randomUUID();sql.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,updated_at) VALUES(?,?,?,'draft',1,1)").run(incompleteId,'employee:'+owner.id,JSON.stringify({...lib.blank,domain:lib.domains[0]}));
assert.equal((await api.PATCH(req(owner,{id:incompleteId,action:'category',domain:target,previousDomain:lib.domains[0]},'PATCH'))).status,200,'Draft category does not demand all publication fields');
assert.equal((await api.PATCH(req(owner,{id:randomUUID(),action:'category',domain:target,previousDomain:target},'PATCH'))).status,404);
assert.equal((await api.POST(req(owner,{id,challenge:{...JSON.parse(row().payload),title:'محاولة تغيير وصف التحدي'},submit:true}))).status,409,'Full published editing keeps its existing policy');
assert.deepEqual(related(),relations);assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);
sql.close();console.log('PASS: owner/manager category edits; verified permissions; known categories only; privacy; unchanged publication, content and interactions; atomic concurrent updates; final-list lock; audit and drafts.');
