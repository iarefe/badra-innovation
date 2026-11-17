import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sql,load,env,req,seedEmployee} from './test-fixture.mjs';
const avatars=await load('app/api/avatar/route.ts'),challenges=await load('app/api/challenges/route.ts'),bootstrap=await load('app/api/bootstrap/route.ts'),lib=await load('lib/challenges.ts');
const a=seedEmployee('911'),b=seedEmployee('912'),image=new Uint8Array(readFileSync('public/placeholder.svg'));
const objects=new Map();const avatarCount=()=>[...objects.keys()].filter(key=>key.startsWith('avatars/')).length;let failPut=false;
env.BUCKET={async put(key,bytes,metadata){if(failPut)throw Error('test write failure');objects.set(key,{bytes,metadata})},async get(key){const o=objects.get(key);return o?{body:o.bytes,httpMetadata:o.metadata.httpMetadata}:null},async delete(key){objects.delete(key)}};
const add=await challenges.POST(req(a,{challenge:lib.exampleChallenges[0].challenge,submit:false}));const id=(await add.json()).id;
const current=()=>sql.prepare('SELECT * FROM employee_avatars WHERE employee_id=?').get(a.id);
function upload(user=a,body=image,options={}){return new Request('https://site.test/api/avatar'+(options.query||''),{method:'POST',headers:{origin:options.origin||'https://site.test','content-type':options.type||'image/webp',...(user?{cookie:'__Host-badra-employee='+user.secret}:{}),...options.headers},body})}
function get(user,query){return new Request('https://site.test/api/avatar?'+query,{headers:user?{cookie:'__Host-badra-employee='+user.secret}:{}})}
function remove(user=a,origin='https://site.test'){return new Request('https://site.test/api/avatar',{method:'DELETE',headers:{origin,...(user?{cookie:'__Host-badra-employee='+user.secret}:{})}})}
assert.equal((await avatars.POST(upload(null))).status,401);
assert.equal((await avatars.POST(upload(a,image,{origin:'https://evil.test'}))).status,403);
assert.equal((await avatars.DELETE(remove(a,'https://evil.test'))).status,403);
assert.equal((await avatars.POST(upload(a,image,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
assert.equal((await avatars.POST(upload(a,new TextEncoder().encode('<svg onload="alert(1)"></svg>'),{type:'image/svg+xml'}))).status,415);
assert.equal((await avatars.POST(upload(a,new Uint8Array(512*1024+1)))).status,413);
assert.equal(avatarCount(),0);
sql.prepare('UPDATE employees SET active=0 WHERE id=?').run(a.id);assert.equal((await avatars.POST(upload())).status,401);sql.prepare('UPDATE employees SET active=1 WHERE id=?').run(a.id);
sql.prepare("UPDATE employees SET roles='[]' WHERE id=?").run(a.id);assert.equal((await avatars.POST(upload())).status,401);sql.prepare("UPDATE employees SET roles='[\"challenger\"]' WHERE id=?").run(a.id);
let response=await avatars.POST(upload(a,image,{query:'?employee='+b.id}));assert.equal(response.status,200,await response.clone().text());
assert((await response.json()).avatarUrl.startsWith('/api/avatar?self=1&v='));assert(current().object_key.startsWith('avatars/'+a.id+'/'));assert.equal(sql.prepare('SELECT * FROM employee_avatars WHERE employee_id=?').get(b.id),undefined,'Caller-supplied ID cannot select another account');
assert.equal((await avatars.GET(get(null,'self=1'))).status,404);assert.equal((await avatars.GET(get(b,'self=1'))).status,404);
assert.equal((await avatars.GET(get(a,'self=1'))).status,200);assert.equal((await avatars.GET(get(null,'challenge='+id))).status,404);assert.equal((await avatars.GET(get(b,'challenge='+id))).status,404);assert.equal((await avatars.GET(get(a,'challenge='+id))).status,200);
const boot=await (await bootstrap.GET(req(a))).json();assert(boot.account.employee.avatarUrl);assert(boot.entries[0].authorAvatar.includes('challenge='+id));
const originalPayload=sql.prepare('SELECT payload FROM challenges WHERE id=?').get(id).payload;
sql.prepare("UPDATE challenges SET status='published' WHERE id=?").run(id);sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(id,'employee:'+b.id);sql.prepare('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)').run(id,b.id,1);
response=await avatars.GET(get(null,'challenge='+id));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal((await response.arrayBuffer()).byteLength,image.length);
let feed=await (await challenges.GET(req(null))).json();assert(feed.entries[0].authorAvatar.includes('challenge='+id));assert(!JSON.stringify(feed).includes(a.id));assert(!JSON.stringify(feed).includes(a.phone));assert(!JSON.stringify(feed).includes(current().object_key));
const firstKey=current().object_key;assert.equal((await avatars.POST(upload())).status,200);assert(!objects.has(firstKey));assert.equal(avatarCount(),1);
const secondKey=current().object_key;failPut=true;assert.equal((await avatars.POST(upload())).status,503);failPut=false;assert.equal(current().object_key,secondKey);assert(objects.has(secondKey));
// Two uploads starting from the same version cannot replace each other's work.
let release,entered;const enteredPromise=new Promise(r=>entered=r),normalPut=env.BUCKET.put;
env.BUCKET.put=async(key,bytes,meta)=>{entered();await new Promise(r=>release=r);return normalPut(key,bytes,meta)};
const first=avatars.POST(upload());await enteredPromise;env.BUCKET.put=normalPut;
assert.equal((await avatars.POST(upload())).status,200);const winnerKey=current().object_key;release();assert.equal((await first).status,409);assert.equal(current().object_key,winnerKey);assert.equal(avatarCount(),1);
assert.equal(sql.prepare('SELECT payload FROM challenges WHERE id=?').get(id).payload,originalPayload);assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(id).n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_interests WHERE challenge_id=?').get(id).n,1);
sql.prepare("UPDATE challenges SET status='draft' WHERE id=?").run(id);assert.equal((await avatars.GET(get(null,'challenge='+id))).status,404,'Unpublished challenge portrait becomes private');
assert.equal((await avatars.DELETE(remove(b))).status,200);assert.equal(current().object_key,winnerKey,'Other account can only clear its own portrait');
assert.equal((await avatars.DELETE(remove())).status,200);assert.equal(current().object_key,'');assert.equal(avatarCount(),0);assert.equal((await avatars.GET(get(a,'self=1'))).status,404);assert.equal((await (await bootstrap.GET(req(a))).json()).account.employee.avatarUrl,null);
assert.deepEqual(sql.prepare('PRAGMA foreign_key_check').all(),[]);sql.close();console.log('PASS: verified self-only avatars; image validation/size/CSRF; private drafts; public challenge portrait without account identifiers; replacement and removal; failed/concurrent writes; unchanged challenge/votes/interests.');
