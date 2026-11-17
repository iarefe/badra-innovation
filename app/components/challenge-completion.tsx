"use client";
import {useIntake,requestIntakeUpdate} from './intake-state';
import {useState} from 'react';
import {ArrowUpLeft,ArrowRight,Check,ClipboardPen,LoaderCircle,MessageSquare,ShieldCheck,Sparkles} from 'lucide-react';
import {challengeExtras,scopes,domains,frequencies,type Challenge,type Entry} from '@/lib/challenges';
import {allowedSupplements,canSupplement,challengeGaps} from '@/lib/challenge-completion';
import {chatFields} from '@/lib/ai-challenge';
import ChallengeChat from './lazy-challenge-chat';
import {useChatRegistry} from './chat-session-context';
import {CoverImage} from './challenge-cover';

type NoticeProps={entry:Entry;compact?:boolean;finalized?:boolean;onEdit:(entry:Entry)=>void;onSaved:(id:string,challenge:Challenge)=>void};
export default function ChallengeCompletion({entry,compact=false,finalized=false}:NoticeProps){
 const gaps=challengeGaps(entry.challenge);
 if(!entry.mine||entry.example||!gaps.length)return null;
 const canStart=entry.status!=='published'||canSupplement(entry.challenge);
 return <aside className={'completion-notice'+(compact?' compact':'')} aria-label="اقتراح استكمال التحدي">
  <div className="completion-heading"><Sparkles size={19}/><div><strong>{compact?'أكمل تحدّيك مع بذرة':'تفاصيل قليلة تجعل تحدّيك أوضح'}</strong><p>{compact?`متبقٍ ${gaps.length.toLocaleString('ar-SA')} تفاصيل. يساعدك بذرة على إكمالها بسؤال كل مرة.`:'اقتراح خاص بك بصفتك صاحب التحدي. يمكنك استكمال ما ينقص بطاقتك مع مساعد بذرة:'}</p></div></div>
  {!compact&&<ul>{gaps.map(g=><li key={g.key}>{g.label}</li>)}</ul>}
  {finalized?<p className="completion-footnote">يمكنك الاستكمال بعد أن يعيد مدير النظام فتح التحديات المعتمدة.</p>:<a data-badra-anchor="complete-challenge" className={compact?'text-link':'button orange small'} href={'/challenge/'+entry.id+(canStart?'/complete':'?review=1')}>{canStart?'أكمل مع مساعد بذرة':'راجع التفاصيل مع بذرة'} <ArrowUpLeft size={16}/></a>}
 </aside>;
}

type WorkspaceProps={entry:Entry;participantKey:string;finalized:boolean;onSaved:(id:string,challenge:Challenge)=>void};
export function CompletionWorkspace({entry,participantKey,finalized,onSaved}:WorkspaceProps){
 const intake=useIntake(),mayPublish=!intake||intake.phase==='open';
 const [view,setView]=useState<'chat'|'review'>('chat'),[draft,setDraft]=useState<Challenge>({...challengeExtras,...entry.challenge});
 const chatRegistry=useChatRegistry();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const gaps=challengeGaps(entry.challenge),keys=new Set(gaps.map(g=>g.key));
 const ownership=keys.has('ownership'),trial=keys.has('initialSolutionStatus'),published=entry.status==='published';
 const update=(key:keyof Challenge,value:string)=>setDraft(d=>({...d,[key]:value}));
 function returnToChat(){if(chatRegistry.get({participantKey,completion:entry}).replaceDraft(draft))setView('chat');else setError('انتظر اكتمال رد بذرة، ثم عد للمحادثة. تعديلاتك هنا محفوظة.')}
 function review(value:Challenge){setDraft(value);setError('');setView('review');window.scrollTo({top:0,behavior:'smooth'})}
 async function save(event:React.FormEvent){
  event.preventDefault();if(busy)return;
  if(challengeGaps(draft).length){setError('أكمل التفاصيل الظاهرة قبل الحفظ. يمكنك العودة للمساعد لمتابعتها.');return;}
  setBusy(true);setError('');
  try{
   const allowed=allowedSupplements(entry.challenge,draft),fields=Object.fromEntries([...allowed].map(key=>[key,draft[key]]));
   const response=await fetch(published?'/api/challenge-completion':'/api/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(published?{id:entry.id,fields}:{id:entry.id,challenge:draft,submit:mayPublish})});
   const data:any=await response.json();if(!response.ok){if(data.code==='INTAKE_CLOSED')requestIntakeUpdate();throw Error(data.error||'تعذّر حفظ التفاصيل.')}
   chatRegistry.remove(participantKey,entry.id);
   onSaved(entry.id,{...challengeExtras,...(data.challenge||draft)});
  }catch(e){setError(e instanceof Error?e.message:'تعذّر الاتصال. احتفظ بما كتبته وحاول مجددًا.');}finally{setBusy(false)}
 }
 if(finalized||!gaps.length||published&&!canSupplement(entry.challenge))return <section className="wrap completion-page"><a className="back-link" href={'/challenge/'+entry.id}><ArrowRight size={17}/> العودة إلى التحدي</a><div className="collection-empty"><Check size={30}/><h2>{!gaps.length?'تفاصيل تحدّيك مكتملة.':'الاستكمال غير متاح الآن.'}</h2><p>{finalized?'يمكن الاستكمال بعد أن يعيد المدير فتح التحديات المعتمدة.':'يمكنك الرجوع إلى البطاقة للاطلاع على أحدث بياناتها.'}</p></div></section>;
 return <section className="wrap completion-page">
  <div className="completion-page-top"><a className="back-link" href={'/challenge/'+entry.id}><ArrowRight size={17}/> العودة إلى تحدّيك</a><ol aria-label="خطوات استكمال التحدي"><li aria-current={view==='chat'?'step':undefined}><span>1</span>أكمل مع بذرة</li><li aria-current={view==='review'?'step':undefined}><span>2</span>راجع واحفظ</li></ol></div>
  <div className="completion-challenge-context"><div className="completion-context-cover"><CoverImage entry={entry}/></div><div><span>{published?'تحدّيك المنشور':'تحدّيك المحفوظ'}</span><h2>{entry.challenge.title}</h2><p><ShieldCheck size={14}/>{published?'وصفك الحالي وأصوات التحدي محفوظة. تُضاف التفاصيل بعد مراجعتك.':mayPublish?'بياناتك السابقة محفوظة. أكمل النواقص، ثم انشر البطاقة مباشرة.':'أُغلق الاستقبال؛ يمكنك حفظ التفاصيل في مسودتك الخاصة.'}</p></div></div>
  {view==='chat'?<ChallengeChat key={entry.id} participantKey={participantKey} completion={entry} initialDraft={draft} onReview={review} onManual={review}/>:<div className="completion-review-layout">
   <aside className="completion-review-intro"><span className="eyebrow">الخطوة الأخيرة</span><h1>إضافاتك،<br/>{!published&&!mayPublish?'في مسودتك الخاصة.':'كما ستظهر للآخرين.'}</h1><p>راجع ما استخلصه بذرة من إجاباتك، وصحّح أي تفصيل قبل الحفظ.</p><button type="button" className="button ghost" disabled={busy} onClick={returnToChat}><MessageSquare size={17}/> العودة للمحادثة</button><div className="completion-review-assurance"><ShieldCheck size={20}/><p>{published?'يبقى تحدّيك منشورًا، وتُحفظ أصواته ورغبات الانضمام.':mayPublish?'تُنشر البطاقة مباشرة وتظهر في صفحة التحديات.':'تبقى هذه المسودة خاصة بعد الحفظ.'}</p></div></aside>
   <form className="completion-review-form" onSubmit={save}><div className="completion-review-heading"><ClipboardPen size={22}/><div><h2>راجع التفاصيل الجديدة</h2><p>هذه الحقول فقط هي التي تستكملها.</p></div></div>
   {gaps.filter(g=>!['need','ownership','coOwners','initialSolutionStatus','initialSolution'].includes(g.key)).map(g=><label className="field" key={g.key}>{chatFields[g.key]}{['scope','domain','frequency'].includes(g.key)?<select value={draft[g.key]} required disabled={busy} onChange={e=>update(g.key,e.target.value)}><option value="">اختر…</option>{(g.key==='scope'?scopes:g.key==='domain'?domains:frequencies).map(value=><option key={value}>{value}</option>)}</select>:<textarea value={draft[g.key]} required rows={3} disabled={busy} maxLength={({title:110,department:100,situation:1200,stakeholders:500,impact:1000,evidence:700,workaround:700,success:500} as Record<string,number>)[g.key]||700} onChange={e=>update(g.key,e.target.value)}/>}</label>)}
   {keys.has('need')&&<label className="field">ما الذي يحاول المتأثرون إنجازه؟<small>صف احتياجهم أو المهمة التي تتعثر، دون اشتراط حل معين.</small><textarea required minLength={10} maxLength={500} rows={3} value={draft.need} disabled={busy} onChange={e=>update('need',e.target.value)} placeholder="يحتاجون إلى… لكي يتمكنوا من…"/></label>}
   {ownership&&<label className="field">هل تتبنى التحدي بمفردك أم مع فريق؟<select required value={draft.ownership} disabled={busy} onChange={e=>update('ownership',e.target.value)}><option value="">اختر…</option><option value="individual">أتبناه بمفردي</option><option value="shared">معي زملاء أو فريق</option></select></label>}
   {(keys.has('coOwners')||ownership&&draft.ownership==='shared')&&<label className="field">أسماء الشركاء أو اسم الفريق<small>تظهر هذه الأسماء مع التحدي بموافقتهم.</small><textarea required minLength={2} maxLength={500} rows={2} value={draft.coOwners} disabled={busy} onChange={e=>update('coOwners',e.target.value)}/></label>}
   {trial&&<label className="field">هل جرّبت حلًا أوليًا؟<select required value={draft.initialSolutionStatus} disabled={busy} onChange={e=>update('initialSolutionStatus',e.target.value)}><option value="">اختر…</option><option value="none">لم أنفّذ حلًا أوليًا بعد</option><option value="implemented">نعم، نفّذت تجربة أو حلًا أوليًا</option></select></label>}
   {(keys.has('initialSolution')||trial&&draft.initialSolutionStatus==='implemented')&&<><label className="field">ما الذي نفّذته بالفعل؟<textarea required minLength={10} maxLength={1200} rows={3} value={draft.initialSolution} disabled={busy} onChange={e=>update('initialSolution',e.target.value)} placeholder="جرّبنا… مع… وكانت التجربة…"/></label>{!entry.challenge.initialSolutionOutcome?.trim()&&<label className="field">ماذا كانت النتيجة؟ <small>اختياري؛ اكتب ما لاحظته فقط.</small><textarea maxLength={700} rows={2} value={draft.initialSolutionOutcome} disabled={busy} onChange={e=>update('initialSolutionOutcome',e.target.value)}/></label>}</>}

   {error&&<p className="error" role="alert">{error}</p>}
   <p className="completion-footnote">{published?'تظهر التفاصيل بعد حفظها في بطاقة التحدي.':mayPublish?'تظهر البطاقة للجميع فور نشرها.':'تُحفظ التعديلات في المسودة فقط.'} تجنّب المعلومات السرية، وأضف أسماء شركائك بموافقتهم.</p>
   <div className="completion-actions"><button data-badra-anchor="review-challenge" type="submit" className="button orange" disabled={busy}>{busy?<><LoaderCircle size={16} className="spin"/>جارٍ الحفظ…</>:<><Check size={17}/>{published?'حفظ الإضافات في التحدي':mayPublish?'نشر التحدي':'حفظ المسودة دون نشر'}</>}</button><button type="button" className="text-link" disabled={busy} onClick={returnToChat}>متابعة مع بذرة</button></div>
   </form>
  </div>}
 </section>;
}
