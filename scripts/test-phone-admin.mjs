import assert from 'node:assert/strict';
import {sql,load,env,req,seedEmployee} from './test-fixture.mjs';
const auth=await load('app/api/employee-auth/route.ts'),access=await load('lib/server/access.ts'),admin=await load('app/api/participation/route.ts'),challenges=await load('app/api/challenges/route.ts'),workshop=await load('app/api/workshop/route.ts'),lib=await load('lib/challenges.ts');
const managerPhones=['+966599999901','+966599999902','+966599999903'],other=seedEmployee('601');
const oldFetch=globalThis.fetch;let otp='';env.BATHRA_OTP='test-only';
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/send-otp')){otp=body.otp;return Response.json({success:true});}return Response.json({status:true});};
try{
 for(const phone of managerPhones){
 const spoof=req(null,undefined,'GET',{headers:{'oai-authenticated-user-id':'legacy-manager','oai-authenticated-user-email':'manager@test.local','x-phone':phone}});
 sql.prepare("INSERT OR IGNORE INTO workshop_members(email,role) VALUES(?,'manager')").run('manager@test.local');
 assert.equal((await access.viewer(spoof)).manager,false);assert.equal((await admin.GET(spoof)).status,403);
 assert.equal((await access.viewer(req(other,undefined,'GET',{headers:{'x-phone':phone}}))).manager,false);
 assert.equal((await admin.GET(req(other))).status,403);
 const started=await auth.POST(req(null,{action:'request',phone:'0'+phone.slice(4)}));assert.equal(started.status,202);const id=(await started.json()).id;
 assert.equal((await access.viewer(req(null))).manager,false,'Requesting an OTP is not authentication');
 const verified=await auth.POST(req(null,{action:'verify',id,code:otp}));assert.equal(verified.status,200);
 const manager={secret:verified.headers.get('Set-Cookie').split(';')[0].split('=')[1]};
 assert.equal((await admin.GET(req(manager))).status,403,'Profile completion is required');
 await auth.POST(req(manager,{action:'complete-profile',department:'إدارة الاختبار',roles:['innovator','developer'],name:'مدير الاختبار'}));
 assert.equal((await access.viewer(req(manager))).manager,true);assert.equal((await admin.GET(req(manager))).status,200);
 const body={...lib.exampleChallenges[0].challenge,ownership:'shared',coOwners:'فريق تجربة البطاقة',initialSolutionStatus:'implemented',initialSolution:'نفذنا سجلًا تجريبيًا يجمع التكليفات في مكان واحد.',initialSolutionOutcome:'تحسن وضوح التكليفات لكن لا تزال تحديثات الحالة يدوية.'};
 const added=await challenges.POST(req(other,{challenge:body,submit:true}));assert.equal(added.status,200);const challengeId=(await added.json()).id;
 assert.equal(sql.prepare('SELECT status FROM challenges WHERE id=?').get(challengeId).status,'published');
 const managerData=await (await challenges.GET(req(manager))).json();assert.equal(managerData.viewer.manager,true);assert.equal(managerData.entries.find(e=>e.id===challengeId).votes,0,'Both authorization paths recognize each approved manager');
 const publicData=await (await challenges.GET(req(null))).json();const card=publicData.entries.find(e=>e.id===challengeId).challenge;
 for(const key of ['coOwners','ownership','initialSolutionStatus','initialSolution','initialSolutionOutcome'])assert.equal(card[key],body[key]);
 assert(lib.challengeBrief(card).includes(body.coOwners));assert(lib.challengeBrief(card).includes(body.initialSolution));assert(!JSON.stringify(publicData).includes(phone));
 assert.equal((await challenges.POST(req(other,{challenge:{...body,coOwners:''},submit:true}))).status,400);
 assert.equal((await challenges.POST(req(other,{challenge:{...body,initialSolution:''},submit:true}))).status,400);
 const state=await (await workshop.GET(req(manager))).json();assert.equal((await workshop.POST(req(manager,{action:'pause',revision:state.revision}))).status,200);
 const account=sql.prepare('SELECT id FROM employees WHERE phone=?').get(phone);
 sql.prepare('UPDATE employees SET active=0 WHERE id=?').run(account.id);assert.equal((await access.viewer(req(manager))).manager,false);assert.equal((await admin.GET(req(manager))).status,403);
 sql.prepare('UPDATE employees SET active=1 WHERE id=?').run(account.id);sql.prepare('UPDATE employee_sessions SET expires_at=0 WHERE employee_id=?').run(account.id);assert.equal((await access.viewer(req(manager))).manager,false);
 }
}finally{globalThis.fetch=oldFetch;sql.close();}
console.log('PASS: all approved manager accounts require their verified configured phones, active profile and valid session; legacy headers/roles denied; shared ownership and prior experiment retained publicly without phone exposure.');
