import assert from 'node:assert/strict';
import {load,sql,req,seedEmployee} from './test-fixture.mjs';
const [{guideTurn},{controlTurn,remainingTurn,readCadence,asksForGaps,recoverMetadata,readDomain},{ChatSessionRegistry,chatSessionKey},{exampleChallenges,challengeSchema},{missingFields,chatFields},chat,records]=await Promise.all(['lib/server/interview-coach.ts','lib/chat-recovery.ts','lib/client-chat-session.ts','lib/challenges.ts','lib/ai-challenge.ts','app/api/chat/route.ts','app/api/challenges/route.ts'].map(load));
const u=content=>({role:'user',content}),a=content=>({role:'assistant',content});
const old='يمكنك مراجعة ما وصفته في المسودة، أو إضافة موقف آخر إذا تذكّرته. سيبقى ما لم يتضح بحاجة إلى تحقق.';
const neutral={...exampleChallenges[0].challenge,title:'تأخّر إصلاح أجهزة المصعد في مبنى المؤسسة',situation:'عند تعطل أحد أجهزة المصعد ينتظر الفريق زيارة المقاول، ويصعب معرفة موعد إصلاح العطل أو البديل المتاح.',domain:'',frequency:'',ownership:'individual',initialSolutionStatus:'none'};
const known={version:1,signals:[],asked:['frequency','domain','pause','pause']};
const messages=[a('ماذا يحدث؟'),u(neutral.situation),a('متى يتكرر هذا الموقف عادةً؟'),u('مرة واحدة في السنة'),a(old),u('لا يوجد لدي إضافة'),a(old),u('ما هو الذي ينقص لديك'),a(old)];
for(const input of ['سنوي','سنويًا','سنوية','سَنَوِيّ','مرة كل عام','كل سنة','كل عام','مرة واحدة في السنة','مره واحده بالسنه','هذا الموقف يتكرر مرة كل سنة'])assert.equal(readCadence(input),'سنويًا',input);
assert.equal(readCadence('نصف سنوي'),'نصف سنوي');assert.equal(readCadence('ربع سنوي'),'ربع سنوي');
for(const input of ['إعداد تقرير سنوي','هل هو سنوي؟','ليست سنوية','نريد أن يصبح سنويًا','مرتين في السنة','مرة كل سنتين'])assert.equal(readCadence(input),undefined,input);
assert.equal(readDomain('يتأخر فريق المنح عند دراسة طلبات المنح'),'المنح والمشاريع');
assert.equal(readDomain('تتداخل جودة البيانات مع إدارة المنح'),undefined);
for(const ask of ['ما هو الذي ينقص لديك','وش الناقص؟','ما الذي ينقصك؟','ماهو اللي ناقص','لماذا يتكرر السؤال؟','اعرض لي الخانات الناقصة'])assert(asksForGaps(ask),ask);
for(const answer of ['ما الذي ينقص المستفيد عند إعداد التقرير؟','التحدي هو ما ينقص الفريق من بيانات','لا يوجد لدي حل أولي','انتهيت لكن التكرار شهري'])assert(!asksForGaps(answer),answer);
assert.equal(recoverMetadata(neutral,[a('مثلًا: يتكرر سنويًا عند متابعة طلبات المنح'),u('ما أدري')]).frequency,'');
assert.equal(recoverMetadata(neutral,[a('مثلًا: يتكرر سنويًا عند متابعة طلبات المنح'),u('ما أدري')]).domain,'');
const protectedCard={...neutral,domain:'تجربة الجهات المستفيدة',frequency:'شهريًا'};
assert.equal(recoverMetadata(protectedCard,[u('سنوي')],protectedCard).frequency,'شهريًا','Protected published data is not rewritten');
const checks=controlTurn({draft:neutral,messages:messages.slice(0,-1),interview:known});
assert.equal(checks.draft.frequency,'سنويًا');assert.deepEqual(checks.missing,[chatFields.domain]);assert(!checks.ready&&!checks.reviewRequested);
const finish=controlTurn({draft:neutral,messages:messages.slice(0,6),interview:known});assert(finish.reviewRequested&&!finish.ready);assert.match(finish.message,/المجال/);
const badAI={focus:'domain',question:'هل هناك معلومات إضافية؟',reflection:'',signals:[],updates:[{field:'domain',value:'خدمات المباني',quote:'أجهزة المصعد'}]};
const unrelated=guideTurn({draft:neutral,messages:[u('كتبنا تقرير سنوي عن المبنى لكن المشكلة جديدة ولم نحدد مدى تكرارها.')],interview:{version:1,asked:['scene'],signals:[]}},
 {...badAI,updates:[{field:'frequency',value:'سنويًا',quote:'سنوي'}]});assert.equal(unrelated.draft.frequency,'','An annual report does not imply an annual problem');
const guided=guideTurn({draft:neutral,messages:[u(neutral.situation),a('متى يتكرر هذا الموقف عادةً؟'),u('سنوي')],interview:{version:1,asked:['frequency'],signals:[]}},badAI);
assert.equal(guided.draft.frequency,'سنويًا');assert.equal(guided.draft.domain,'');assert.deepEqual(guided.missing,[chatFields.domain]);assert.notEqual(guided.interview.asked.at(-1),'frequency');
const stalled=guideTurn({draft:{...neutral,frequency:'سنويًا'},messages:[a('ما مجاله؟'),u('ما عندي تصنيف')],interview:{version:1,signals:[],asked:['domain','domain'],noProgress:1}},{...badAI,updates:[],question:'ما التصنيف الأقرب لهذا الوصف؟'});
assert.equal(stalled.interview.asked.at(-1),'pause');assert.match(stalled.message,/المجال/);assert(!stalled.message.includes('يمكنك مراجعة ما وصفته'));
assert(remainingTurn({...neutral,frequency:'سنويًا',domain:'مجال آخر'}).ready);
assert.equal(controlTurn({draft:{...neutral,frequency:'سنويًا'},messages:[a('إلى أي مجال ينتمي التحدي؟'),u('مجال آخر')],interview:{version:1,signals:[],asked:['domain']}}).ready,true);
class Storage{items=new Map();getItem(k){return this.items.get(k)??null}setItem(k,v){this.items.set(k,v)}removeItem(k){this.items.delete(k)}}
const storage=new Storage();let calls=0;
const io={storage:()=>storage,fetch:async(_url,opts)=>{if(opts?.method==='POST'){calls++;throw Error('These steps must work without AI')}return Response.json({available:false})}};
const key=chatSessionKey('stuck');storage.setItem(key,JSON.stringify({draft:neutral,messages,ready:false,interview:known,text:'تفصيل لم أرسله بعد'}));
let reg=new ChatSessionRegistry(io),s=reg.get({participantKey:'stuck'});s.initialize();let state=s.getSnapshot();assert.equal(state.draft.frequency,'سنويًا');assert.deepEqual(state.messages,messages);assert.equal(state.text,'تفصيل لم أرسله بعد');assert.deepEqual(missingFields(state.draft),['domain']);assert.equal(state.interview.asked.at(-1),'pause');
assert(s.beginFieldEdit('domain'));s.setText('اختيار غير معتمد');await s.send();assert(s.getSnapshot().error);assert.equal(s.getSnapshot().draft.domain,'');s.setText('مجال آخر');await s.send();state=s.getSnapshot();assert(state.ready);assert.equal(state.draft.domain,'مجال آخر');assert.equal(state.text,'تفصيل لم أرسله بعد');assert(!state.reviewRequested);assert.equal(calls,0);assert(challengeSchema.safeParse(state.draft).success);reg.dispose();
reg=new ChatSessionRegistry(io);s=reg.get({participantKey:'stuck'});s.initialize();assert(s.getSnapshot().ready);assert.equal(s.getSnapshot().draft.domain,'مجال آخر');assert.equal(s.getSnapshot().text,'تفصيل لم أرسله بعد');
s.setText('وش الناقص؟');await s.send();assert(s.getSnapshot().ready);assert.equal(calls,0);reg.dispose();
// Invalid short answers stay editable; conditional detail appears as soon as a dependency changes.
const missingTrial={...neutral,frequency:'سنويًا',domain:'مجال آخر',initialSolutionStatus:'',initialSolution:''};
const editReg=new ChatSessionRegistry(io),editor=editReg.get({participantKey:'open',initialDraft:missingTrial});editor.initialize();editor.showRemaining();editor.beginFieldEdit('initialSolutionStatus');editor.setText('implemented');await editor.send();assert.deepEqual(missingFields(editor.getSnapshot().draft),['initialSolution']);editor.beginFieldEdit('initialSolution');editor.setText('لا');await editor.send();assert.match(editor.getSnapshot().error,/10/);editor.setText('جربنا جدولة الصيانة في نموذج مشترك.');await editor.send();assert(editor.getSnapshot().ready);editReg.dispose();
// The same control paths work in the authenticated API without a model call or quota.
const staff=seedEmployee('422'),body={draft:neutral,messages:messages.slice(0,-1),interview:known};
assert.equal((await chat.POST(req(null,body))).status,401);let api=await chat.POST(req(staff,body));assert.equal(api.status,200);const data=await api.json();assert.equal(data.draft.frequency,'سنويًا');assert.deepEqual(data.missing,[chatFields.domain]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM ai_usage').get().n,0);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM challenges').get().n,0);
const pub=await records.POST(req(staff,{challenge:{...data.draft,domain:'مجال آخر'},submit:true}));assert.equal(pub.status,200,await pub.clone().text());
assert.equal(sql.prepare("SELECT json_extract(payload,'$.frequency') f FROM challenges").get().f,'سنويًا');
sql.close();console.log('PASS: screenshot transcript recovered in place; annual cadence, grounded/ambiguous domains, finite retries, offline completion, conditional validation and deliberate publication.');
