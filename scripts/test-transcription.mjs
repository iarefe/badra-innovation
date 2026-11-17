import assert from 'node:assert/strict';
import {sql,load,env,req,seedEmployee} from './test-fixture.mjs';
const api=await load('app/api/transcribe/route.ts');const staff=seedEmployee('602');
const request=(user=staff,type='audio/webm',size=100,origin='https://site.test')=>{const form=new FormData();form.append('audio',new File([new Uint8Array(size)],'test.webm',{type}));return new Request('https://site.test/api/transcribe',{method:'POST',headers:{origin,...(user?{cookie:'__Host-badra-employee='+user.secret}:{})},body:form});};
let calls=0,status=200,result={text:'تتفرق قرارات الاجتماعات ويصعب علينا متابعة التنفيذ.'};const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/audio/transcriptions');assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer test-only');assert.equal(options.body.get('model'),'gpt-4o-mini-transcribe');assert.equal(options.body.get('language'),'ar');assert(options.body.get('file') instanceof File);assert(!options.headers['Content-Type']);return Response.json(result,{status});};
try{
 assert.equal((await api.POST(request(null))).status,401);
 assert.equal((await api.POST(request())).status,503);env.OPENAI_API_KEY='test-only';
 assert.equal((await api.POST(request(staff,'audio/webm',100,'https://evil.test'))).status,403);
 assert.equal((await api.POST(request(staff,'text/plain'))).status,415);
 assert.equal((await api.POST(request(staff,'audio/webm',0))).status,400);
 assert.equal((await api.POST(request(staff,'audio/webm',4*1024*1024+1))).status,413);assert.equal(calls,0);
 for(const type of ['audio/webm','audio/mp4','audio/ogg']){const response=await api.POST(request(staff,type));assert.equal(response.status,200);assert.deepEqual(await response.json(),result);assert.match(response.headers.get('cache-control'),/no-store/);}
 status=401;result={error:{message:'private-upstream-secret'}};const failed=await api.POST(request());assert.equal(failed.status,503);assert(!(await failed.text()).includes('private-upstream-secret'));
 status=302;assert.equal((await api.POST(request())).status,503);
 status=200;result={text:''};assert.equal((await api.POST(request())).status,422);result={text:'ا'.repeat(4001)};assert.equal((await api.POST(request())).status,422);
 result={text:'إجابة صوتية للاختبار'};sql.prepare('DELETE FROM auth_limits').run();for(let i=0;i<20;i++)assert.equal((await api.POST(request())).status,200);const before=calls;assert.equal((await api.POST(request())).status,429);assert.equal(calls,before);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenges').get().n,0,'Transcription never publishes or creates a challenge');
}finally{globalThis.fetch=oldFetch;sql.close();}
console.log('PASS: authenticated audio transcription; origin, MIME and upload limits; SMS session reuse; Arabic result; safe provider errors; quotas; no automatic challenge creation.');
