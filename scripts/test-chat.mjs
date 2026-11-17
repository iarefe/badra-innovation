import assert from 'node:assert/strict';
import {sql,load,env,seedEmployee,req} from './test-fixture.mjs';
const staff=seedEmployee('101');
const chat=await load('app/api/chat/route.ts'),shared=await load('lib/ai-challenge.ts'),lib=await load('lib/challenges.ts');
const request=(body,origin='https://site.test')=>req(staff,body,'POST',{origin,ip:'198.51.100.1'});
const user=content=>({role:'user',content}), assistant=content=>({role:'assistant',content});
const empty={...shared.emptyChatDraft,author:'صاحب التحدي'},input={messages:[user('نحتاج نظام اجتماعات')],draft:empty};
const turn=(focus,question,signals=[],updates=[],reflection='')=>({signals,updates,focus,question,reflection});
const signal=(axis,quote,status='observed')=>({axis,quote,status}),update=(field,value,quote=value)=>({field,value,quote});
assert.deepEqual(await (await chat.GET()).json(),{available:false});
assert.equal((await chat.POST(req(null,input))).status,401);assert.equal((await chat.POST(request(input))).status,503);
env.OPENAI_API_KEY='test-placeholder';
let calls=0,mode='ok',upstream=turn('ownership','هل معك شركاء؟');
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 calls++;assert.equal(url,'https://api.openai.com/v1/responses');const b=JSON.parse(options.body);assert.equal(b.store,false);assert.equal(b.max_output_tokens,4000);assert.equal(b.text.format.strict,true);
 assert(!b.text.format.schema.properties.draft,'The model sends supported changes, not a regenerated full card');assert.equal(b.input.at(-1).role,'user');
 if(mode==='error')return Response.json({error:{code:'invalid_api_key',message:'private upstream details'}},{status:401});
 if(mode==='incomplete')return Response.json({status:'incomplete'});
 if(mode==='refusal')return Response.json({output:[{content:[{type:'refusal',refusal:'refused'}]}]});
 return Response.json({status:'completed',output:[{content:[{type:'output_text',text:mode==='invalid'?'invalid json':JSON.stringify(upstream)}]}]});
};
async function converse(body,reply){upstream=reply;const r=await chat.POST(request(body));assert.equal(r.status,200,await r.clone().text());return r.json()}
const next=(prior,history,newText)=>({draft:prior.draft,interview:prior.interview,messages:[...history,assistant(prior.message),user(newText)]});
const focus=r=>r.interview.asked.at(-1);
assert.equal((await chat.POST(request(input,'https://evil.test'))).status,403);
assert.equal((await chat.POST(request({...input,messages:[user('x'.repeat(4001))]}))).status,400);assert.equal(calls,0);
// Opening with a proposed product is not an observed problem; don't pivot to ownership.
const initial=await converse(input,turn('ownership','هل تتبنى التحدي بمفردك؟',[signal('scene','نحتاج نظام اجتماعات')],[update('situation','يتعطل إعداد القرارات قبل الاجتماع.','نحتاج نظام اجتماعات')]));
assert.equal(focus(initial),'scene');assert.equal(initial.ready,false);assert.equal(initial.draft.situation,'');assert.match(initial.message,/آخر مرة/);
const vague='تحسين الكفاءة في العمل';const weak=await converse({...input,messages:[user(vague)]},turn('ownership','هل معك زملاء؟',[signal('scene',vague),signal('impact',vague)],[update('impact','يفقد فريق المؤسسة عشرات الساعات في الأسبوع.',vague)]));
assert.equal(focus(weak),'scene');assert.equal(weak.draft.impact,'');assert(!weak.interview.signals.length);
// One answer grounds several aspects, and the next question follows the missing consequence.
const scene='أمس رجعت الجمعية تسأل موظف المنح عن طلبها. الموظف بحث في رسالتين مختلفتين ولم يعرف أي نسخة معتمدة.';
const b2=next(initial,input.messages,scene);
const sceneSignals=[signal('scene','رجعت الجمعية تسأل موظف المنح عن طلبها'),signal('friction','لم يعرف أي نسخة معتمدة'),signal('people','الجمعية تسأل موظف المنح عن طلبها')];
const act=await converse(b2,turn('impact','عندما لم يعرف الموظف النسخة المعتمدة، ماذا حدث لطلب الجمعية؟',sceneSignals,[update('situation',scene),update('stakeholders','الجمعية التي تتابع طلبها وموظف المنح.','الجمعية تسأل موظف المنح عن طلبها'),update('need','معرفة النسخة المعتمدة لمتابعة الطلب.','لم يعرف أي نسخة معتمدة'),update('evidence','تأخرت 90 جمعية وفق سجل داخلي.','رجعت الجمعية تسأل موظف المنح عن طلبها')],'موضع التعثّر هو تمييز النسخة المعتمدة عند متابعة الطلب.'));
assert.equal(focus(act),'impact');assert.equal(act.draft.evidence,'');assert.equal(act.interview.signals.length,3);assert.match(act.message,/النسخة المعتمدة/);assert(!JSON.stringify(act).includes(env.OPENAI_API_KEY));
const generic=await converse(b2,turn('impact','ما أثر هذا التحدي؟',sceneSignals,[],'شكرًا لك.'));
assert.match(generic.message,/لم يعرف أي نسخة معتمدة/);assert(!generic.message.includes('شكرًا لك'));
// A hypothesis is not a proven cause; a descriptive consequence is still evidence without a count.
const impact='تأجل قرار الصرف حتى أرسلت الجمعية الملف مرة أخرى',guess='أعتقد أن السبب ضعف التدريب';
const b3=next(act,b2.messages,impact+'. '+guess+'، ما عندي رقم لحالات التأخر.');
const ai=await converse(b3,turn('verify','ما الملاحظة التي جعلتك ترجّح أن التدريب هو السبب؟',[signal('impact',impact)],[update('impact',impact),update('assumptions',guess),update('situation','المشكلة هي ضعف تدريب الموظفين.',guess),update('evidence','تأجل قرار الصرف حتى أرسلت الجمعية الملف مرة أخرى.',impact)]));
assert.equal(ai.draft.situation,scene);assert.equal(ai.draft.impact,impact);assert.equal(ai.draft.assumptions,guess);assert.equal(focus(ai),'verify');
// Assistant examples cannot become facts; no repeated or compound question, no invented number.
const b4=next(ai,b3.messages,'لا أعرف سبب اختلاف النسخ.');b4.messages.splice(-1,0,assistant('مثلًا: تكررت المشكلة لدى 60 جهة.'));
const ai2=await converse(b4,turn('verify',ai.message,[],[update('evidence','تكررت المشكلة لدى 60 جهة.','تكررت المشكلة لدى 60 جهة.')]));
assert.equal(ai2.draft.evidence,ai.draft.evidence);assert.equal(focus(ai2),'success');assert.equal((ai2.message.match(/[؟?]/g)||[]).length,1);
const corrected='تصحيح: لم يتأجل الصرف، الذي تأجل هو إرسال تقرير المتابعة.';
const b5=next(ai2,b4.messages,corrected);
const fixed=await converse(b5,turn('success','كم يومًا تأخر؟ ومن كان معه؟',[signal('impact','الذي تأجل هو إرسال تقرير المتابعة')],[update('impact','تأجل إرسال تقرير المتابعة ولم يتأجل الصرف.',corrected)]));
assert(!fixed.draft.impact.includes('حتى أرسلت'));assert(!fixed.draft.evidence.includes('تأجل قرار الصرف'));assert.equal(fixed.interview.signals.find(s=>s.axis==='impact').quote,'الذي تأجل هو إرسال تقرير المتابعة');assert.equal((fixed.message.match(/[؟?]/g)||[]).length,1);
const complete={...lib.exampleChallenges[0].challenge},rich=[complete.situation,complete.need,complete.stakeholders,complete.impact,complete.success].join('\n');
const receipts=[signal('scene',complete.situation.slice(0,130).replace(/\s+\S*$/,'')),signal('friction',complete.situation.split(' ').slice(-7).join(' ')),signal('people',complete.need),signal('impact',complete.impact),signal('success',complete.success)];
const card={draft:complete,messages:[user(rich)]};
const opaque=await converse({...card,interview:{version:1,asked:[],signals:[]}},turn('review',''));assert(!opaque.ready,'Length-valid fields alone do not establish understanding');
const completeResult=await converse(card,turn('review','',receipts));assert.equal(completeResult.ready,true);assert.deepEqual(completeResult.draft,complete);assert.match(completeResult.message,/راجع البطاقة/);
const confirmed={version:1,signals:receipts,asked:[]};
for(const [key,val,want] of [['ownership','','ownership'],['initialSolutionStatus','','trialStatus'],['need','','people']]){
 const r=await converse({...card,draft:{...complete,[key]:val},interview:confirmed},turn('review',''));assert.equal(r.ready,false);assert.equal(focus(r),want);assert(r.missing.includes(shared.chatFields[key]));
}
const sharedTrial={...complete,ownership:'shared',coOwners:'',initialSolutionStatus:'implemented',initialSolution:'',initialSolutionOutcome:''};
let r=await converse({...card,draft:sharedTrial,interview:confirmed},turn('coOwners','ما اسم الفريق الذي سيظهر بموافقتهم؟'));assert.equal(focus(r),'coOwners');
r=await converse({...card,draft:{...sharedTrial,coOwners:'فريق المنح'},interview:confirmed},turn('review',''));assert.equal(focus(r),'trialDetail');
r=await converse({...card,draft:{...sharedTrial,coOwners:'فريق المنح',initialSolution:'جرّبنا جدولًا مشتركًا لمتابعة طلبات الصرف.'},interview:confirmed},turn('review',''));assert.equal(focus(r),'trialOutcome');assert(!r.ready);
const noMeasure='لم نقس النتيجة بعد';const r2=await converse(next(r,card.messages,noMeasure),turn('review','',[],[update('initialSolutionOutcome',noMeasure)]));assert(r2.ready);assert.equal(r2.draft.initialSolutionOutcome,noMeasure);
// Saying "I don't know" should move the interview on, not fabricate success or ask for a percentage.
const noSuccess='لا أعرف علامة التحسن بعد';
r=await converse({...card,interview:confirmed,draft:{...complete,success:''},messages:[user(noSuccess)]},turn('success','ما نسبة التحسن المتوقعة؟',[signal('success',noSuccess,'unknown')]));
assert.equal(focus(r),'pause');assert(!r.ready);assert.equal(r.draft.success,'');
for(const [m,status] of [['error',503],['incomplete',502],['refusal',422],['invalid',502]]){mode=m;const response=await chat.POST(request(input));assert.equal(response.status,status);assert(!(await response.text()).includes('private upstream details'))}
mode='ok';sql.exec('DELETE FROM ai_usage');env.AI_DAILY_LIMIT='2';
assert.equal((await chat.POST(request(input))).status,200);assert.equal((await chat.POST(request(input))).status,200);const before=calls;assert.equal((await chat.POST(request(input))).status,429);assert.equal(calls,before);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM challenges').get().n,0);
globalThis.fetch=originalFetch;sql.close();console.log('PASS: multi-turn Arabic discovery, solution-first and rich openings, concrete impact, hypotheses, evidence attribution, corrections, unknowns, trial outcomes, review gates, authorization, quotas and no automatic publication.');
