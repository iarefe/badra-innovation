import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import jsQR from 'jsqr';
import {sql,load,req,seedEmployee} from './test-fixture.mjs';
const [{GET},{displayReducer,displayState,displayOrigin,cardPath,submitUrl,excerpt},{displayQR}]=await Promise.all([load('app/api/presentation/route.ts'),load('lib/presentation.ts'),load('lib/display-qr.ts')]);
const owner=seedEmployee('43431'),other=seedEmployee('43432'),secretName='لا يظهر اسم الراغب في العرض';
sql.prepare('UPDATE employees SET name=? WHERE id=?').run(secretName,other.id);
const base={title:'تأخّر اعتماد الطلبات الداخلية',situation:'يحتاج الموظف إلى متابعة الطلب عبر عدة رسائل، ولا تظهر له مرحلة الاعتماد التالية.',author:'صاحب بطاقة منشورة',domain:'العمليات والاجتماعات',scope:'داخلي',ownership:'shared',coOwners:'شريكة التحدي',privateNotes:'PRIVATE-SENTINEL'};
const insert=(id,status,when,extra={})=>sql.prepare('INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at,review_note) VALUES(?,?,?,?,?,?,?,?)').run(id,'employee:'+owner.id,JSON.stringify({...base,...extra}),status,when,status==='published'?when:null,when,'PRIVATE-REVIEW');
async function read(user){const response=await GET(req(user));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);return response.json();}
assert.deepEqual((await read()).slides,[]);
const a=randomUUID(),b=randomUUID(),c=randomUUID(),draft=randomUUID();
insert(a,'published',4);insert(b,'published',8,{ownership:'individual',coOwners:'OLD-PRIVATE-TEAM'});insert(draft,'draft',1,{title:'SECRET-DRAFT'});insert('example-1','published',2,{title:'EXAMPLE-TITLE'});insert(randomUUID(),'pending',1,{title:'PENDING-TITLE'});
sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(a,'employee:'+other.id);
sql.prepare('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)').run(a,other.id,5);
sql.prepare('INSERT INTO employee_avatars(employee_id,object_key,updated_at) VALUES(?,?,?)').run(owner.id,'PRIVATE-OBJECT-KEY',12);
const initial=await read();const samePublicFeed=(a,b)=>{assert.equal(typeof a.intake.serverNow,'number');assert.equal(typeof b.intake.serverNow,'number');assert.deepEqual({...a,intake:{...a.intake,serverNow:0}},{...b,intake:{...b.intake,serverNow:0}})};
samePublicFeed(initial,await read('manager'));samePublicFeed(initial,await read(owner));
assert.deepEqual(initial.slides.map(s=>s.id),[a,b]);assert.equal(initial.slides[0].department,'إدارة الاختبار');assert.equal(initial.slides[0].team,base.coOwners);assert.equal(initial.slides[1].team,'');assert.equal(initial.slides[0].author,base.author);assert.match(initial.slides[0].avatarUrl,/challenge=/);
assert.deepEqual(Object.keys(initial.slides[0]).sort(),['id','title','summary','author','department','team','domain','scope','avatarUrl','coverUrl'].sort());
for(const marker of [secretName,'PRIVATE','SECRET','PENDING','EXAMPLE',owner.phone,other.phone,owner.id,other.id,draft])assert.ok(!JSON.stringify(initial).includes(marker),marker);
let state=displayReducer(displayState(null),{type:'refresh',feed:initial});assert.equal(state.id,null,'Opening stays on screen when the initial feed arrives');
state=displayReducer(state,{type:'move',offset:1});assert.equal(state.id,a);
state=displayReducer(state,{type:'move',offset:1});assert.equal(state.id,b);
insert(c,'published',9);const added=await read();assert.deepEqual(added.slides.map(x=>x.id),[a,b,c]);
state=displayReducer(state,{type:'refresh',feed:added});assert.equal(state.id,b);
state=displayReducer(state,{type:'move',offset:1});assert.equal(state.id,c);
const wrapped=displayReducer(state,{type:'move',offset:1});assert.equal(wrapped.id,null,'Last challenge returns to the opening');assert.equal(displayReducer(wrapped,{type:'move',offset:1}).id,a);
assert.equal(displayReducer(displayState(added),{type:'move',offset:-1}).id,c);
sql.prepare("UPDATE challenges SET status='draft' WHERE id=?").run(c);
state=displayReducer(state,{type:'refresh',feed:await read()});assert.equal(state.id,null,'Withdrawing the last item returns to the opening');
state=displayReducer(state,{type:'move',offset:1});assert.equal(state.id,a);
sql.prepare("DELETE FROM challenges WHERE id=?").run(a);
state=displayReducer(state,{type:'refresh',feed:await read()});assert.equal(state.id,b);
const single=displayState(await read());assert.equal(single.feed.slides.length,1);assert.equal(single.id,null);const singleCard=displayReducer(single,{type:'move',offset:1});assert.equal(singleCard.id,b);assert.equal(displayReducer(singleCard,{type:'move',offset:1}).id,null);assert.equal(displayReducer(single,{type:'move',offset:-1}).id,b);
sql.prepare('INSERT OR REPLACE INTO workshop_settings(id,title,count,open,finalized,revision) VALUES(1,?,3,0,0,1)').run('عنوان الفعالية الفعلي');assert.equal((await read()).votingOpen,false);assert.equal((await read()).title,'عنوان الفعالية الفعلي');
sql.prepare("UPDATE challenges SET status='draft'").run();assert.equal(displayReducer(state,{type:'refresh',feed:await read()}).id,null);
assert.equal(excerpt('  سلام   عليكم '),'سلام عليكم');assert.ok(excerpt('سؤال طويل عن الحياة '.repeat(30)).length<=221);
// Independently decode the exact module geometry used by the SVG, including its required quiet zone.
function decode(url){
 const {size,path}=displayQR(url),scale=7,width=size*scale,data=new Uint8ClampedArray(width*width*4).fill(255);
 for(const m of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)){
  const [x,y,len]=m.slice(1).map(Number);assert.ok(x>=4&&y>=4&&x+len<=size-4&&y<size-4);
  for(let py=y*scale;py<(y+1)*scale;py++)for(let px=x*scale;px<(x+len)*scale;px++){const i=(py*width+px)*4;data[i]=data[i+1]=data[i+2]=0;}
 }
 return jsQR(data,width,width)?.data;
}
for(const url of [submitUrl,displayOrigin+cardPath(a),displayOrigin+cardPath(b)])assert.equal(decode(url),url);
console.log('PASS — published-only, public projection, privacy, attributed team, refresh, rotation/withdrawal, voting state and QR round trips.');
