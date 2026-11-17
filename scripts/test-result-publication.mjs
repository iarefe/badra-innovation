import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,req,seedEmployee,sql} from './test-fixture.mjs';
const api=await load('app/api/results/route.ts'),jury=await load('app/api/teams/route.ts');
const j=seedEmployee('811'),other=seedEmployee('812');
const run=(q,...a)=>sql.prepare(q).run(...a);
const get=(kind='',u=null)=>api.GET(new Request('https://site.test/api/results'+kind,{headers:req(u).headers}));
const publicView=async()=>(await (await get()).json()).publication;
const preview=async()=>(await (await get('?preview=1','manager')).json());
const approve=(p,u='manager',options)=>api.POST(req(u,{revision:p.revision,fingerprint:p.fingerprint},'POST',options));
const x=randomUUID(),y=randomUUID(),z=randomUUID(),mask='never-publish-jury-note';
const makeTeam=(id,title,rank,announced=1)=>{
 const payload=JSON.stringify({title});
 run("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,'fixture',?,'published',1,1,1)",id,payload);
 run("INSERT INTO workshop_selection(challenge_id,payload,votes,rank) VALUES(?,?,0,?)",id,payload,rank);
 run("INSERT INTO event_teams(id,announced) VALUES(?,?)",id,announced);
};
function card(team,person,scores){run("INSERT OR REPLACE INTO team_scores(team,person,card,stamp) VALUES(?,?,?,1)",team,person,JSON.stringify({scores,signature:mask,notes:[mask]}))}
assert.equal(await publicView(),null);
assert.equal((await get('?preview=1')).status,401);assert.equal((await get('?preview=1',other)).status,403);
for(const [i,id] of [x,y,z].entries())makeTeam(id,'فريق محلي '+i,i+1);
for(const judge of [j,other])run('INSERT INTO event_judges(person) VALUES(?)',judge.id);
for(const id of [x,y,z])card(id,j.id,Array(6).fill(4));
run("UPDATE event_teams SET audience=0 WHERE id=?",x);
assert((await preview()).reason);assert.equal((await approve(await preview())).status,409);
run("UPDATE event_teams SET audience=10 WHERE id<>?",x);
run("INSERT INTO final_ballot_settings(id,phase) VALUES(1,'open')");
assert((await preview()).reason);assert.equal(await publicView(),null);
run("UPDATE final_ballot_settings SET phase='closed'");
let p=await preview();assert.equal(p.reason,null);assert.deepEqual(p.standings.map(t=>[t.place,t.score]),[[1,66],[1,66],[3,56]]);
assert.equal((await approve(p,null)).status,401);assert.equal((await approve(p,j)).status,403);
assert.equal((await approve(p,'manager',{origin:'https://elsewhere.test'})).status,403);
assert.equal(await publicView(),null,'Completing unrelated teams must not auto-publish');
run("UPDATE event_teams SET audience=20 WHERE id=?",y);
assert.equal((await approve(p)).status,409,'Changed score invalidates the confirmed preview');
p=await preview();assert.equal((await approve(p)).status,200);
const frozen=await publicView();assert.equal(frozen.revision,1);assert.equal(frozen.standings[0].id,y);
assert.deepEqual(Object.keys(frozen.standings[0]).sort(),['id','place','score','teamNumber','title'].sort());
assert(!JSON.stringify(frozen).includes(mask));
assert.equal((await approve(p)).status,200);assert.equal((await publicView()).revision,1,'Repeated clicks do not duplicate an edition');
card(x,other.id,Array(6).fill(5));run("UPDATE event_teams SET audience=30 WHERE id=?",x);
assert.deepEqual(await publicView(),frozen,'Changing marks cannot silently rewrite a published result');
const current=await (await jury.GET(new Request('https://site.test/api/teams?view=results',{headers:req('manager').headers}))).json();
p=await preview();for(const t of p.standings)assert.equal(t.score,current.teams.find(e=>e.id===t.id).result.final);
assert.equal((await approve({...p,revision:0})).status,409);assert.equal((await approve(p)).status,200);
assert.equal((await publicView()).standings[0].id,x);assert.equal((await publicView()).revision,2);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM result_publications').get().n,2);
console.log('PASS: public/private split, missing versus zero scores, open ballot, tied ranks, partial juries, stale previews, frozen and idempotent editions.');
if(process.argv.includes('--approved-fixture')){
 const chunks=[];for await(const part of process.stdin)chunks.push(part);const event=JSON.parse(Buffer.concat(chunks).toString());
 for(const table of ['result_publications','team_scores','event_judges','event_teams','workshop_selection','challenges'])sql.exec('DELETE FROM '+table);
 const judges=[0,1,2,3].map(n=>seedEmployee('85'+n).id);for(const id of judges)run('INSERT INTO event_judges(person) VALUES(?)',id);
 const vectors=new Map();for(let i=0;i<5**6;i++){let k=i;const s=Array.from({length:6},()=>{const v=k%5+1;k=Math.floor(k/5);return v});vectors.set(s.reduce((a,v,n)=>a+v*[4,3,3,2,1,1][n],0),s)}
 for(const t of event){makeTeam(t.id,t.title,t.teamNo,1794756395912);run('UPDATE event_teams SET audience=? WHERE id=?',t.audience,t.id);
  judges.forEach((j,i)=>card(t.id,j,vectors.get(Math.floor(t.committee)+(i<(t.committee%1)*judges.length?1:0))));}
 run('UPDATE event_teams SET audience=29 WHERE id=?',event[0].id);
 assert.equal(await publicView(),null,'A score differing from the explicit release must not be published');
 run('UPDATE event_teams SET audience=? WHERE id=?',event[0].audience,event[0].id);
 const announcement=await publicView();assert.deepEqual(announcement.standings.map(t=>[t.id,t.score]),event.map(t=>[t.id,t.total]));
 assert.equal(announcement.revision,1);assert.deepEqual(await publicView(),announcement);
 console.log('PASS: exact approved four-team release → persisted edition, first place 88.75, zero accidental publication on mismatch.');
}
