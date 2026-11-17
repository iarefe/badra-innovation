import {z} from 'zod';
import {axes,topics,signalSchema,type Axis,type Topic,type Signal,type InterviewState} from '../interview-state';
import {chatFields,chatDraftSchema,missingFields,type ChatDraft} from '../ai-challenge';
import {challengeGaps} from '../challenge-completion';
import {domains,frequencies,scopes,type Challenge} from '../challenges';
import {isReviewInvitation,reviewHandoff} from '../chat-handoff';
import {controlTurn,messageCadence,recoverMetadata,remainingTurn} from '../chat-recovery';

type Field=keyof ChatDraft;
type Message={role:'user'|'assistant';content:string};
const fields=(Object.keys(chatFields) as Field[]).filter(k=>k!=='author');
const simple={type:'string'}, object=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const coachOutput=object({
 signals:{type:'array',items:object({axis:{type:'string',enum:axes},status:{type:'string',enum:['observed','tentative','unknown']},quote:simple})},
 updates:{type:'array',items:object({field:{type:'string',enum:fields},value:simple,quote:simple})},
 reflection:simple,focus:{type:'string',enum:topics},question:simple,reviewRequestQuote:simple
});
export const coachTurnSchema=z.object({
 signals:z.array(signalSchema).max(10),
 updates:z.array(z.object({field:z.enum(fields as [Field,...Field[]]),value:z.string().trim().max(1200),quote:z.string().trim().min(1).max(260)})).max(28),
 reflection:z.string().trim().max(600),focus:z.enum(topics),question:z.string().trim().max(480),reviewRequestQuote:z.string().trim().max(260).optional().default('')
});
type Turn=z.infer<typeof coachTurnSchema>;
const axesForField:Partial<Record<Field,Topic>>={title:'scene',situation:'scene',stakeholders:'people',need:'people',impact:'impact',success:'success',evidence:'evidence',workaround:'workaround',department:'department',domain:'domain',scope:'scope',frequency:'frequency',ownership:'ownership',coOwners:'coOwners',initialSolutionStatus:'trialStatus',initialSolution:'trialDetail',initialSolutionOutcome:'trialOutcome'};
const prompts:Record<Topic,[string,string]>={
 scene:['تذكّر آخر مرة واجهت فيها هذه الصعوبة في عملك: ماذا حدث؟','لو رافقتك في يوم عمل عادي، ما الموقف الذي سأراه بنفسي؟'],
 friction:['عند أي خطوة تحديدًا تعذّر على الشخص أن يكمل ما بدأه؟','قبل أن يتوقف العمل مباشرة، ما آخر خطوة استطاع الشخص إتمامها؟'],
 people:['من كان يحتاج إلى إتمام الخطوة المتعثّرة في ذلك الموقف؟','لو روى الموقف الشخص المتأثر به، ما الذي كان يحاول إنجازه؟'],
 impact:['ماذا حدث بعد هذا التعثّر ولم يكن ليحدث لو سارت الخطوة كما ينبغي؟','ما الفرق الذي لاحظه الموظف أو المستفيد بسبب ما حدث؟'],
 success:['لو تكرر الموقف غدًا بعد تحسّنه، ما أول فرق يمكن للشخص ملاحظته؟','ما الذي سيصبح بإمكان المتأثر إنجازه ولم يكن ممكنًا اليوم؟'],
 verify:['ما الملاحظة التي جعلتك ترجّح هذا التفسير؟','ما الذي رأيته بنفسك ويمكن أن يساعدنا في التحقق من هذا الاحتمال؟'],
 evidence:['ما المثال أو الملاحظة التي يمكن لزميلك الاستناد إليها لفهم الأثر؟','هل لديك شاهد وصفي على ما حدث، حتى لو لم توجد أرقام؟'],
 workaround:['عندما تتعطّل هذه الخطوة اليوم، كيف يكمل الشخص عمله؟','كيف تجاوزه الشخص في آخر مرة؟'],
 frequency:['متى يتكرر هذا الموقف عادةً؟','هل يرتبط الموقف بإجراء معيّن أم يظهر دون نمط واضح؟'],
 scope:['لمن سيظهر المشروع إذا نجح: لمنسوبي المؤسسة أم لأطراف خارجية أم للطرفين؟','من تتوقع أن يستخدم ما سيبنيه الفريق؟'],
 domain:['إلى أي مجال من أعمال المؤسسة يرتبط التحدي بصورة أقرب؟','أين يظهر التحدي أكثر في عمل المؤسسة؟'],
 department:['ما الجهة أو الفريق الذي يتأثر بهذه الخطوة؟','أي الفرق تواجه هذا الموقف في عملها؟'],
 ownership:['هل تتبنى التحدي بمفردك أم معك زملاء؟','كيف نعرض ملكية التحدي: لك وحدك أم لفريق؟'],
 coOwners:['ما أسماء شركائك أو اسم الفريق الذي تود إظهاره في البطاقة بموافقتهم؟','بأي اسم يوافق شركاؤك على ظهورهم في البطاقة؟'],
 trialStatus:['هل سبق أن جرّبت شيئًا لمعالجة التحدي بالفعل؟','هل ما وصفته اقتراح للمستقبل أم تجربة نُفّذت بالفعل؟'],
 trialDetail:['ما الذي جرّبتموه فعليًا في الموقف الذي وصفته؟','كيف طُبّقت المحاولة الأولى في العمل؟'],
 trialOutcome:['بعد التجربة، ما الذي تغيّر وما الذي بقي صعبًا؟','ما الذي لاحظته بعد التجربة، حتى لو لم تُقَس نتيجتها بعد؟'],
 review:['',''],pause:['','']
};
const arabicDigits='٠١٢٣٤٥٦٧٨٩',persianDigits='۰۱۲۳۴۵۶۷۸۹';
function norm(s:string){return s.normalize('NFKC').toLowerCase().replace(/[٠-٩]/g,d=>String(arabicDigits.indexOf(d))).replace(/[۰-۹]/g,d=>String(persianDigits.indexOf(d))).replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
const words=(s:string)=>s.split(/\s+/);
function grounded(q:string,source:string[]){const needle=norm(q);return !!needle&&source.some(s=>[' ',' و',' ف'].some(prefix=>(' '+s+' ').includes(prefix+needle+' ')))}
const uncertainty=/(?:^| )(?:ربما|اظن|نظن|اعتقد|نتوقع|اتوقع|افترض|محتمل|يمكن ان|يمكن انه|في ظني|على الارجح|احتمال)(?: |$)/;
const unknown=/(?:لا (?:ادري|اعلم|اعرف|نعرف|اتذكر|يوجد|نملك|استطيع)|ما (?:اعرف|ادري|اذكر|عندي|عندنا|نقدر)|لم (?:نقس|نقسه|نقيس|يتضح)|ما قسنا|غير (?:معلوم|معروف|مقاس|متاكد)|ليس لدي|ما عندي|مدري|ماني متاكد|ما سجلنا)/;
function ideaOnly(s:string){
 const t=norm(s);return t.length<200&&/(نحتاج|نبغ[اي]|ابغ[اي]|اريد|نريد|نبي|ودي|اقترح|فكرتي|انشاء|تطوير|تصميم|بناء|اود|برايي)/.test(t)&&/(منصه|منصة|نظام|تطبيق|اداة|بوابة|موقع|روبوت|اتمتة|برنامج|لوحة)/.test(t)&&!/(اخر مر|امس|عندما|لما |كلما|كل اسبوع|نتاخر|تتاخر|تتعطل|تعطل|اضطر|نضطر|اضطررنا|ضاعت|تضيع|نفقد|فقدنا|كررنا|نعيد|ارجعنا|تكرر|واجه|يعاني|لاحظ|ننتظر|انتظر|جربنا|ما زال|لا نستطيع|لا يستطيع|لا نعرف|صعوبة|يصعب|غير واضح)/.test(t)
}
// A generic wish is not an observed episode, even when it is restated for every field.
function generalWish(s:string){
 const t=norm(s);
 return t.length<105&&/^(?:(?:نحتاج|نريد|الهدف|المطلوب) (?:الي )?)?(?:تحسين (?:العمل|الاداء|التواصل|الكفاءة|الاجراءات)|رفع الكفاءة|الاجراءات (?:بطيئة|معقدة|صعبة)|العمل (?:بطيء|صعب)|التنسيق (?:ضعيف|غير جيد)|هناك مشكلة)(?: (?:بشكل عام|جدا|عامه|في المؤسسة|في العمل))?$/.test(t);
}
function bland(q:string){return /^(?:هل (?:يمكنك|ممكن) (?:التوضيح|ان توضح|توضح)(?: اكثر)?|هل (?:لديك|هناك) تفاصيل (?:اضافية|اخري)|ما (?:هو )?(?:اثر|سبب) (?:هذا )?التحدي|ما الاثر المتوقع|اخبرني (?:بالمزيد|اكثر)|هل لديك مثال)[ ؟?]*$/.test(norm(q))}
function numsSupported(value:string,corpus:string[]){return (norm(value).match(/\p{N}+/gu)||[]).every(n=>corpus.some(s=>words(s).includes(n)))}
function oneQuestion(q:string){const t=q.replace(/\s+/g,' ').trim(),signs=t.match(/[؟?]/g)||[];return !isReviewInvitation(t)&&t.length>=8&&t.length<=340&&signs.length===1&&/[؟?]$/.test(t)?t:''}
function excerpt(text:string,max:number){return text.length<=max?text:text.slice(0,max).replace(/\s+\S*$/,'')+'…'}
function keyQuestion(q:string){return norm(q.split(/\n+/).at(-1)||'')}
function unknownLabel(t:string){return unknown.test(norm(t))}
const metadata=new Set<Topic>(['frequency','scope','domain','department','ownership','coOwners','trialStatus']);
const allowedEnum:Partial<Record<Field,readonly string[]>>={ownership:['individual','shared'],initialSolutionStatus:['none','implemented'],scope:scopes,domain:domains,frequency:frequencies};
function withChanges(before:ChatDraft,updates:Turn['updates'],sources:string[],onlyIdea:boolean,messages:Message[],focus?:Topic){
 const draft={...before};
 for(const u of updates){
  if(u.field==='author'||!grounded(u.quote,sources)||!numsSupported(u.value,sources))continue;
  if(onlyIdea&&u.field!=='domain'&&u.field!=='assumptions')continue;
  if(uncertainty.test(norm(u.quote))&&u.field!=='assumptions'&&!uncertainty.test(norm(u.value)))continue;
  if(u.field==='frequency'&&u.value){
   // An isolated model quote like «سنوي» could come from «تقرير سنوي».
   // Interpret the participant's whole statement in its actual question context.
   for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.role==='user'&&grounded(u.quote,[norm(m.content)])){const f=messageCadence(messages,i,focus);if(f){draft.frequency=f;break;}}}
   continue;
  }
  if(allowedEnum[u.field]&&u.value&&!allowedEnum[u.field]!.includes(u.value))continue;
  if(!u.value&&!/(تصحيح|صحح|امسح|الغ|احذف|خطا|تراجع|لم يعد|ليس صحيحا)/.test(norm(u.quote)))continue;
  if(u.field==='coOwners'&&u.value&&!words(norm(u.value)).filter(w=>w!=='و').every(w=>sources.some(x=>(' '+x+' ').includes(' '+w+' ')||(' '+x+' ').includes(' و'+w+' '))))continue;
  if(chatDraftSchema.shape[u.field].safeParse(u.value).success)draft[u.field]=u.value;
 }
 if(draft.ownership==='individual')draft.coOwners='';
 if(draft.initialSolutionStatus==='none'){draft.initialSolution='';draft.initialSolutionOutcome=''}
 return draft;
}
function choose(options:Topic[],wanted:Topic,asked:Topic[],past:string[],q:string){
 const choices=[...new Set(options)];
 const count=(t:Topic)=>asked.filter(k=>k===t).length;
 const duplicate=!q||past.some(p=>keyQuestion(p)===keyQuestion(q));
 if(choices.includes(wanted)&&!duplicate&&!(asked.slice(-2).length===2&&asked.slice(-2).every(t=>t===wanted)))return wanted;
 const ranks=choices.map((t,i)=>({t,n:(asked.at(-1)===t?4:0)+count(t),i})).sort((a,b)=>a.n-b.n||a.i-b.i);
 return ranks[0]?.t||'pause';
}
function nextFallback(focus:Topic,past:string[],asked:Topic[],anchor=''){
 const pair=prompts[focus],order=asked.includes(focus)?[pair[1],pair[0]]:[...pair];
 if(anchor&&anchor.length<=100&&!/[؟?@]|https?:|[0-9٠-٩]{7,}/.test(anchor)){
  const phrasing:Partial<Record<Topic,string>>={impact:'قلت: «'+anchor+'». ماذا ترتّب على ذلك للشخص المتأثر؟',friction:'وصفت الموقف بقولك: «'+anchor+'». عند أي خطوة تعذّر الاستمرار؟',people:'ذكرت: «'+anchor+'». من كان يحاول إتمام هذه الخطوة؟',success:'ذكرت: «'+anchor+'». إذا تغيّر هذا الوضع، ما الفرق الذي ستلاحظه في العمل؟'};
  if(phrasing[focus])order.unshift(phrasing[focus]!);
 }

 return order.find(q=>!past.some(m=>keyQuestion(q)===keyQuestion(m)))||'';
}
export type CoachContext={draft:ChatDraft;messages:Message[];interview?:InterviewState;existing?:Partial<Challenge>|null};
export function guideTurn(context:CoachContext,turn:Turn){
 const {messages,existing}=context,prior=context.draft;
 const control=controlTurn(context);if(control)return control;
 const users=messages.filter(m=>m.role==='user').map(m=>m.content);
 const past=messages.filter(m=>m.role==='assistant').map(m=>m.content);
 // A saved card or an older, already-started conversation is a baseline. New assistants' prose is never evidence.
 const baseline=existing||(!context.interview&&prior.situation?prior:null);
 const sources=[...users,...(baseline?Object.values(baseline).filter((s):s is string=>typeof s==='string'):[])].map(norm);
 const firstIdea=!existing&&!prior.situation&&users.length>0&&users.every(ideaOnly);
 const broadOpening=firstIdea||(!existing&&!prior.situation&&users.length>0&&users.every(generalWish));
 const draft=recoverMetadata(withChanges(prior,turn.updates,sources,broadOpening,messages,context.interview?.asked.at(-1)),messages,existing,prior,context.interview?.asked.at(-1));

 const known=new Map<Axis,Signal>((context.interview?.signals||[]).map(s=>[s.axis,s]));
 for(const s of turn.signals){
  if(broadOpening||!grounded(s.quote,sources))continue;
  const t=norm(s.quote);const status=s.status==='observed'&&uncertainty.test(t)?'tentative':s.status;
  // A short acknowledgement or a denial alone is not an observed scene or effect.
  if(status==='observed'&&(words(t).length<2||ideaOnly(s.quote)||generalWish(s.quote)||/^(نعم|اي نعم|صحيح|لا اعرف|ما ادري|لا يوجد|غير معروف)$/.test(t)))continue;
  if(status==='unknown'&&!unknownLabel(s.quote)&&!/(نتجاوز|تجاوز|نترك|لاحقا|تخط|تخطي|لا اتذكر)/.test(t))continue;
  const old=known.get(s.axis);
  if(!existing&&old&&norm(old.quote)!==t&&/(?:تصحيح|اقصد|للتوضيح|الصحيح|قصدي|لم يكن|مو صحيح)/.test(norm(users.at(-1)||''))){
   // If the same corrected fact was quoted in another field, do not leave a contradictory copy.
   for(const field of ['situation','impact','evidence','success','workaround'] as const){
    if(draft[field]===prior[field]&&norm(draft[field])===norm(old.quote))draft[field]=s.quote;
   }
  }
  known.set(s.axis,{...s,status});
 }
 const asked=context.interview?.asked||[],missing=missingFields(draft),q=oneQuestion(turn.question),missingTopics=[...new Set(missing.map(k=>axesForField[k as Field]).filter((x):x is Topic=>!!x))];
 const gaps=axes.filter(a=>!known.has(a)||known.get(a)!.status==='tentative');
 const needsTrialOutcome=draft.initialSolutionStatus==='implemented'&&!!draft.initialSolution&&!draft.initialSolutionOutcome&&!asked.includes('trialOutcome')&&(!existing||challengeGaps(existing).some(g=>['initialSolutionStatus','initialSolution'].includes(g.key)));
 let options:Topic[];
 if(existing){options=[...new Set(challengeGaps(draft).map(g=>axesForField[g.key]).filter((t):t is Topic=>!!t))];if(!options.length&&needsTrialOutcome)options=['trialOutcome']}
 else if(broadOpening)options=['scene'];
 else if(missing.length&&missing.every(k=>['frequency','domain','scope','department','ownership','coOwners','initialSolutionStatus'].includes(k)))options=missingTopics;
 else if(gaps.length){
  options=[...gaps];const scene=known.get('scene')?.status==='observed'||known.get('friction')?.status==='observed';
  if(scene&&known.size&&turn.focus==='verify'&&!asked.includes('verify')&&(draft.assumptions||[...known.values()].some(s=>s.status==='tentative')))options.unshift('verify');
  if(scene&&['workaround','evidence','trialDetail','trialOutcome'].includes(turn.focus)&&!asked.includes(turn.focus)&&((!draft.workaround&&turn.focus==='workaround')||(!draft.evidence&&turn.focus==='evidence')||(turn.focus==='trialDetail'&&draft.initialSolutionStatus==='implemented'&&!draft.initialSolution)||(turn.focus==='trialOutcome'&&needsTrialOutcome)))options.unshift(turn.focus);
  if(!scene&&gaps.includes('scene')&&(!known.size||metadata.has(turn.focus)))options=['scene',...gaps.filter(a=>a!=='scene')];
 }else{options=missingTopics.filter(t=>known.get(t as Axis)?.status!=='unknown');if(needsTrialOutcome)options.unshift('trialOutcome')}
 const anchor=known.get('friction')?.quote||known.get('scene')?.quote||'';
 const observed=(a:Axis)=>known.get(a)?.status==='observed';
 const hasEpisode=(observed('scene')||observed('friction'))&&(observed('people')||observed('impact'));
 const canReview=!missing.length&&(!!existing||(!gaps.length&&hasEpisode))&&!needsTrialOutcome;
 let focus:Topic=canReview?'review':choose(options,turn.focus,asked,past,q);
 const gainedFact=missingFields(prior).some(k=>!missing.includes(k))||[...known.values()].some(s=>{
  const old=context.interview?.signals.find(x=>x.axis===s.axis);return !old||old.status!==s.status;
 });
 const noProgress=gainedFact?0:Math.min(3,(context.interview?.noProgress||0)+1);
 // Count attempts, not wording: a rephrased question is still the same dead end.
 if(!canReview&&noProgress>=2&&asked.length>=2)focus='pause';
 if(!canReview&&!gainedFact&&asked.slice(-2).length===2&&asked.slice(-2).every(t=>t===focus))focus='pause';
 let question='',reflection='';
 if(focus==='review'){
  reflection=existing?'إضافاتك جاهزة للمراجعة. راجعها ثم احفظها لتظهر في بطاقة التحدي.':[excerpt(draft.situation,250),excerpt(draft.impact,200),draft.success?'علامة التحسّن التي وصفتها: '+excerpt(draft.success,160):'','هذه خلاصة ما فهمته. راجع البطاقة أو صحّح لي أي تفصيل قبل النشر.'].filter(Boolean).join('\n\n');
 }else if(focus!=='pause'){
  const valid=focus===turn.focus&&q&&!bland(q)&&!past.some(m=>keyQuestion(m)===keyQuestion(q))&&numsSupported(q,sources);
  question=valid?q:nextFallback(focus,past,asked,anchor);
  if(!question){
   const alt=options.find(t=>t!==focus&&nextFallback(t,past,asked,anchor));if(alt){focus=alt;question=nextFallback(alt,past,asked,anchor)}else focus='pause';
  }
  if(valid&&turn.reflection&&!/[؟?]/.test(turn.reflection)&&!/(جاهز[ةه]? (?:للنشر|للمراجعة)|اكتملت البطاقة|تم النشر)/.test(turn.reflection)&&numsSupported(turn.reflection,sources))reflection=turn.reflection;
  else if(firstIdea)reflection='هذا اتجاه محتمل للحل. لنحدّد الموقف الذي دفعك إليه.';
  else{const anchor=turn.signals.find(s=>known.get(s.axis)?.quote===s.quote&&s.status==='observed');if(anchor&&anchor.quote.length<=110&&!question.includes(anchor.quote))reflection='ذكرت: «'+anchor.quote+'».'}
 }
 const state:InterviewState={version:1,signals:[...known.values()],asked:[...asked,focus].slice(-18),noProgress};
 // Less formulaic finish requests may also contain a final correction. Extract the
 // supported changes first, then open review only with a quote from this user's turn.
 if(turn.focus==='review'&&turn.reviewRequestQuote&&grounded(turn.reviewRequestQuote,[norm(users.at(-1)||'')]))return reviewHandoff(draft,{...state,asked},!!existing);
 if(focus==='pause')return remainingTurn(draft,{...state,asked});
 return {message:[reflection,question].filter(Boolean).join('\n\n').slice(0,1800),draft,ready:canReview,missing:missing.map(k=>chatFields[k as Field]),interview:state};
}
