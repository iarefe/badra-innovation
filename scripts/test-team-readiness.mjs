// Exercise manager-only readiness using the same eligibility and delivery records as /teams.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,req,seedEmployee,sql} from './test-fixture.mjs';

const readiness=await load('app/api/team-readiness/route.ts'),teams=await load('app/api/teams/route.ts');
const one=seedEmployee('891'),two=seedEmployee('892'),inactive=seedEmployee('893'),revoked=seedEmployee('894');
const a=randomUUID(),b=randomUUID(),c=randomUUID();
for(const [team,owner] of [[a,one],[b,two],[c,two]]){
  sql.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',1,1,1)").run(team,'employee:'+owner.id,JSON.stringify({title:team}));
}
const get=()=>readiness.GET(req('manager')).then(r=>r.json()).then(d=>d.rows);
assert.deepEqual(await get(),[]);
for(const user of [null,one]){const r=await readiness.GET(req(user));assert.equal(r.status,user?403:401);}
const action=async(who,cmd)=>{const res=await teams.POST(req(who,cmd));assert.equal(res.status,200,await res.text());};
await action('manager',{action:'announce',ids:[a,b],revision:0});
for(const j of [one,two,inactive,revoked])await action('manager',{action:'judge',person:j.id,enabled:true});
for(const judge of [two,inactive,revoked])await action(judge,{action:'score',team:a,scores:[1,2,3,4,5,5],notes:Array(6).fill('ملاحظة خاصة'),signature:'توقيع خاص'});
await action('manager',{action:'judge',person:revoked.id,enabled:false});
sql.prepare('UPDATE employees SET active=0 WHERE id=?').run(inactive.id);
sql.prepare("UPDATE event_teams SET solution='https://private.example/secret',instructions='بيانات دخول خاصة' WHERE id=?").run(a);
sql.prepare("INSERT INTO team_files(team,kind,object_key,name) VALUES(?,'slides','private/object','private.pdf')").run(a);
sql.prepare("INSERT INTO team_files(team,kind,object_key,name) VALUES(?,'solution','private/object2','private.zip')").run(b);
const rows=await get();
assert.deepEqual(rows.map(r=>r.rank),[1,2]);
assert(!rows.some(r=>r.id===c));
const flags=r=>[r.solution,r.instructions,r.slides,r.submitted,r.required];
assert.deepEqual(flags(rows.find(r=>r.id===a)),[true,true,true,1,1]);
assert.deepEqual(flags(rows.find(r=>r.id===b)),[false,false,false,0,1]);
for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['id','title','rank','solution','instructions','slides','submitted','required'].sort());
assert(!/private|بيانات دخول خاصة|توقيع خاص/.test(JSON.stringify(rows)));
await action(two,{action:'slidesLink',team:b,url:'https://slides.example/for-team-b'});
assert.equal((await get()).find(r=>r.id===b).slides,true);
assert.equal((await readiness.GET(req(two))).status,403,'assigned judges cannot see manager readiness');
console.log('PASS: announced-team readiness flags, rank order, link or attachment, eligible jury counts and manager-only data minimization.');
