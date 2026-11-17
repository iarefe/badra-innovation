import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,sql,seedEmployee,req,env} from './test-fixture.mjs';
const [api,{exampleChallenges}]=await Promise.all([load('app/api/challenge-revision/route.ts'),load('lib/challenges.ts')]);
const owner=seedEmployee('49842'),peer=seedEmployee('49843'),id=randomUUID();
const card={...exampleChallenges[0].challenge,title:'تعثر متابعة قرارات الاجتماعات الداخلية',frequency:'سنويًا',author:'صاحب البطاقة',ownership:'shared',coOwners:'شريك خاص',initialSolutionStatus:'none',need:'',evidence:'نعود إلى محضر الاجتماع في كل متابعة.'};
const original={...card,legacyExtra:'يبقى محفوظًا'};
sql.prepare('INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,'employee:'+owner.id,JSON.stringify(original),'published',1,2,3);
sql.prepare('INSERT INTO challenge_votes(challenge_id,user_id) VALUES(?,?)').run(id,'employee:'+peer.id);
sql.prepare('INSERT INTO challenge_interests(challenge_id,employee_id,created_at) VALUES(?,?,?)').run(id,peer.id,2);
const dbCard=()=>sql.prepare('SELECT * FROM challenges WHERE id=?').get(id);
const get=(v,cardId=id)=>{const base=req(v);return api.GET(new Request('https://site.test/api/challenge-revision?id='+cardId,{headers:base.headers}))};
const patch=(v,version,fields,other={},cardId=id)=>api.PATCH(req(v,{id:cardId,version,fields,...other},'PATCH'));
const review=(v,version,fields={},clarification='')=>api.POST(req(v,{id,version,fields,clarification}));
assert.equal((await get()).status,401);assert.equal((await get(peer)).status,403);
const before=await (await get(owner)).json();assert.equal(before.version,3);assert.equal(before.challenge.author,card.author);
assert.equal((await get('manager')).status,200);
assert.equal((await review(peer,3)).status,403);assert.equal((await patch(peer,3,{title:'تحدي زميل آخر'})).status,403);
assert.equal((await patch(owner,3,{author:'انتحال الاسم'})).status,400);
assert.equal((await patch(owner,3,{domain:'قيمة غير موجودة'})).status,400);
assert.equal((await patch(owner,3,{initialSolutionStatus:'implemented'})).status,400);
assert.equal((await patch(owner,3,{title:'قصير'})).status,400);
assert.equal((await api.PATCH(req(owner,{id,version:3,fields:{title:'وصف معدّل للتحدي'}},'PATCH',{origin:'https://other.test'}))).status,403);
const fallback=await (await review(owner,3)).json();assert.equal(fallback.review.source,'guide');assert(fallback.review.findings.some(x=>x.field==='need'));assert.equal(dbCard().payload,JSON.stringify(original));
env.OPENAI_API_KEY='test-fixture-only';
const nativeFetch=globalThis.fetch;let sent,n=0;
globalThis.fetch=async(url,init)=>{
 n++;assert.equal(String(url),'https://api.openai.com/v1/responses');sent=JSON.parse(init.body);const body={summary:'توضح البطاقة موضع التعطّل، وتحتاج إلى وصف أثره.',strengths:['يوجد موقف مرتبط بالعمل.'],findings:[
 {field:'title',reason:'العنوان يصف التحدي ويمكن اختصاره.',proposal:'صعوبة متابعة قرارات الاجتماع الداخلي',question:''},
 {field:'impact',reason:'لا يوجد رقم يثبت هذا التقدير.',proposal:'يتأخر العمل 493 يومًا.',question:''},
 {field:'need',reason:'لم يتضح ما يحاول الموظف إنجازه.',proposal:'',question:'ما الذي يريد الموظف حسمه عند الرجوع إلى المحضر؟'}
 ]};return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(body)}]}]});
};
try{
 const result=await review(owner,3,{},'يتأخر الوصول إلى محضر الاجتماع. للتجربة: 0500000000');assert.equal(result.status,200);const {review:r}=await result.json();assert.equal(r.source,'ai');assert.equal(n,1);
 assert.equal(sent.store,false);assert(!sent.input.includes('0500000000')&&!sent.input.includes(card.author)&&!sent.input.includes(card.coOwners)&&!sent.input.includes(id));
 assert.equal(r.findings[0].proposal,'صعوبة متابعة قرارات الاجتماع الداخلي');assert.equal(r.findings[1].proposal,'');assert(r.findings[1].question);assert(r.findings[2].question);
 assert.equal(dbCard().payload,JSON.stringify(original),'AI suggestions are advisory; no mutation');
 const saved=await patch(owner,3,{title:r.findings[0].proposal});assert.equal(saved.status,200);const latest=await saved.json();
 assert(latest.version>3);assert.equal(dbCard().published_at,2);assert.equal(dbCard().status,'published');
 assert.equal(JSON.parse(dbCard().payload).legacyExtra,'يبقى محفوظًا');assert.equal(JSON.parse(dbCard().payload).need,'','Unrelated incomplete legacy fields must not block an edit');
 assert.equal((await patch(owner,3,{title:'تعديل قديم يجب عدم حفظه'})).status,409);assert.equal((await review(owner,3)).status,409);
 const byManager=await patch('manager',latest.version,{ownership:'individual'});assert.equal(byManager.status,200);
 const data=await byManager.json();assert.equal(data.challenge.coOwners,'');assert.equal(data.challenge.author,card.author);assert.equal(dbCard().owner,'employee:'+owner.id);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(id).n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_interests WHERE challenge_id=?').get(id).n,1);assert.equal(sql.prepare('SELECT COUNT(*) n FROM security_audit WHERE action LIKE ?').get('%'+id).n,2);
 sql.prepare('INSERT OR REPLACE INTO workshop_settings(id,title,count,open,finalized,revision) VALUES(1,?,3,0,1,1)').run('الورشة');
 for(const actor of [owner,'manager']){assert.equal((await review(actor,data.version)).status,409);assert.equal((await patch(actor,data.version,{title:'عنوان بعد الاعتماد'})).status,409)}
 assert.equal(n,1,'Unauthorized, stale or locked cards never call the model');
 const draftId=randomUUID();sql.prepare('INSERT INTO challenges(id,owner,payload,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(draftId,'employee:'+owner.id,JSON.stringify(original),'draft',1,2);
 assert.equal((await get(peer,draftId)).status,403);const res=await patch(owner,2,{title:'تعديل محفوظ في المسودة فقط'}, {},draftId);assert.equal(res.status,200);assert.equal((await res.json()).status,'draft');
}finally{globalThis.fetch=nativeFetch;delete env.OPENAI_API_KEY;sql.close()}
console.log('PASS: owner/admin revisions, private drafts, consent-only saves, stale/finalized locks, preserved engagement/identity/publication, grounded AI and manual fallback.');
