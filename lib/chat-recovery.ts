import {chatFields,emptyChatDraft,missingFields,type ChatDraft} from './ai-challenge';
import {domains,frequencies,type Challenge} from './challenges';
import {mergeCompletionDraft} from './challenge-completion';
import type {InterviewState,Topic} from './interview-state';
import {requestsReview,reviewHandoff} from './chat-handoff';

type Field=keyof ChatDraft;
type Message={role:'user'|'assistant';content:string;field?:Field;source?:string};
export type RecoveryContext={draft:ChatDraft;messages:Message[];interview?:InterviewState;existing?:Partial<Challenge>|null};
export function normalizeAnswer(text:string){return text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
export function asksForGaps(text:string){
 const t=normalizeAnswer(text).replace(/^ماهو /,'ما هو ').replace(/^ماهي /,'ما هي ').replace(/^(?:(?:طيب|بذرة|لو سمحت|ممكن|قل لي|علمني) )+/,'');
 return /^(?:(?:وش|ايش|ماذا|ما)(?: هو| هي)?(?: الذي| التي| اللي| الي)? (?:ينقص(?:ك|ني)?|ينقص بطاقتي|ناقص(?:ني)?|الناقص|باقي|الباقي|تبقي|المتبقي|بقي|الحقول الناقصة|الخانات الناقصة)(?: (?:عندك|لديك|عندي|بعد|الان|مني|من البيانات|من الحقول|بالضبط|في البطاقة|في بطاقتي|لاكمل البطاقة|للنشر))*|(?:اعرض|ارني|اظهر|وضح) (?:لي )?(?:الناقص|ما تبقي|الحقول الناقصة|الخانات الناقصة)|(?:لماذا|ليش) (?:يتكرر|تكرر|تعيد) (?:نفس )?السؤال|(?:انت )?تكرر (?:نفس )?السؤال)$/.test(t);
}
export function wasStalled(messages:Message[],interview?:InterviewState){
 if(interview?.asked.at(-1)==='pause')return true;
 const last=messages.filter(m=>m.role==='assistant').slice(-2).map(m=>normalizeAnswer(m.content.split(/\n\n+/).at(-1)||''));
 return !!last.at(-1)&&(/يمكنك مراجعة ما وصفته في المسودة/.test(last.at(-1)!)||last.length===2&&last[0]===last[1]);
}
const cadenceRules:ReadonlyArray<[typeof frequencies[number],string]>=[
 ['ربع سنوي','ربع سنوي(?:ا|ة)?|كل (?:ربع سنة|ثلاثة اشهر|ثلاثه اشهر|ثلاث شهور|3 اشهر|٣ اشهر)'],
 ['نصف سنوي','(?:نصف|نص) سنوي(?:ا|ة)?|كل (?:نصف سنة|ستة اشهر|ست شهور|6 اشهر|٦ اشهر)'],
 ['سنويًا','سنوي(?:ا|ة|ه)?|كل (?:عام|سنة|سنه)|(?:في (?:كل )?(?:العام|السنة|السنه)|بالعام|بالسنة|بالسنه)'],
 ['شهريًا','شهري(?:ا|ة|ه)?|كل شهر|في الشهر'],['أسبوعيًا','اسبوعي(?:ا|ة|ه)?|كل اسبوع|في الاسبوع'],
 ['يوميًا','يومي(?:ا|ة|ه)?|كل يوم|في اليوم'],['موسميًا','موسمي(?:ا|ة|ه)?|كل موسم'],
 ['مع كل طلب أو مشروع','مع كل (?:طلب او مشروع|طلب|مشروع)'],['غير محدد','غير محدد(?:ة)?|بلا نمط ثابت|بدون نمط ثابت']
];
const cadence= cadenceRules.map(([value,pattern])=>({value,exact:new RegExp('^(?:(?:مرة|مره)(?: (?:واحدة|واحده))? |بشكل |بصفة |بصورة )?(?:'+pattern+')$'),inText:new RegExp('(?:^| )((?:'+pattern+'))(?= |$)')}));
const explicitFrequency=/(?:^(?:التكرار|تكرار (?:التحدي|الموقف|المشكلة)) |(?:^| )(?:يتكرر|تتكرر|يتكرّر|يتكرر الموقف|تحدث المشكلة|يحدث (?:التحدي|الموقف)|وتيرته|وتيرتها) |(?:^| )(?:مرة|مره)(?: (?:واحدة|واحده))? (?:كل|في (?:كل )?(?:العام|السنة|السنه|الشهر|الاسبوع|اليوم)))/;
// Distinguish the cadence of the problem from a reference to an annual report,
// a desired future cadence, a negation, or multiple different periods.
export function readCadence(text:string,answering=false):typeof frequencies[number]|undefined{
 const s=normalizeAnswer(text);
 if(/[؟?]/.test(text))return;
 const direct=cadence.find(r=>r.exact.test(s));if(direct)return direct.value;
 if(!s||/[؟?]/.test(text)||/(?:^| )(?:ليس|ليست|مو|لا|لم|ربما|يمكن|اتوقع|نريد|نرغب|المطلوب|نتمني|مرتين|مرتان|عدة مرات|مرات|كل سنتين|كل عامين)(?: |$)/.test(s))return;
 if(!answering&&!explicitFrequency.test(s))return;
 const candidates=cadence.filter(r=>r.inText.test(s)&&(!['سنويًا'].includes(r.value)||!/(?:ربع|نصف|نص) سنوي/.test(s)));
 return candidates.length===1?candidates[0].value:undefined;
}
const domainRules:[typeof domains[number],RegExp][]=[
 ['العمليات والاجتماعات',/(?:متابعة (?:قرارات|القرارات|التكليفات)|محاضر الاجتماعات|محضر الاجتماع|جدول (?:الاجتماعات|اعمال الاجتماع)|الاجتماعات الداخلية|العمليات التشغيلية|الاجراءات الداخلية)/],
 ['المنح والمشاريع',/(?:(?:طلب|طلبات) (?:المنح|المنحة)|تقييم المنح|دراسة المنح|متابعة المنح|ادارة المنح|فريق المنح|موظف المنح|صرف المنح|تقارير المنح|المشاريع المدعومة)/],
 ['تجربة الجهات المستفيدة',/(?:تجربة (?:الجهات المستفيدة|المستفيدين|المستفيد)|رحلة (?:المستفيد|الجهة المستفيدة)|رضا الجهات المستفيدة)/],
 ['الاستشارات وتأسيس الجهات',/(?:تاسيس (?:المؤسسات|مؤسس[ةه]|الجهات|الكيانات)|تقديم الاستشارات|الاستشارات المتخصصة|طلبات الاستشارة)/],
 ['المعرفة والبيانات',/(?:ادارة (?:المعرفة|البيانات|الوثائق)|حوكمة البيانات|جودة البيانات|توثيق المعرفة|مشاركة المعرفة|ارشفة الوثائق|تشتت البيانات)/]
];
export function readDomain(text:string,exactOnly=false):typeof domains[number]|undefined{
 const s=normalizeAnswer(text);if(!s||/[؟?]/.test(text))return;
 const direct=domains.find(d=>s===normalizeAnswer(d)||s==='المجال '+normalizeAnswer(d)||s==='مجال التحدي '+normalizeAnswer(d));
 if(direct)return direct;
 if(exactOnly||/(?:^| )(?:ليس|ليست|مو|ربما|لا يتعلق|لا يرتبط|لا يخص)(?: |$)/.test(s))return;
 const hits=domainRules.filter(([,pattern])=>pattern.test(s));
 return hits.length===1?hits[0][0]:undefined;
}
export function messageCadence(messages:Message[],index:number,focus?:Topic){
 const m=messages[index],prior=messages[index-1];if(m?.role!=='user')return;
 const addressed=m.field==='frequency'||index===messages.length-1&&focus==='frequency'||!!prior&&prior.role==='assistant'&&/(?:متي يتكرر|ما تكرار|كم مر[ةه] يتكرر|وتيرة التكرار)/.test(normalizeAnswer(prior.content.split(/\n\n+/).at(-1)||''));
 return readCadence(m.content,addressed);
}
export function recoverMetadata(draft:ChatDraft,messages:Message[],existing?:Partial<Challenge>|null,previous?:ChatDraft,lastFocus?:Topic):ChatDraft{
 let frequency=draft.frequency,domain=draft.domain;
 const last=messages.findLastIndex(m=>m.role==='user');
 // Only participant statements supply facts. Assistant questions can establish
 // which field a short answer addresses but can never supply its value.
 let remembered:string|undefined,latest:string|undefined,namedDomain:string|undefined;
 for(let i=last;i>=0;i--){
  const m=messages[i];if(m.role!=='user')continue;
  const f=messageCadence(messages,i,lastFocus);
  if(f){remembered??=f;if(i===last)latest=f;}
  namedDomain??=readDomain(m.content,true);
 }
 const validFrequency=(v:string)=>frequencies.some(f=>f===v),validDomain=(v:string)=>domains.some(d=>d===v);
 if(previous&&validFrequency(previous.frequency)&&previous.frequency!=='غير محدد')frequency=previous.frequency;
 if(latest)frequency=latest;
 else if(!validFrequency(frequency)||frequency==='غير محدد'||wasStalled(messages))frequency=remembered||readCadence(frequency)||frequency;
 if(previous&&validDomain(previous.domain))domain=previous.domain;
 const lastDomain=last>=0?readDomain(messages[last].content,true):undefined;
 if(lastDomain)domain=lastDomain;
 else if(!validDomain(domain)||domain==='مجال آخر'&&!namedDomain&&previous?.domain!==domain){
  const inputs=[draft.title,draft.situation,...messages.filter(m=>m.role==='user'&&!asksForGaps(m.content)).map(m=>m.content)];
  const hits=new Set(inputs.flatMap(t=>{const val=readDomain(t);return val?[val]:[]}));
  domain=namedDomain||(hits.size===1?[...hits][0]:undefined)||domain;
 }
 const result={...draft,frequency,domain};
 return existing?{...emptyChatDraft,...mergeCompletionDraft(existing,result)} as ChatDraft:result;
}
export function remainingTurn(draft:ChatDraft,interview?:InterviewState){
 const missing=missingFields(draft),topic:Topic=missing.length?'pause':'review';
 return {draft,ready:!missing.length,reviewRequested:false,missing:missing.map(k=>chatFields[k as Field]),
  message:missing.length?'ما تبقّى قبل مراجعة بطاقتك: '+missing.map(k=>chatFields[k as Field]).join('، ')+'. اختر خانة لإكمالها.':'اكتملت البيانات المطلوبة. يمكنك مراجعة البطاقة قبل إرسالها.',
  interview:{version:1 as const,signals:interview?.signals||[],asked:[...(interview?.asked||[]),topic].slice(-18)}};
}
export function controlTurn(ctx:RecoveryContext){
 const last=ctx.messages.at(-1);if(last?.role!=='user')return;
 const finish=requestsReview(ctx.messages,ctx.interview),asks=asksForGaps(last.content);
 const focus=ctx.interview?.asked.at(-1);
 const choiceOnly=missingFields(ctx.draft).length>0&&missingFields(ctx.draft).every(k=>['domain','frequency','scope','ownership','initialSolutionStatus','coOwners','department'].includes(k))
  &&(focus==='frequency'&&cadence.some(r=>r.exact.test(normalizeAnswer(last.content)))||focus==='domain'&&!!readDomain(last.content,true));
 if(!finish&&!asks&&!choiceOnly)return;
 const draft=recoverMetadata(ctx.draft,ctx.messages,ctx.existing,undefined,ctx.interview?.asked.at(-1));
 return finish?reviewHandoff(draft,ctx.interview,!!ctx.existing):remainingTurn(draft,ctx.interview);
}
