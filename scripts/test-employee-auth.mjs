import assert from 'node:assert/strict';
import {sql,load,env,seedNetwork,seedEmployee,req,digest,phoneFor} from './test-fixture.mjs';
import {randomUUID} from 'node:crypto';
const auth=await load('app/api/employee-auth/route.ts'),admin=await load('app/api/participation/route.ts'),security=await load('lib/server/employee.ts'),challenges=await load('app/api/challenges/route.ts'),lib=await load('lib/challenges.ts');
const staff=seedEmployee('001'),other=seedEmployee('002');
assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('001')}))).status,503);
seedNetwork();
assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('001')}))).status,503);
env.RESEND_API_KEY='old-provider';env.MAIL_FROM='test@example.com';assert.equal(security.otpReady(),false);
env.BATHRA_OTP='test-not-a-key';assert.equal(security.otpReady(),true);
let mails=[],mailStatus=200,mailBody={success:true},verifyStatus=200,verifyBody={status:true},verificationCalls=0,balanceStatus=200,balanceCalls=0,balanceBody={success:true,data:{balance:10}},throwNetwork=false;
const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{
 assert.equal(options.headers['X-Authorization'],'test-not-a-key');assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'manual');
 if(throwNetwork)throw Error('private-provider-details');
 if(url.endsWith('/balance')){balanceCalls++;assert.equal(options.method,'GET');return Response.json(balanceBody,{status:balanceStatus});}
 assert.equal(options.method,'POST');const body=JSON.parse(options.body);
 if(url==='https://api.authentica.sa/api/v2/send-otp'){assert(['sms','whatsapp'].includes(body.method));assert.equal(body.email,undefined);assert.match(body.phone,/^\+9665\d{8}$/);assert.match(body.otp,/^\d{6}$/);mails.push(body);return Response.json(mailBody,{status:mailStatus});}
 assert.equal(url,'https://api.authentica.sa/api/v2/verify-otp');verificationCalls++;assert(mails.some(m=>m.phone===body.phone&&m.otp===body.otp));return Response.json(verifyBody,{status:verifyStatus});
};
const requestCode=async(number='001')=>{const r=await auth.POST(req(null,{action:'request',phone:phoneFor(number)}));assert.equal(r.status,202,await r.clone().text());const d=await r.json();return {id:d.id,code:mails.at(-1)?.otp};};
const first=await requestCode();assert.equal(mails.at(-1).phone,phoneFor('001'));assert(!JSON.stringify(first).includes('test-not-a-key'));
let row=sql.prepare('SELECT * FROM phone_otps WHERE id=?').get(first.id);assert.notEqual(row.digest,first.code);assert.equal(row.digest,digest(first.id+':'+first.code));
const n=mails.length;const absent=await requestCode('999');assert.equal(mails.length,n+1);assert(!sql.prepare('SELECT id FROM employees WHERE phone=?').get(phoneFor('999')));assert.equal((await auth.POST(req(null,{action:'verify',id:absent.id,code:absent.code==='000000'?'111111':'000000'}))).status,400);
const verified=await auth.POST(req(null,{action:'verify',...first},'POST',{ip:'198.51.100.20'}));assert.equal(verified.status,200);assert.equal(verificationCalls,1);const cookie=verified.headers.get('Set-Cookie');for(const part of ['__Host-badra-employee=','HttpOnly','Secure','SameSite=Lax','Path=/'])assert(cookie.includes(part));
const secret=cookie.split(';')[0].split('=')[1];assert.equal(secret.length,64);assert(sql.prepare('SELECT * FROM employee_sessions WHERE digest=?').get(digest(secret)));assert.equal((await auth.POST(req(null,{action:'verify',...first}))).status,400);
assert(sql.prepare('SELECT last_access_at FROM employees WHERE id=?').get(staff.id).last_access_at>0);
assert.equal(sql.prepare('SELECT signed_in FROM employees WHERE id=?').get(staff.id).signed_in,1,'Successful verification also records sign-in independently of the session.');
const signed={secret};let state=await (await auth.GET(req(signed))).json();assert.equal(state.employee.number,'001');assert(!JSON.stringify(state).includes('@test.local'));
// Same employee on a second device votes only once.
const second=await requestCode();const verified2=await auth.POST(req(null,{action:'verify',...second}));assert.equal(verified2.status,200);const device2={secret:verified2.headers.get('Set-Cookie').split(';')[0].split('=')[1]};
const added=await challenges.POST(req(other,{challenge:lib.exampleChallenges[0].challenge,submit:true}));const id=(await added.json()).id;assert(id);
for(const user of [signed,device2])assert.equal((await challenges.PATCH(req(user,{id,action:'vote',active:true},'PATCH'))).status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE challenge_id=?').get(id).n,1);
// Five failed attempts lock the code even when the next code is correct.
const lock=await requestCode('002');const bad=lock.code==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal((await auth.POST(req(null,{action:'verify',id:lock.id,code:bad}))).status,400);assert.equal((await auth.POST(req(null,{action:'verify',...lock}))).status,400);
const expired=await requestCode('002');sql.prepare('UPDATE phone_otps SET expires_at=? WHERE id=?').run(Date.now()-1,expired.id);assert.equal((await auth.POST(req(null,{action:'verify',...expired}))).status,400);
const superseded=await requestCode('002');await requestCode('002');assert.equal((await auth.POST(req(null,{action:'verify',...superseded}))).status,400);
await requestCode('002');assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('002')}))).status,429);
assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('001')},'POST',{origin:'https://evil.test'}))).status,403);
const logout=await auth.POST(req(device2,{action:'logout'}));assert.equal(logout.status,200);assert(logout.headers.get('Set-Cookie').includes('Max-Age=0'));assert.equal((await (await auth.GET(req(device2))).json()).employee,null);
assert.equal((await admin.GET(req(staff))).status,403);
const newStaff={number:'003',phone:'0500000003',name:'موظف ثالث',email:'third@test.local',department:'التشغيل'};
assert.equal((await admin.POST(req('manager',{action:'import',employees:[newStaff]}))).status,200);
assert.equal((await admin.POST(req('manager',{action:'import',employees:[newStaff]}))).status,409);
assert.equal((await admin.POST(req('manager',{action:'import',employees:[{...newStaff,number:'004',email:'fourth@test.local'},{...newStaff,number:'004',email:'fourth@test.local'}]}))).status,400);
assert.equal((await admin.POST(req('manager',{action:'active',id:staff.id,active:false}))).status,200);
assert.equal((await (await auth.GET(req(signed))).json()).employee,null);assert.equal((await challenges.PATCH(req(signed,{id,action:'vote',active:false},'PATCH'))).status,401);
assert.equal((await admin.POST(req('manager',{action:'active',id:staff.id,active:true}))).status,200);
assert.equal((await (await auth.GET(req(signed))).json()).employee,null);
assert.equal((await admin.POST(req('manager',{action:'update',id:staff.id,phone:staff.phone,name:'اسم محدث',email:'updated@test.local',department:'التقنية'}))).status,200);
assert.equal(sql.prepare('SELECT number FROM employees WHERE id=?').get(staff.id).number,'001');
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE user_id=?').get('employee:'+staff.id).n,1);
assert.equal((await admin.POST(req('manager',{action:'update',id:staff.id,phone:staff.phone,name:'اسم محدث',email:'002@test.local',department:'التقنية'}))).status,409);
mailStatus=503;assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('003')}))).status,503);
assert.equal(sql.prepare('SELECT used FROM phone_otps WHERE phone=(SELECT phone FROM employees WHERE number=?)').get('003').used,1);
assert(sql.prepare('SELECT COUNT(*) n FROM security_audit').get().n>=3);
// A correct local code must never create a session without provider confirmation.
seedEmployee('005');mailStatus=200;
for(const [status,body,expected] of [[200,{status:false},400],[200,{status:'true'},503],[200,{},503],[401,{message:'private-provider-details'},503],[429,{},503],[503,{},503]]){
 sql.prepare('DELETE FROM auth_limits').run();const challenge=await requestCode('005');verifyStatus=status;verifyBody=body;
 const before=sql.prepare('SELECT COUNT(*) n FROM employee_sessions').get().n;
 const response=await auth.POST(req(null,{action:'verify',...challenge}));assert.equal(response.status,expected);assert.equal(response.headers.get('Set-Cookie'),null);assert(!(await response.text()).includes('private-provider-details'));assert.equal(sql.prepare('SELECT COUNT(*) n FROM employee_sessions').get().n,before);
}
verifyStatus=200;verifyBody={status:true};
// HTTP success with an unsuccessful/malformed provider payload still invalidates the OTP.
for(const body of [{success:false},{success:'true'},null,{}]){
 sql.prepare('DELETE FROM auth_limits').run();mailStatus=200;mailBody=body;
 assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('005')}))).status,503);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM phone_otps WHERE phone=(SELECT phone FROM employees WHERE number=?) AND used=0').get('005').n,0);
}
mailBody={success:true};throwNetwork=true;assert.equal((await auth.POST(req(null,{action:'request',phone:phoneFor('005')}))).status,503);throwNetwork=false;
assert.equal((await admin.POST(req(staff,{action:'check-otp'}))).status,403);assert.equal(balanceCalls,0);
assert.equal((await admin.POST(req('manager',{action:'check-otp'}))).status,200);assert.equal(balanceCalls,1);
balanceBody={success:true,data:{balance:0}};const noCredit=await admin.POST(req('manager',{action:'check-otp'}));assert.equal(noCredit.status,200);assert((await noCredit.json()).message.includes('الرصيد'));
balanceStatus=401;const denied=await admin.POST(req('manager',{action:'check-otp'}));assert.equal(denied.status,503);assert(!(await denied.text()).includes('test-not-a-key'));
assert.equal((await admin.POST(req('manager',{action:'check-otp'}))).status,429);
// Channel is an admin policy; clients cannot switch it or provide another recipient.
sql.prepare('DELETE FROM auth_limits').run();balanceStatus=200;
const phones=await load('lib/phone.ts');
for(const value of ['0500000001','500000001','966500000001','+966500000001','00966500000001','٠٥٠٠٠٠٠٠٠١','+966 (50) 000-0001'])assert.equal(phones.normalizePhone(value),staff.phone);
for(const value of ['001','+966123456789','050000000','+966500000001x','test@example.com'])assert.equal(phones.normalizePhone(value),'');
assert.equal((await auth.POST(req(null,{action:'request',phone:'001'}))).status,400);
assert.equal((await auth.POST(req(null,{action:'request',number:'001'}))).status,400);
assert.equal((await admin.POST(req(staff,{action:'otp-channel',channel:'whatsapp',revision:1}))).status,403);
assert.equal((await admin.POST(req('manager',{action:'otp-channel',channel:'email',revision:1}))).status,400);
assert.equal((await admin.POST(req('manager',{action:'otp-channel',channel:'whatsapp',revision:0}))).status,200);
assert.equal((await admin.POST(req('manager',{action:'otp-channel',channel:'sms',revision:0}))).status,409);
assert.equal((await (await auth.GET(req(null))).json()).channel,'whatsapp');
const wa=await requestCode('005');assert.equal(mails.at(-1).method,'whatsapp');assert.equal((await auth.POST(req(null,{action:'verify',...wa}))).status,200);
assert.equal((await admin.POST(req('manager',{action:'otp-channel',channel:'sms',revision:1}))).status,200);
const sms=await requestCode('005');assert.equal(mails.at(-1).method,'sms');assert.equal((await auth.POST(req(null,{action:'verify',...sms}))).status,200);
const duplicate={number:'006',name:'موظف سادس',email:'sixth@test.local',department:'التقنية',phone:'٠٥٠٠٠٠٠٠٠١'};
assert.equal((await admin.POST(req('manager',{action:'import',employees:[duplicate]}))).status,409);
assert.equal((await admin.POST(req('manager',{action:'update',id:staff.id,phone:other.phone,name:'اسم محدث',email:'updated@test.local',department:'التقنية'}))).status,409);
// A phone change revokes outstanding OTPs and sessions without changing voting identity.
sql.prepare('DELETE FROM auth_limits').run();const pending=await requestCode();
const oldVotes=sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE user_id=?').get('employee:'+staff.id).n;
const changedPhone='+966511111111';
assert.equal((await admin.POST(req('manager',{action:'update',id:staff.id,phone:changedPhone,name:'اسم محدث',email:'updated@test.local',department:'التقنية'}))).status,200);
assert.equal((await auth.POST(req(null,{action:'verify',...pending}))).status,400);
const beforeOld=mails.length;await requestCode();assert.equal(mails.length,beforeOld+1);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenge_votes WHERE user_id=?').get('employee:'+staff.id).n,oldVotes);
assert.equal(sql.prepare('SELECT number FROM employees WHERE id=?').get(staff.id).number,'001');
// A new phone can register independently; it does not claim an unrelated legacy record.
const legacy=seedEmployee('007');sql.prepare('UPDATE employees SET phone=NULL WHERE id=?').run(legacy.id);
const beforeLegacy=mails.length;await requestCode('007');assert.equal(mails.length,beforeLegacy+1);
assert.equal((await admin.POST(req('manager',{action:'update',id:legacy.id,phone:legacy.phone,name:'موظف سابق',email:'007@test.local',department:'التقنية'}))).status,200);
await requestCode('007');assert.equal(mails.length,beforeLegacy+2);
// All accepted representations share one rate limit.
sql.prepare('DELETE FROM auth_limits').run();for(let i=0;i<5;i++)await requestCode('005');
assert.equal((await auth.POST(req(null,{action:'request',phone:'٠٥٠٠٠٠٠٠٠٥'}))).status,429);
// Historical network settings do not restrict requests; neither do missing IP metadata.
sql.prepare('DELETE FROM auth_limits').run();
let sequence=900;
for(const ip of ['198.51.100.1','','2a06:98c0:3600::103','2001:db9::1']){
 const response=await auth.POST(req(null,{action:'request',phone:phoneFor(String(sequence++))},'POST',{ip}));assert.equal(response.status,202);
}
assert.equal((await admin.POST(req('manager',{action:'networks',networks:['203.0.113.1'],revision:2}))).status,400,'Retired network configuration cannot be re-enabled');
const publicState=await (await auth.GET(req(null))).json();assert.equal(publicState.network,undefined);
const settings=await (await admin.GET(req('manager'))).json();assert.equal(settings.networks,undefined);assert.equal(settings.observedIp,undefined);
globalThis.fetch=originalFetch;sql.close();console.log('PASS: OTP configuration; network-independent access; OTP SMS/WhatsApp, expiry, replay, rate limits; session cookies/logout; cross-device unique vote; revocation; admin-only participant/channel settings; phone uniqueness/normalization/change revocation; safe provider failure.');
