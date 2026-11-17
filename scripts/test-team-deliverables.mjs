// Real HTTP routes, existing migration history, an isolated SQLite DB and an in-memory file bucket.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {env,load,req,seedEmployee,sql} from './test-fixture.mjs';

const api=await load('app/api/teams/route.ts'),files=await load('app/api/teams/file/route.ts');
const team=randomUUID(),otherTeam=randomUUID(),member=seedEmployee('870'),judge=seedEmployee('871'),other=seedEmployee('872');
const bucket=new Map();env.BUCKET={put:(k,b)=>bucket.set(k,b),get:k=>bucket.has(k)?{body:bucket.get(k)}:null,delete:k=>bucket.delete(k)};
const post=async(user,body,status=200)=>{const res=await api.POST(req(user,body));assert.equal(res.status,status,body.action+': '+await res.text())};
const teamOf=async user=>(await (await api.GET(req(user))).json()).teams.find(t=>t.id===team);
const fileReq=(user,kind,body,name='deck.pdf',target=team)=>new Request('https://site.test/api/teams/file?'+new URLSearchParams({team:target,kind,name}),{method:body===undefined?'GET':'POST',headers:req(user).headers,...(body===undefined?{}:{body})});
const download=(user,kind='slides')=>files.GET(fileReq(user,kind));
const upload=(user,body,name,kind='slides')=>files.POST(fileReq(user,kind,body,name));
const instructions=text=>({action:'instructions',team,text}),slidesLink=url=>({action:'slidesLink',team,url});
const demo='https://solution.example.test/demo',deck='https://decks.example.test/present/42',notes='بيئة العرض التجريبية\nاختر حساب زائر لفتح النموذج.\nاستخدم بيانات المثال فقط.';
for(const [id,owner] of [[team,member],[otherTeam,other]])sql.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',1,1,1)").run(id,'employee:'+owner.id,JSON.stringify({title:'فريق الاختبار'}));
await post('manager',{action:'announce',ids:[team,otherTeam],revision:0});
await post('manager',{action:'judge',person:judge.id,enabled:true});
// Simulate a team announced before this change: both old delivery kinds already exist.
sql.prepare('UPDATE event_teams SET solution=? WHERE id=?').run(demo,team);
for(const [kind,name,bytes] of [['solution','prototype.zip','legacy solution'],['slides','old-deck.pdf','%PDF-old']]){
 const key='old/'+kind;bucket.set(key,bytes);
 sql.prepare('INSERT INTO team_files(team,kind,object_key,name) VALUES(?,?,?,?)').run(team,kind,key,name);
}
assert.equal((await teamOf(member)).solution,demo);assert.equal((await teamOf(member)).instructions,'');assert.equal((await teamOf(member)).slides_url,'');
assert.equal(await (await download(judge,'solution')).text(),'legacy solution');
assert.equal(await (await download(judge)).text(),'%PDF-old');
assert(!(await upload(member,'%PDF-replacement','replacement.pdf','solution')).ok,'archived solution files are read-only');

await post(member,instructions(notes));await post(member,slidesLink(deck));
for(const user of [member,judge,'manager']){
 const t=await teamOf(user);assert.equal(t.solution,demo);assert.equal(t.instructions,notes);assert.equal(t.slides_url,deck);
}
assert.equal(await (await download(member)).text(),'%PDF-old','team may restore its earlier attachment');
for(const user of [judge,'manager'])assert.equal((await download(user)).status,404,'readers get only the active presentation');
await post(member,slidesLink(''));assert.equal(await (await download(judge)).text(),'%PDF-old','clearing a link restores the stored file');
await post(member,slidesLink(deck));
await post(member,slidesLink('http://decks.example.test/insecure'),400);await post(member,instructions('x'.repeat(6001)),400);
assert.equal((await teamOf(member)).slides_url,deck);assert.equal((await teamOf(member)).instructions,notes);
for(const user of [null,other,judge,'manager']){
 const expected=user===null?401:403;await post(user,slidesLink(''),expected);await post(user,instructions(''),expected);
 assert(!(await upload(user,'%PDF-no','no.pdf')).ok);
}
for(const user of [other,null]){
 assert.equal(await teamOf(user),undefined);assert.equal((await download(user)).status,404);assert.equal((await download(user,'solution')).status,404);
 const notice=await (await api.GET(new Request('https://site.test/api/teams?notice=1',{headers:req(user).headers}))).json();
 assert.equal(notice.announced.length,2);assert.deepEqual(Object.keys(notice).sort(),['announced']);
 for(const row of notice.announced)assert.deepEqual(Object.keys(row).sort(),['id','rank','title']);
}
assert(!(await upload(member,'not a PDF','bad.pdf')).ok);assert.equal((await teamOf(member)).slides_url,deck);
assert.equal(await (await download(member)).text(),'%PDF-old','failed replacement preserves attachment');
// A failure after writing to storage must roll back BOTH metadata changes and discard the new object.
sql.exec("CREATE TRIGGER fixture_db_failure BEFORE UPDATE OF slides_url ON event_teams BEGIN SELECT RAISE(ABORT,'test failure'); END;");
assert.equal((await upload(member,'%PDF-not-committed','failed.pdf')).status,409);
assert.equal(bucket.size,2);assert.equal((await teamOf(member)).slides_url,deck);assert.equal(await (await download(member)).text(),'%PDF-old');
sql.exec('DROP TRIGGER fixture_db_failure');
assert.equal((await upload(member,'%PDF-new','final.pdf')).status,200);
const saved=await teamOf(judge);assert.equal(saved.slides_url,'');assert.equal(saved.files.find(f=>f.kind==='slides').name,'final.pdf');
assert.equal(await (await download(judge)).text(),'%PDF-new');assert.equal(await (await download('manager','solution')).text(),'legacy solution');
// PowerPoint uploads use their ZIP-container signature and .pptx extension. Pass binary, not a converted text body.
const pptx=Uint8Array.of(0x50,0x4b,0x03,0x04,0x14,0,0,0,0xff,0);
await post(other,{action:'slidesLink',team:otherTeam,url:deck});
assert.equal((await files.POST(fileReq(other,'slides',pptx,'عرض.pptx',otherTeam))).status,200);
const otherDownload=await files.GET(fileReq(judge,'slides',undefined,undefined,otherTeam));
assert.equal(otherDownload.status,200);assert.deepEqual(new Uint8Array(await otherDownload.arrayBuffer()),pptx);
assert.equal((await files.GET(fileReq(member,'slides',undefined,undefined,otherTeam))).status,404,'team cannot download a different team’s deck');
assert.equal(await (await download(judge)).text(),'%PDF-new','each deck must remain scoped to its own team');
// A revocation must immediately remove access to the private handover.
await post('manager',{action:'judge',person:judge.id,enabled:false});assert.equal(await teamOf(judge),undefined);assert.equal((await download(judge)).status,404);
await post(member,instructions(''));assert.equal((await teamOf(member)).instructions,'');
console.log('PASS: private team instructions, read-only legacy deliverables, presentation link/file transitions and recovery, member-only editing and role isolation.');
