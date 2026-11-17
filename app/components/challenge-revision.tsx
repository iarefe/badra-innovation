'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,FilePenLine,LoaderCircle,MessageSquareText,PenLine,Sparkles,X} from 'lucide-react';
import type {Challenge,Entry} from '@/lib/challenges';
import {chatFields,chatFieldLimits} from '@/lib/ai-challenge';
import {changesBetween,displayValue,fieldVisible,issueForChanges,revisionGroups,revisionOptions,revisedCard,type CardReview,type RevisionField,type RevisionMode,type RevisionPatch,type ReviewFinding} from '@/lib/challenge-revision';

type Snapshot={id:string;version:number;status:string;challenge:Challenge};
type Props={entry:Entry;mode:RevisionMode;onClose:()=>void;onSaved:(id:string,card:Challenge)=>void};
type View=RevisionMode|'confirm';
const endpoint='/api/challenge-revision';
class RequestError extends Error{constructor(message:string,readonly code?:string){super(message)}}
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const r=await fetch(url,{cache:'no-store',...init}),data=await r.json().catch(()=>null);
 if(!r.ok||!data){const problem=data as {error?:string;code?:string}|null;throw new RequestError(problem?.error||'تعذّر تنفيذ الطلب. حاول مجددًا.',problem?.code)}return data as T;
}
const message=(e:unknown)=>e instanceof RequestError?e.message:'تعذّر الاتصال. احتفظ بتعديلاتك في هذه النافذة وحاول مجددًا.';
function ChangePair({field,before,after}:{field:RevisionField;before:string;after:string}){
 return <div className="br-pair"><div><span>النص الحالي</span><p>{displayValue(field,before)||'لم يُذكر بعد'}</p></div><div><span>بعد التعديل</span><p>{displayValue(field,after)||'تُزال هذه القيمة'}</p></div></div>;
}
function Finding({f,card,put}:{f:ReviewFinding;card:Challenge;put:(field:RevisionField,value:string)=>void}){
 const [value,setValue]=useState(f.proposal),[staged,setStaged]=useState(''),[skipped,skip]=useState(false);
 const current=card[f.field]||'',original=useRef(current).current,proposed=!!f.proposal;
 const candidate=(proposed?value:[original.trim(),value.trim()].filter(Boolean).join('\n')).trim(),applied=!!staged&&staged===current;
 if(skipped)return <div className="br-skipped"><span>{chatFields[f.field]} · تجاوزت هذه الملاحظة</span><button type="button" onClick={()=>skip(false)}>إظهار</button></div>;
 return <article className="br-finding"><div className="br-row"><strong>{chatFields[f.field]}</strong><button type="button" className="br-text" onClick={()=>skip(true)}>تجاوز</button></div>
  <p>{f.reason}</p><div className="br-original"><small>في بطاقتك</small><p>{original||'لم يُذكر بعد'}</p></div>
  <label className="br-field"><span>{proposed?'صياغة بذرة المقترحة':f.question}</span><textarea value={value} onChange={e=>setValue(e.target.value)} rows={proposed?3:2} maxLength={chatFieldLimits[f.field]} placeholder={proposed?undefined:'اكتب ما تعرفه ليُضاف إلى النص الحالي'}/></label>
  {candidate.length>chatFieldLimits[f.field]&&<p className="br-error">يتجاوز النص بعد الإضافة الحد المتاح. اختصره أو عدّله يدويًا.</p>}
  <button type="button" className="br-outline" disabled={!value.trim()||applied||candidate===current||candidate.length>chatFieldLimits[f.field]} onClick={()=>{put(f.field,candidate);setStaged(candidate)}}>{applied?<><Check size={15}/>أُضيف إلى تعديلاتك</>:proposed?'استخدم هذه الصياغة':'أضف توضيحي إلى البطاقة'}</button>
 </article>;
}

export default function ChallengeRevision({entry,mode,onClose,onSaved}:Props){
 const dialog=useRef<HTMLDialogElement>(null),work=useRef<AbortController|null>(null),saving=useRef(false);
 const [base,setBase]=useState<Snapshot|null>(null),[draft,setDraft]=useState<Challenge>(entry.challenge),[view,setView]=useState<View>(mode),[field,setField]=useState<RevisionField>('title');
 const [busy,setBusy]=useState<''|'load'|'assess'|'save'>('load'),[error,setError]=useState(''),[stale,setStale]=useState(false),[collisions,setCollisions]=useState<RevisionField[]>([]);
 const [review,setReview]=useState<CardReview|null>(null),[generation,setGeneration]=useState(0),[reviewed,setReviewed]=useState(''),[note,setNote]=useState('');
 const [discard,setDiscard]=useState(false);
 const effective=base?revisedCard(base.challenge,draft):draft,changes=base?changesBetween(base.challenge,effective):{},keys=Object.keys(changes) as RevisionField[];
 const fieldKey=fieldVisible(field,effective)?field:'title',frozenBusy=busy==='load'||busy==='save',published=base?.status==='published'||(!base&&entry.status==='published');
 function failed(e:unknown){setError(message(e));if(e instanceof RequestError&&e.code==='changed')setStale(true)}
 function put(k:RevisionField,v:string){setDraft(s=>({...s,[k]:v}));setError('')}
 function close(){if(saving.current)return;if(keys.length){setDiscard(true);return}onClose()}
 const closeRef=useRef(close);closeRef.current=close;
 async function assess(snapshot:Snapshot,fields:RevisionPatch,clarification:string,signal:AbortSignal){
  setError('');setBusy('assess');
  try{const data=await request<{review:CardReview}>(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:snapshot.id,version:snapshot.version,fields,clarification}),signal});
   if(!signal.aborted){setReview(data.review);setGeneration(n=>n+1);setReviewed(JSON.stringify(fields))}}
  catch(e){if(!signal.aborted)failed(e)}finally{if(!signal.aborted)setBusy('')}
 }
 function startAssessment(){if(!base||busy||stale)return;work.current?.abort();const c=new AbortController();work.current=c;void assess(base,changes,note,c.signal)}
 async function load(signal:AbortSignal,previous?:Snapshot,patch:RevisionPatch={}){
  setError('');setBusy('load');
  try{const latest=await request<Snapshot>(endpoint+'?id='+encodeURIComponent(entry.id),{signal});if(signal.aborted)return;
   setBase(latest);setDraft({...latest.challenge,...patch} as Challenge);setStale(false);
   if(previous){setCollisions((Object.keys(patch) as RevisionField[]).filter(k=>(previous.challenge[k]||'')!==(latest.challenge[k]||'')&&patch[k]!==latest.challenge[k]));setView('confirm');setReview(null);setBusy('')}
   else if(mode==='assess'){await assess(latest,{},'',signal)}else setBusy('');
  }catch(e){if(!signal.aborted){failed(e);setBusy('')}}
 }
 function reload(){if(busy)return;work.current?.abort();const c=new AbortController();work.current=c;void load(c.signal,base||undefined,changes)}
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,dlg=dialog.current;
  if(dlg&&!dlg.open)dlg.showModal();
  const c=new AbortController();work.current=c;void load(c.signal);
  return()=>{work.current?.abort();dlg?.close();if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[entry.id,mode]);
 function switchView(next:View){if(next!=='assess'&&busy==='assess'){work.current?.abort();setBusy('')}setView(next);setDiscard(false);if(next==='assess'&&!review&&!busy)startAssessment()}
 async function save(){
  if(!base||busy||stale||collisions.length||!keys.length||saving.current)return;
  const issue=issueForChanges(base.challenge,changes);if(issue){setError(issue);return}
  setBusy('save');setError('');saving.current=true;
  const c=new AbortController();work.current?.abort();work.current=c;
  try{const result=await request<Snapshot>(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:base.id,version:base.version,fields:changes}),signal:c.signal});if(!c.signal.aborted)onSaved(result.id,result.challenge)}
  catch(e){if(!c.signal.aborted)failed(e)}finally{saving.current=false;if(!c.signal.aborted)setBusy('')}
 }
 const options=revisionOptions[fieldKey],value=effective[fieldKey]||'';
 return <dialog ref={dialog} className="br-dialog" dir="rtl" aria-labelledby="br-title" onCancel={e=>{e.preventDefault();closeRef.current()}}>
 <div className="br-layout"><header className="br-head"><img src="/placeholder.svg" width="51" height="57" alt=""/><div><small>بذرة · خبير بطاقات التحدي</small><h2 id="br-title">{entry.challenge.title}</h2></div><button autoFocus type="button" className="br-x" aria-label="إغلاق محرّر البطاقة" disabled={busy==='save'} onClick={close}><X size={20}/></button></header>
 <div role="group" aria-label="أدوات مراجعة البطاقة" className="br-nav">
  <button type="button" aria-pressed={view==='edit'} disabled={!base||frozenBusy} onClick={()=>switchView('edit')}><PenLine size={16}/>تعديل البطاقة</button>
  <button type="button" aria-pressed={view==='assess'} disabled={!base||frozenBusy} onClick={()=>switchView('assess')}><Sparkles size={16}/>تقييم بذرة</button>
  {keys.length>0&&<button type="button" aria-pressed={view==='confirm'} disabled={frozenBusy} onClick={()=>switchView('confirm')}><FilePenLine size={16}/>مراجعة ({keys.length})</button>}
 </div>
 <div className="br-body" key={view}>
  {busy==='load'&&<p role="status" className="br-status"><LoaderCircle className="spin" size={18}/>يجري تحميل أحدث نسخة من البطاقة…</p>}
  {base&&view==='edit'&&<><h3>ما الذي تودّ تعديله؟</h3><p className="br-muted">اختر خانة من بطاقتك. يمكنك تعديل أكثر من خانة ثم مراجعتها معًا.</p>
   <label className="br-field"><span>خانة البطاقة</span><select value={fieldKey} onChange={e=>setField(e.target.value as RevisionField)}>{revisionGroups.map(g=><optgroup key={g.title} label={g.title}>{g.keys.filter(k=>fieldVisible(k,effective)).map(k=><option key={k} value={k}>{chatFields[k]}{keys.includes(k)?' · معدّلة':''}</option>)}</optgroup>)}</select></label>
   <label className="br-field"><span>{chatFields[fieldKey]}</span>{options?<select value={value} onChange={e=>put(fieldKey,e.target.value)}><option value="">اختر…</option>{value&&!options.some(([v])=>v===value)&&<option value={value}>{value}</option>}{options.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select>:<textarea key={fieldKey} rows={fieldKey==='title'?2:5} maxLength={chatFieldLimits[fieldKey]} value={value} onChange={e=>put(fieldKey,e.target.value)}/>}</label>
   {fieldKey==='ownership'&&effective.ownership==='shared'&&<button type="button" className="br-text" onClick={()=>setField('coOwners')}>تعديل أسماء الشركاء ←</button>}
   {fieldKey==='initialSolutionStatus'&&effective.initialSolutionStatus==='implemented'&&<button type="button" className="br-text" onClick={()=>setField('initialSolution')}>وصف التجربة التي نُفّذت ←</button>}
   {keys.includes(fieldKey)&&<button type="button" className="br-text" onClick={()=>put(fieldKey,base.challenge[fieldKey]||'')}>استعادة النص الحالي لهذه الخانة</button>}
  </>}
  {base&&view==='assess'&&<>
   <h3>كيف يقرأ زملاؤك هذه البطاقة؟</h3><p className="br-muted">تراجع بذرة الموقف والمتأثرين والأثر والشواهد وعلامة النجاح. اختر ما يفيدك من ملاحظاتها.</p>
   {busy==='assess'&&<p role="status" className="br-status"><LoaderCircle size={18} className="spin"/>تقرأ بذرة بطاقتك وتراجع صياغتها…</p>}
   {review&&<div className="br-feedback" key={generation}>{review.notice&&<p className="br-warning" role="status">{review.notice}</p>}
    <div className="br-summary"><small>{review.source==='ai'?'قراءة بذرة للبطاقة':'قراءة إرشادية أولية'}</small><p>{review.summary}</p>
     {!!review.strengths.length&&<><strong>نقاط القوة</strong><ul>{review.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></>}</div>
    <h4>{review.findings.length?'ما يمكن تحسينه':'لا توجد تعديلات مقترحة حاليًا.'}</h4>
    {review.findings.map(f=><Finding key={f.field} f={f} card={effective} put={put}/>)}
   </div>}
   {busy!=='assess'&&<details className="br-rerun" open={review?undefined:true}><summary>أضف توضيحًا أو اطلب تقييمًا جديدًا</summary><label className="br-field"><span>ما الذي تودّ أن تراعيه بذرة؟ (اختياري)</span><textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}/></label><p className="br-muted">أضف معلومة واقعية فقط، وتجنّب الأسماء وبيانات التواصل.</p><button className="br-outline" type="button" disabled={!!busy||stale} onClick={startAssessment}><Sparkles size={15}/>{review?'أعد التقييم':'قيّم البطاقة'}</button></details>}
   {review&&reviewed!==JSON.stringify(changes)&&<small className="br-muted">لديك تعديلات أحدث من التقييم المعروض.</small>}
  </>}
  {base&&view==='confirm'&&<><h3>راجع التغييرات قبل الحفظ</h3><p className="br-muted">{published?'تبقى البطاقة منشورة بنفس الرابط وتحتفظ بأصواتها ورغبات الانضمام.':'ستحفظ التغييرات في البطاقة بحالتها الحالية.'}</p>
   {keys.length?keys.map(k=><section className="br-diff" key={k}><h4>{chatFields[k]}</h4><ChangePair field={k} before={base.challenge[k]||''} after={effective[k]||''}/>
    {collisions.includes(k)?<div className="br-conflict"><p>تغيّرت هذه الخانة أيضًا في النسخة الأحدث. اختر النص الذي تريده.</p><button type="button" onClick={()=>setCollisions(cs=>cs.filter(f=>f!==k))}>استخدم تعديلي</button><button type="button" onClick={()=>{put(k,base.challenge[k]||'');setCollisions(cs=>cs.filter(f=>f!==k))}}>احتفظ بالنص الحالي</button></div>:fieldVisible(k,effective)&&<button type="button" className="br-text" onClick={()=>{setField(k);switchView('edit')}}>عدّل هذه الخانة</button>}
    </section>):<p>لا توجد تغييرات بانتظار الحفظ.</p>}</>}
  {error&&<div className="br-error" role="alert">{error} {(!base||stale)&&<button type="button" className="br-text" onClick={reload} disabled={!!busy}>{stale?'حمّل أحدث نسخة واحتفظ بتعديلاتي':'إعادة المحاولة'}</button>}</div>}
 </div>
 {discard?<div className="br-discard" role="alert"><p>لديك تعديلات لم تُحفظ. هل تريد مغادرة المحرّر؟</p><button type="button" className="br-primary" onClick={()=>setDiscard(false)}>متابعة التعديل</button><button type="button" className="br-text" onClick={onClose}>تجاهل التعديلات وإغلاق</button></div>:
 <footer className="br-foot"><span>{keys.length?'تعديلاتك خاصة حتى تحفظها.':'لا تُطبّق أي صياغة تلقائيًا.'}</span>{view==='confirm'?<button type="button" className="br-primary" disabled={!keys.length||!!busy||stale||!!collisions.length} onClick={save}><Check size={17}/>{busy==='save'?'جارٍ الحفظ…':'حفظ التعديلات'}</button>:keys.length>0?<button type="button" className="br-primary" disabled={frozenBusy} onClick={()=>switchView('confirm')}>راجع التعديلات <ChevronLeft size={16}/></button>:view==='assess'?<button type="button" className="br-outline" disabled={!base||frozenBusy} onClick={()=>switchView('edit')}><PenLine size={15}/>عدّل يدويًا</button>:<button type="button" className="br-outline" disabled={!base||frozenBusy} onClick={()=>switchView('assess')}><MessageSquareText size={16}/>استعن ببذرة</button>}</footer>}
 </div></dialog>;
}
