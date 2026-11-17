import assert from 'node:assert/strict';
import {load,sql,env,seedEmployee,req} from './test-fixture.mjs';
const {requestsReview,isReviewInvitation}=await load('lib/chat-handoff.ts');
const {guideTurn}=await load('lib/server/interview-coach.ts');
const {ChatSessionRegistry,chatSessionKey}=await load('lib/client-chat-session.ts');
const {exampleChallenges}=await load('lib/challenges.ts');
const {emptyChatDraft,missingFields}=await load('lib/ai-challenge.ts');
const chat=await load('app/api/chat/route.ts');
const u=content=>({role:'user',content}),a=content=>({role:'assistant',content});
const draft={...exampleChallenges[0].challenge},unconfirmed={version:1,signals:[],asked:['scene']};
const offer='هل تريد المراجعة؟';
for(const text of ['انتهيت','أنا انتهيت','لقد انتهيت','انتهيت من كتابة التحدي','نعم، خلصت','خلاص انتهيت شكرا','ما عندي إضافات','لا توجد أي إضافات','هذا كل شيء','خلاص','أبغى أراجع البطاقة','انتقل إلى المراجعة','نعم ابدأ المراجعة']){
 assert(requestsReview([a('ماذا حدث؟'),u(text)],unconfirmed),text);
}
for(const text of [offer,'هل ترغب في مراجعة البطاقة الآن؟','هل تحب أن ننتقل إلى المراجعة؟','هل أنت جاهز لمراجعة ما جمعناه؟','هل نراجع البطاقة؟','هل لديك تفاصيل إضافية قبل النشر؟']){
 assert(isReviewInvitation(text),text);assert(requestsReview([a(text),u('نعم')],unconfirmed),text);
}
assert(requestsReview([a('هل لديك تفاصيل إضافية قبل النشر؟'),u('لا شكرا')],unconfirmed));
for(const text of ['نعم','لا','لم أنته بعد','لا أريد المراجعة الآن','انتهيت من الزيارة','بعد ما انتهيت من الزيارة تأخر التقرير','انتهيت لكن صحح الأثر إلى تأخر الرد','أنا انتهيت من التنسيق لكن الزميل لم يرد']){
 assert(!requestsReview([a('هل جربت حلًا أوليًا؟'),u(text)],unconfirmed),text);
}
assert(!requestsReview([a(offer),u('لا')],unconfirmed));
assert(!isReviewInvitation('هل تتأخر مراجعة طلب المنحة عند المدير؟'));

// A model cannot keep asking permission under a discovery-topic label.
const loopingTurn={signals:[],updates:[],focus:'scene',reflection:'',question:offer};
for(const question of [offer,'هل ترغب في مراجعة البطاقة الآن؟']){
 const result=guideTurn({draft,messages:[u(draft.situation)],interview:unconfirmed},{...loopingTurn,question});
 assert(!isReviewInvitation(result.message));assert(!result.ready,'Normal discovery still needs understanding');
}
const ended=guideTurn({draft,messages:[a(offer),u('انتهيت')],interview:unconfirmed},{...loopingTurn,updates:[{field:'title',value:'عنوان لا يخص المستخدم',quote:'انتهيت'}]});
assert(ended.reviewRequested&&ended.ready);assert.deepEqual(ended.draft,draft);assert(!/[؟?]/.test(ended.message));
const finalCorrection='تصحيح: يتأخر إرسال التقرير وليس الصرف. اكتفي بما قلته وافتح لي المسودة.';
const corrected=guideTurn({draft,messages:[u(finalCorrection)],interview:unconfirmed},{...loopingTurn,focus:'review',question:'',reviewRequestQuote:'اكتفي بما قلته وافتح لي المسودة',updates:[{field:'impact',value:'يتأخر إرسال التقرير وليس الصرف.',quote:'يتأخر إرسال التقرير وليس الصرف'}]});
assert(corrected.reviewRequested);assert.equal(corrected.draft.impact,'يتأخر إرسال التقرير وليس الصرف.');
const unsupported=guideTurn({draft,messages:[a('انتهيت'),u(draft.situation)],interview:unconfirmed},{...loopingTurn,focus:'review',reviewRequestQuote:'انتهيت'});assert(!unsupported.reviewRequested,'Assistant text cannot authorize navigation');

// Server handoff works without an AI request or quota and still enforces participant access.
const staff=seedEmployee('handoff'),body={draft,messages:[a(offer),u('نعم')],interview:unconfirmed};
assert.equal((await chat.POST(req(null,body))).status,401);
assert.equal((await chat.POST(req(staff,body,'POST',{origin:'https://evil.test'}))).status,403);
let response=await chat.POST(req(staff,body));assert.equal(response.status,200);let result=await response.json();
assert(result.reviewRequested&&result.ready);assert.deepEqual(result.draft,draft);
result=await (await chat.POST(req(staff,{...body,draft:{...draft,need:''},messages:[u('انتهيت')]}))).json();
assert(result.reviewRequested&&!result.ready);assert.equal(result.draft.need,'');assert(result.missing.length>0);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM ai_usage').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM challenges').get().n,0,'Review is never publication');

class MemoryStorage{items=new Map();get length(){return this.items.size}key(i){return [...this.items.keys()][i]??null}getItem(k){return this.items.get(k)??null}setItem(k,v){this.items.set(k,v)}removeItem(k){this.items.delete(k)}}
const storage=new MemoryStorage();let posts=0;
const io={storage:()=>storage,fetch:async(_url,options)=>{if(options?.method!=='POST')return Response.json({available:true});posts++;return Response.json({message:'سؤال عن التفاصيل المصححة؟',draft,ready:false,interview:unconfirmed})}};
const registry=new ChatSessionRegistry(io),session=registry.get({participantKey:'test-person',initialDraft:draft});
session.initialize();await new Promise(r=>setTimeout(r,0));session.setText('أنا انتهيت');await session.send();
assert.equal(posts,0);assert.equal(session.getSnapshot().reviewRequested,true);assert.deepEqual(session.getSnapshot().draft,draft);
assert(session.consumeReviewRequest());assert(!session.consumeReviewRequest(),'Only one transition to review');
session.replaceDraft(draft);assert(!session.getSnapshot().reviewRequested,'Returning to chat must not bounce back');
session.setText('انتهيت لكن صحح الأثر إلى تأخر الرد');await session.send();assert.equal(posts,1,'Do not discard a correction');

// Upgrade a pre-fix saved loop in place. Keep its transcript, draft and storage key.
const legacyKey=chatSessionKey('legacy-person'),legacyMessages=[u(draft.situation),a(offer),u('انتهيت'),a('هل تحب أن ننتقل إلى المراجعة؟')];
storage.setItem(legacyKey,JSON.stringify({draft,messages:legacyMessages,interview:unconfirmed,ready:false,text:''}));
const legacy=registry.get({participantKey:'legacy-person'});legacy.initialize();
assert(legacy.getSnapshot().reviewRequested&&legacy.getSnapshot().ready);assert.deepEqual(legacy.getSnapshot().messages,legacyMessages);assert.deepEqual(legacy.getSnapshot().draft,draft);
legacy.consumeReviewRequest();legacy.dispose();
const reopened=new ChatSessionRegistry(io),again=reopened.get({participantKey:'legacy-person'});again.initialize();assert(!again.getSnapshot().reviewRequested);
storage.setItem(chatSessionKey('unsent-person'),JSON.stringify({draft,messages:legacyMessages,text:'تصحيح لم أرسله بعد'}));
const unsent=registry.get({participantKey:'unsent-person'});unsent.initialize();assert(!unsent.getSnapshot().reviewRequested);assert.equal(unsent.getSnapshot().text,'تصحيح لم أرسله بعد');
storage.setItem(chatSessionKey('answered-person'),JSON.stringify({draft,messages:[a('هل جربت حلًا أوليًا؟'),u('نعم'),a('راجع البطاقة.')],interview:{...unconfirmed,asked:['review']},ready:true,text:''}));
const answered=registry.get({participantKey:'answered-person'});answered.initialize();assert(!answered.getSnapshot().reviewRequested,'An answer about the challenge is not consent to navigate');
const incomplete=registry.get({participantKey:'incomplete-person',initialDraft:{...draft,need:''}});incomplete.initialize();incomplete.setText('خلصت');await incomplete.send();assert(incomplete.getSnapshot().reviewRequested&&!incomplete.getSnapshot().ready);assert(missingFields(incomplete.getSnapshot().draft).includes('need'));
registry.dispose();reopened.dispose();sql.close();
console.log('PASS: Arabic finish intent, semantic review-loop rejection, authenticated no-AI handoff, unchanged drafts, incomplete validation, saved-loop recovery, unsent text, corrections and one-time navigation.');
