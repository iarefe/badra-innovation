import assert from 'node:assert/strict';
import {sql,load,env,req,phoneFor} from './test-fixture.mjs';

const auth=await load('app/api/employee-auth/route.ts');
const admin=await load('app/api/participation/route.ts');
const provider=await load('lib/server/otp-provider.ts');
const originalFetch=globalThis.fetch,originalError=console.error;
const logs=[];console.error=(...args)=>logs.push(args.join(' '));
env.BATHRA_OTP='private-key-sentinel';
const phone=phoneFor('810');let code='';
try{
 for(const [status,body,reason] of [
  [401,{message:'private-provider-sentinel'},'unauthorized'],
  [403,{},'forbidden'],
  [429,{},'rate_limited'],
  [422,{errors:{phone:[phone]}},'invalid_phone'],
  [422,{errors:{method:['private-provider-sentinel']}},'invalid_channel'],
  [422,{errors:{template_id:['private-provider-sentinel']}},'invalid_template'],
  [422,{errors:{sender_name:['private-provider-sentinel']}},'invalid_sender'],
  [400,{message:'Insufficient balance'},'insufficient_balance'],
  [422,{message:'private-provider-sentinel'},'request_rejected'],
  [503,{message:'private-provider-sentinel'},'upstream_error'],
  [200,{success:false,message:'private-provider-sentinel'},'delivery_not_confirmed'],
  [200,null,'invalid_response']
 ]){
  sql.prepare('DELETE FROM auth_limits').run();logs.length=0;
  globalThis.fetch=async(_url,options)=>{code=JSON.parse(options.body).otp;return body===null?new Response('private-provider-sentinel'):Response.json(body,{status});};
  const response=await auth.POST(req(null,{action:'request',phone}));
  assert.equal(response.status,503);const payload=await response.json();
  assert.equal(logs.length,1);const log=JSON.parse(logs[0]);
  assert.equal(log.reason,reason);assert.equal(log.httpStatus,status);assert.equal(log.operation,'send');
  assert.match(log.reference,/^[a-f0-9-]{36}$/);assert(payload.error.includes(log.reference));
  const output=JSON.stringify({payload,logs});
  for(const secret of [phone,code,'private-key-sentinel','private-provider-sentinel'])assert(!output.includes(secret),'Sensitive values must not appear in messages or logs');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM phone_otps WHERE used=0').get().n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM employee_sessions').get().n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM employees').get().n,0);
 }
 for(const [name,reason] of [['TimeoutError','timeout'],['Error','connection_failed']]){
  logs.length=0;globalThis.fetch=async()=>{const e=new Error('private-key-sentinel');e.name=name;throw e;};
  await assert.rejects(provider.sendOtp(phone,'123456','sms'),e=>{assert.equal(e.reason,reason);assert(!e.message.includes('private-key-sentinel'));return true;});
  assert.equal(JSON.parse(logs[0]).httpStatus,null);assert(!logs.join('').includes('private-key-sentinel'));
 }
 // Admin diagnostics retain actionable information; anonymous visitors cannot run them.
 logs.length=0;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({message:'private-key-sentinel'},{status:401});};
 assert.equal((await admin.POST(req(null,{action:'check-otp'}))).status,403);assert.equal(calls,0);
 const adminResult=await admin.POST(req('manager',{action:'check-otp'}));assert.equal(adminResult.status,503);
 const adminMessage=(await adminResult.json()).error;assert(adminMessage.includes('BATHRA_OTP'));assert(adminMessage.includes(JSON.parse(logs[0]).reference));assert(!adminMessage.includes('private-key-sentinel'));
 // Successful send and rejected verification do not create error logs or expose codes.
 logs.length=0;globalThis.fetch=async(url)=>Response.json(url.endsWith('/send-otp')?{success:true}:{status:false});
 await provider.sendOtp(phone,'123456','whatsapp');assert.equal(await provider.verifyOtp(phone,'123456'),false);assert.equal(logs.length,0);
}finally{globalThis.fetch=originalFetch;console.error=originalError;sql.close();}
console.log('PASS: safe OTP diagnostics, correlated failure references, actionable admin check, no sensitive logs, no account/session after delivery failure.');
