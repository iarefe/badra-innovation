import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,sql,req,seedEmployee,env} from './test-fixture.mjs';

const api=await load('app/api/faq-inquiries/route.ts');
const employee=seedEmployee('faq-visitor');
const question='هل يمكن المشاركة في الفريق بدورين مختلفين؟';
const payload=(text=question)=>({id:randomUUID(),question:text});
const count=()=>sql.prepare('SELECT COUNT(*) n FROM faq_inquiries').get().n;
const first=payload(),response=await api.POST(req(null,first));
assert.equal(response.status,201);assert.deepEqual(await response.json(),{ok:true});
assert.match(response.headers.get('cache-control'),/no-store/);
assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
assert.equal(count(),1);assert.equal(sql.prepare('SELECT sender_id FROM faq_inquiries').get().sender_id,null);
// A lost response can be retried even if its visitor cookie was never received.
assert.equal((await api.POST(req(null,first))).status,200);assert.equal(count(),1);
assert.equal((await api.POST(req(null,{...first,question:'سؤال مختلف بنفس رقم الطلب'}))).status,409);
assert.equal(count(),1);
const author=payload();assert.equal((await api.POST(req(employee,author))).status,201);
assert.equal(sql.prepare('SELECT sender_id FROM faq_inquiries WHERE id=?').get(author.id).sender_id,employee.id);
assert.equal((await api.POST(req(null,{...payload(),senderId:employee.id}))).status,400,'No client-supplied identity');
for(const visitor of [null,employee]){
 assert.equal((await api.GET(req(visitor))).status,403);
 assert.equal((await api.PATCH(req(visitor,{id:first.id},'PATCH'))).status,403);
}
assert.equal((await api.GET(req(null,null,'GET',{headers:{'oai-authenticated-user-email':'manager@test.local','x-role':'admin'}}))).status,403);
for(const bad of ['', '   ', 'قصير'.slice(0,3),'س'.repeat(2001)])assert.equal((await api.POST(req(null,payload(bad)))).status,400);
assert.equal((await api.POST(req(null,payload('س'.repeat(8100))))).status,413);
const malformed=new Request('https://site.test/api/faq-inquiries',{method:'POST',headers:{origin:'https://site.test'},body:'{bad'});
assert.equal((await api.POST(malformed)).status,400);
assert.equal((await api.POST(req(null,payload(), 'POST',{origin:'https://other.test'}))).status,403);
assert.equal((await api.POST(req(null,payload(), 'POST',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
assert.equal((await api.PATCH(req('manager',{id:first.id},'PATCH',{origin:'https://other.test'}))).status,403);
let inbox=await(await api.GET(req('manager'))).json();assert.equal(inbox.total,2);assert.equal(inbox.unread,2);
assert(inbox.inquiries.some(q=>q.senderName===null));assert(inbox.inquiries.some(q=>q.senderName==='موظف الاختبار faq-visitor'));
assert(inbox.inquiries.every(q=>Object.keys(q).sort().join()===['id','question','senderName','createdAt','readAt'].sort().join()));
const read=await api.PATCH(req('manager',{id:first.id},'PATCH'));assert.equal(read.status,200);const readAt=(await read.json()).readAt;assert(readAt>0);
assert.equal((await(await api.PATCH(req('manager',{id:first.id},'PATCH'))).json()).readAt,readAt);
assert.equal((await api.PATCH(req('manager',{id:randomUUID()},'PATCH'))).status,404);
inbox=await(await api.GET(req('manager'))).json();assert.equal(inbox.unread,1);
const cookie=response.headers.get('set-cookie').split(';')[0],guestOptions={headers:{cookie}};
for(let i=0;i<2;i++)assert.equal((await api.POST(req(null,payload(), 'POST',guestOptions))).status,201);
assert.equal((await api.POST(req(null,payload(), 'POST',guestOptions))).status,429,'Per visitor limit');
assert.equal((await api.POST(req(null,first, 'POST',guestOptions))).status,200,'Retry does not consume limits');
// Same office network still permits another colleague to submit.
assert.equal((await api.POST(req(seedEmployee('faq-colleague'),payload()))).status,201);
const failedId=payload(),prepare=env.DB.prepare;
env.DB.prepare=query=>{if(query.startsWith('INSERT INTO faq_inquiries'))throw Error('private database detail');return prepare(query)};
const failure=await api.POST(req(null,failedId));assert.equal(failure.status,500);assert(!JSON.stringify(await failure.json()).includes('private database detail'));
env.DB.prepare=prepare;assert.equal((await api.POST(req(null,failedId))).status,201);
const storedBefore=count();for(let i=0;i<22;i++)sql.prepare('INSERT INTO faq_inquiries(id,question,created_at) VALUES(?,?,?)').run(randomUUID(),'سؤال أرشيفي للاختبار '+i,i+1);
const pageRequest=page=>{const r=req('manager');return new Request('https://site.test/api/faq-inquiries?page='+page,{headers:r.headers})};
const one=await(await api.GET(pageRequest(1))).json(),two=await(await api.GET(pageRequest(2))).json();
assert.equal(one.total,storedBefore+22);assert.equal(one.inquiries.length,20);assert.equal(two.inquiries.length,one.total-20);
assert(!two.inquiries.some(q=>one.inquiries.some(a=>a.id===q.id)));assert.equal((await api.GET(pageRequest(0))).status,400);
assert.equal((await(await api.GET(pageRequest(999))).json()).page,2);
console.log('PASS: durable visitor and employee submissions, server-owned identity, validation, origin protection, private manager inbox, idempotent retry/read, rate limits, database failure recovery and pagination.');
sql.close();
