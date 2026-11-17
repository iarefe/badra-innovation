// Runs the application HTTP handlers over isolated in-memory SQLite and test employee sessions.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,req,seedEmployee,sql} from './test-fixture.mjs';

const final=await load('app/api/final-vote/route.ts'),teams=await load('app/api/teams/route.ts');
const admin='manager',member=seedEmployee('611'),attendee=seedEmployee('612'),outside=seedEmployee('613'),unavailable=seedEmployee('614'),referee=seedEmployee('615');
const [a,b,other]=Array.from({length:3},()=>randomUUID());
const names=['فريق إدارة الاجتماعات','فريق تتبع الطلبات','تحدّ لم يتأهل'];
for(const [i,id] of [a,b,other].entries())sql.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',1,1,1)").run(id,'employee:'+member.id,JSON.stringify({title:names[i]}));
sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(a,'employee:'+attendee.id);
const get=(user,manage=false)=>final.GET(new Request('https://site.test/api/final-vote'+(manage?'?admin=1':''),{headers:req(user).headers}));
const post=(user,body,options={})=>final.POST(req(user,body,'POST',options));
async function ok(promise){const r=await promise;assert(r.ok,`${r.status}: ${await r.clone().text()}`);return r.json();}
async function denied(promise){const r=await promise;assert(r.status>=400&&r.status<500,`should reject the action: ${r.status}`);}
const check=(person,attending=true)=>({action:'attendance',person:person.id,attending});
const vote=team=>({action:'vote',team}),open={action:'open'},close={action:'close'};
const stats=()=>ok(get(admin,true));
async function assertTally(expectedA,expectedB){const s=await stats();assert.equal(s.cast,expectedA+expectedB);assert.equal(s.teams.find(t=>t.id===a).votes,expectedA);assert.equal(s.teams.find(t=>t.id===b).votes,expectedB);}
const before=await ok(get(null));assert.equal(before.phase,'not_open');assert.equal(before.signedIn,false);assert.deepEqual(before.teams,[]);
await denied(post(admin,open));await denied(get(null,true));await denied(get(attendee,true));
await ok(teams.POST(req(admin,{action:'announce',ids:[a,b],revision:0})));
await ok(teams.POST(req(admin,{action:'audience',team:a,value:12.5})));
await ok(teams.POST(req(admin,{action:'judge',person:referee.id,enabled:true})));
await ok(teams.POST(req(referee,{action:'score',team:a,scores:[5,4,3,2,1,5],notes:Array(6).fill(''),signature:'مقيّم تجريبي'})));
const originalScores=()=>({grades:sql.prepare('SELECT team,person,card FROM team_scores ORDER BY team,person').all(),audience:sql.prepare('SELECT id,audience FROM event_teams ORDER BY id').all(),nomination:sql.prepare('SELECT challenge_id,user_id FROM challenge_votes ORDER BY challenge_id,user_id').all(),snapshot:sql.prepare('SELECT challenge_id,votes,rank FROM workshop_selection ORDER BY rank').all()});
const baseline=originalScores();
await denied(post(attendee,open));await denied(post(attendee,check(attendee)));await denied(post(null,check(attendee)));
await denied(post(admin,open,{origin:'https://unrelated.test'}));
await denied(post(admin,check(attendee),{headers:{'sec-fetch-site':'cross-site'}}));
assert.equal((await ok(get(attendee))).attending,false,'Login must never mark attendance.');
await ok(post(admin,check(attendee)));await ok(post(admin,check(member)));await ok(post(admin,check(unavailable)));
await ok(post(admin,check(unavailable,false)));assert.equal((await ok(get(unavailable))).attending,false);
await denied(post(attendee,vote(a)));await assertTally(0,0);await ok(post(admin,open));
const state=await ok(get(attendee));assert.equal(state.phase,'open');assert.equal(state.attending,true);assert.equal(state.vote,null);
assert.deepEqual(state.teams.map(t=>t.id).sort(),[a,b].sort());
await denied(post(null,vote(a)));await denied(post(outside,vote(a)));await denied(post(unavailable,vote(a)));await denied(post(attendee,vote(other)));
await denied(post(attendee,vote(a),{origin:'https://unrelated.test'}));
await Promise.all([get(attendee),get(attendee),get(null)]);await assertTally(0,0);
await ok(post(attendee,vote(a)));await ok(post(attendee,vote(a)));await denied(post(attendee,vote(b)));
assert.deepEqual((await ok(get(attendee))).vote,{team:a,title:names[0]});
assert.equal((await ok(get(member))).vote,null);await assertTally(1,0);
await denied(post(admin,check(attendee,false)));assert.equal((await ok(get(attendee))).attending,true);
await denied(post(outside,close));await ok(post(admin,close));await denied(post(member,vote(b)));
const closed=await ok(get(attendee));assert.equal(closed.phase,'closed');assert.equal(closed.vote.team,a);await assertTally(1,0);
await ok(post(admin,open));await ok(post(member,vote(b)));await assertTally(1,1);
await ok(post(admin,check(unavailable)));sql.prepare('UPDATE employees SET active=0 WHERE id=?').run(unavailable.id);
await denied(post(unavailable,vote(b)));await assertTally(1,1);
// Concurrent submissions by the same employee must settle on exactly one team.
await ok(post(admin,check(outside)));const races=await Promise.all([post(outside,vote(a)),post(outside,vote(b))]);
assert.equal(races.filter(r=>r.ok).length,1,'At most one winner across racing different choices');
const actual=(await ok(get(outside))).vote.team;await assertTally(actual===a?2:1,actual===b?2:1);
for(const u of [null,referee,attendee]){const r=await get(u),d=await r.json();assert.match(r.headers.get('Cache-Control')||'',/no-store/);assert(!('cast'in d)&&!('people'in d));assert(d.teams.every(t=>!('votes'in t)&&!('audience'in t)));assert(!JSON.stringify(d).includes(member.id),'Private attendee IDs must not appear in the public payload');}
await ok(post(admin,close));assert.deepEqual(originalScores(),baseline,'Final ballots must never mutate nomination votes, announced ranking, or jury/audience points');
console.log('PASS: independent final ballot, check-in, immutable and concurrent votes, close/reopen, private totals and unchanged nomination/jury/audience scores.');
