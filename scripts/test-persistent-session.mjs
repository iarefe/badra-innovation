import assert from 'node:assert/strict';
import {sql,load,env,seedEmployee,req,digest,phoneFor} from './test-fixture.mjs';
const originalNow=Date.now,originalFetch=globalThis.fetch;
let clock=Date.now(),lastCode='';Date.now=()=>clock;
const day=86400000,ttl=30*day;
const auth=await load('app/api/employee-auth/route.ts'),admin=await load('app/api/participation/route.ts'),challenges=await load('app/api/challenges/route.ts'),security=await load('lib/server/employee.ts');
env.BATHRA_OTP='test-only';
globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/send-otp')){lastCode=body.otp;return Response.json({success:true})}assert(url.endsWith('/verify-otp'));assert.equal(body.otp,lastCode);return Response.json({status:true})};
const expiry=user=>sql.prepare('SELECT expires_at FROM employee_sessions WHERE digest=?').get(digest(user.secret))?.expires_at;
const login=async(phone)=>{
 const requested=await auth.POST(req(null,{action:'request',phone}));assert.equal(requested.status,202);const {id}=await requested.json();
 const verified=await auth.POST(req(null,{action:'verify',id,code:lastCode}));assert.equal(verified.status,200);
 const cookie=verified.headers.get('Set-Cookie');for(const flag of ['Max-Age=2592000','Expires=','HttpOnly','Secure','SameSite=Lax','Path=/'])assert(cookie.includes(flag));
 const secret=cookie.split(';')[0].split('=')[1];assert.equal(expiry({secret}),clock+ttl);return {secret};
};
const staff=seedEmployee('001');
// Existing short sessions are upgraded when the user returns, without another OTP.
const legacy=await auth.GET(req(staff));assert.equal(legacy.status,200);assert(legacy.headers.get('Set-Cookie').includes('Max-Age=2592000'));assert.equal(expiry(staff),clock+ttl);
const deviceA=await login(staff.phone),deviceB=await login(staff.phone);assert.notEqual(deviceA.secret,deviceB.secret);
const initial=expiry(deviceA);clock+=9*3600000;
let response=await auth.GET(req(deviceA));assert.equal((await response.json()).employee.number,'001');assert.equal(expiry(deviceA),initial);assert.equal(response.headers.get('Set-Cookie'),null,'No repeated writes/cookies within a day');
clock+=2*day;response=await auth.GET(req(deviceA));assert.equal((await response.json()).employee.name,'موظف الاختبار 001');assert.equal(expiry(deviceA),clock+ttl);assert(response.headers.get('Set-Cookie').includes('Max-Age=2592000'));
const browserExpiry=response.headers.get('Set-Cookie').match(/Expires=([^;]+)/)[1];assert.equal(Date.parse(browserExpiry),Math.floor((clock+ttl)/1000)*1000);
// Ordinary authenticated browsing renews the session, not only the account page.
clock+=2*day;response=await challenges.GET(req(deviceA));assert.equal((await response.json()).viewer.employee,true);assert.equal(expiry(deviceA),clock+ttl);assert(response.headers.get('Set-Cookie').includes('__Host-badra-employee='+deviceA.secret));
const logout=await auth.POST(req(deviceA,{action:'logout'}));assert.equal(logout.status,200);assert(logout.headers.get('Set-Cookie').includes('Max-Age=0'));assert(logout.headers.get('Set-Cookie').includes('Expires=Thu, 01 Jan 1970'));
assert.equal(expiry(deviceA),undefined);assert.equal((await (await auth.GET(req(deviceA))).json()).employee,null);
assert.equal((await (await auth.GET(req(deviceB))).json()).employee.number,'001','Logout is limited to this device');
const late=await security.renewEmployeeSession(req(deviceA),Response.json({ok:true}));assert.equal(late.headers.get('Set-Cookie'),null);assert.equal(expiry(deviceA),undefined,'A concurrent renewal cannot resurrect logout');
const replacement=await login(staff.phone);await admin.POST(req('manager',{action:'active',id:staff.id,active:false}));
for(const session of [deviceB,replacement]){assert.equal((await (await auth.GET(req(session))).json()).employee,null);assert.equal(expiry(session),undefined);}
await admin.POST(req('manager',{action:'active',id:staff.id,active:true}));assert.equal((await (await auth.GET(req(replacement))).json()).employee,null,'Reactivation never restores revoked sessions');
// After 30 days without activity the session expires; old cookies cannot renew it.
const dormant=await login(staff.phone);clock+=ttl+1;
response=await auth.GET(req(dormant));assert.equal((await response.json()).employee,null);assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(expiry(dormant),clock-1);
response=await security.renewEmployeeSession(req(dormant),Response.json({ok:true}));assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(expiry(dormant),clock-1);
const forged={secret:'a'.repeat(64)};assert.equal((await (await auth.GET(req(forged))).json()).employee,null);
// Verified newcomers retain the name-completion screen across a later visit.
const newcomer=await login(phoneFor('003'));clock+=2*day;response=await auth.GET(req(newcomer));const pending=await response.json();assert.equal(pending.employee,null);assert.equal(pending.pendingProfile.phone,phoneFor('003'));assert.equal(expiry(newcomer),clock+ttl);
assert.equal((await auth.POST(req(newcomer,{action:'complete-profile',department:'إدارة الاختبار',roles:['innovator','developer'],name:'مشارك مستمر'}))).status,200);assert.equal((await (await auth.GET(req(newcomer))).json()).employee.name,'مشارك مستمر');
Date.now=originalNow;globalThis.fetch=originalFetch;sql.close();console.log('PASS: persistent 30-day cookies and server expiry; legacy session upgrade; return after 8 hours; daily sliding renewal on normal browsing; device-scoped logout; revoked/expired sessions never revive; remembered pending profile.');
