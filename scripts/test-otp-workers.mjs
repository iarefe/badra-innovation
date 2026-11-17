import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const runtimeRequire=createRequire(require.resolve('wrangler/package.json'));
const {build}=runtimeRequire('esbuild');
const {Miniflare,Response:WorkerResponse}=runtimeRequire('miniflare');

// Run the real provider in workerd; Node's fetch mocks cannot catch unsupported
// Workers Request options. All outbound calls are handled locally with fake data.
const bundled=await build({stdin:{contents:`
 import {sendOtp,verifyOtp,checkOtpConnection} from './lib/server/otp-provider';
 export default {async fetch(request){
  try{
   const operation=new URL(request.url).pathname;
   if(operation==='/verify')return Response.json({valid:await verifyOtp('+966500000001','123456')});
   if(operation==='/balance')return Response.json({message:await checkOtpConnection()});
   await sendOtp('+966500000001','123456',operation==='/whatsapp'?'whatsapp':'sms');
   return Response.json({sent:true});
  }catch(error){return Response.json({reason:error.reason,message:error.message},{status:503});}
 }};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:workers']});
let outboundStatus=200,calls=[];
const runtime=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-05-15',bindings:{BATHRA_OTP:'runtime-test-key'},outboundService:async request=>{
 const url=new URL(request.url);assert.equal(url.origin,'https://api.authentica.sa');
 assert.equal(request.headers.get('X-Authorization'),'runtime-test-key');
 const body=request.method==='POST'?await request.json():null;calls.push({path:url.pathname,body});
 if(outboundStatus>=300&&outboundStatus<400)return new WorkerResponse(null,{status:outboundStatus,headers:{Location:'https://untrusted.test/capture'}});
 return WorkerResponse.json(url.pathname.endsWith('/balance')?{success:true,data:{balance:10}}:url.pathname.endsWith('/verify-otp')?{status:true}:{success:true});
}});
try{
 for(const path of ['/sms','/whatsapp','/verify','/balance']){
  const response=await runtime.dispatchFetch('https://test.local'+path);
  assert.equal(response.status,200,await response.clone().text());
 }
 assert.equal(calls.length,4);assert.equal(calls[0].body.method,'sms');assert.equal(calls[1].body.method,'whatsapp');
 assert.deepEqual(calls[2].body,{phone:'+966500000001',otp:'123456'});
 for(const status of [301,302,303,307,308]){
  outboundStatus=status;const before=calls.length;
  const response=await runtime.dispatchFetch('https://test.local/sms');
  assert.equal(response.status,503);assert.equal((await response.json()).reason,'unexpected_redirect');
  assert.equal(calls.length,before+1,'Redirects must not forward the key or OTP to another address');
 }
}finally{await runtime.dispose();}
console.log('PASS: Authentica send/verify/balance run in workerd; all redirects rejected without forwarding credentials.');
