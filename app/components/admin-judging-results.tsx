'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,CheckCircle2,ClipboardList,RefreshCw} from 'lucide-react';
import {num,type AdminNotify} from '@/lib/admin-dashboard';

import {resultDisplay,type TeamResult} from '@/lib/team-card';
import PublishResultsControl from './publish-results-control';
import {useJudgingResults} from './use-judging-results';
type TeamRow={id:string;title:string;rank:number;result:TeamResult};
type Props={notify:AdminNotify;onAccessLost:()=>void};
const formatScore=(n:number)=>n.toLocaleString('ar-SA',{maximumFractionDigits:2});
function Score({value,max,label}:{value:number|null;max:number;label:string}){
 return <div><dt>{label}</dt><dd>{value===null?<span className="bj-pending">لم تُرصد</span>:<><strong>{formatScore(value)}</strong><span> من {num(max)}</span></>}</dd></div>;
}
function TeamScoreRow({team,refresh,notify,onAccessLost}:{team:TeamRow;refresh:()=>Promise<void>} & Props){
 const {result:r}=team,display=resultDisplay(r);
 const [editing,edit]=useState(false),[input,setInput]=useState(''),[saving,save]=useState(false),[error,setError]=useState('');
 const id=useId(),inputRef=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [invalid,markInvalid]=useState(false),restore=useRef(false);
 useEffect(()=>{if(restore.current&&!editing&&!saving){restore.current=false;trigger.current?.focus({preventScroll:true})}},[editing,saving]);
 function dismiss(){restore.current=true;edit(false);setError('');markInvalid(false)}
 useEffect(()=>{if(editing)inputRef.current?.focus()},[editing]);
 function open(){setInput(r.audience==null?'':String(r.audience));setError('');markInvalid(false);edit(true)}
 async function submit(e:FormEvent){e.preventDefault();if(saving)return;
  const value=Number(input);if(!input.trim()||!Number.isFinite(value)||value<0||value>30||inputRef.current?.validity.stepMismatch){markInvalid(true);setError('أدخل درجة من 0 إلى 30، بمنزلتين عشريتين كحد أقصى.');inputRef.current?.focus();return;}
  save(true);setError('');
  try{
   const response=await fetch('/api/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'audience',team:team.id,value})});
   if(!response.ok){if(response.status===401||response.status===403)onAccessLost();const data=await response.json() as {error?:string};throw Error(data.error||'تعذّر حفظ درجة الجمهور.');}
   dismiss();notify('حُفظت درجة تصويت الجمهور.');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'تعذّر حفظ الدرجة. حاول مجددًا.');}finally{save(false);}
 }
 return <li className="bj-team">
  <div className="bj-row-head"><div><span className="ba-team-label">فريق التحدي {num(team.rank)}</span><h3>{team.title}</h3></div>
   <span className="bj-state" data-complete={display.complete}>{display.complete&&<CheckCircle2 size={15} aria-hidden="true"/>}{display.status}</span></div>
  <dl className="bj-scores"><div><dt>بطاقات اللجنة المحتسبة</dt><dd>{num(r.submitted)} من {num(r.required)}</dd></div>
   <Score label="متوسط بطاقات اللجنة" value={r.committee} max={70}/>
   <Score label="تصويت الجمهور" value={r.audience} max={30}/>
   <div className="bj-final"><dt>{display.label}</dt><dd>{display.value===null?<span className="bj-pending">بانتظار أول بطاقة</span>:<><strong>{formatScore(display.value)}</strong> من {num(display.max)}</>}</dd></div>
  </dl>
  <div className="bj-actions"><button type="button" ref={trigger} className="ba-btn" onClick={open} aria-label={(r.audience===null?'رصد درجة الجمهور: ':'تعديل درجة الجمهور: ')+team.title} aria-controls={editing?id:undefined} aria-expanded={editing} disabled={editing||saving}>{r.audience===null?'رصد درجة الجمهور':'تعديل درجة الجمهور'}</button>
   <a className="ba-team-action" aria-label={'تفاصيل بطاقات اللجنة: '+team.title} href={'/teams?team='+encodeURIComponent(team.id)+'#judging-results'}>تفاصيل بطاقات اللجنة <ArrowLeft size={15} aria-hidden="true"/></a></div>
  {editing&&<form id={id} noValidate className="bj-editor" onSubmit={submit}><label>درجة الجمهور من 30<input ref={inputRef} aria-invalid={invalid||undefined} aria-describedby={error?id+'-error':undefined} type="number" inputMode="decimal" dir="ltr" min="0" max="30" step="0.01" required value={input} disabled={saving} onChange={e=>{setInput(e.target.value);setError('');markInvalid(false)}}/></label><button className="ba-btn ba-primary" disabled={saving}>{saving?'جارٍ الحفظ…':'حفظ الدرجة'}</button><button type="button" className="ba-btn" disabled={saving} onClick={dismiss}>إلغاء</button></form>}
  {error&&<p className="ba-error" id={id+'-error'} role="alert">{error}</p>}
 </li>;
}
export default function AdminJudgingResults({notify,onAccessLost}:Props){
 const {rows,busy,fault,refresh}=useJudgingResults({onAccessLost});
 const started=rows?.filter(t=>t.result.submitted>0).length??0;
 return <section className="ba-announced-panel bj-results" aria-label="نتائج التحكيم وتصويت الجمهور">
  <div className="ba-announced-heading"><div><span className="ba-eyebrow"><ClipboardList size={16} aria-hidden="true"/> تقييم الحلول النهائية</span><h2>نتائج التحكيم</h2></div><button type="button" onClick={refresh} disabled={busy} className="ba-btn"><RefreshCw size={15} aria-hidden="true"/>{busy?'جارٍ التحديث…':'تحديث النتائج'}</button></div>
  <p className="bj-intro">يظهر متوسط اللجنة من 70 مع أول بطاقة، ويتحدّث تلقائيًا مع كل تقييم يُحفظ. عند رصد درجة الجمهور من 30، تظهر النتيجة الحالية من 100. <a className="ba-link" href="/admin?tab=attendance">راجع حصيلة أصوات الحاضرين ←</a></p>
  <PublishResultsControl notify={notify} onAccessLost={onAccessLost}/>
  {fault&&<p className="ba-error" role="alert">{fault} {rows?'تظهر أدناه آخر نتائج تم تحميلها.':''}</p>}
  {rows?.length===0?<p className="ba-empty">لا توجد فرق معلنة بعد. تظهر نتائج الفرق هنا بعد إعلان التحديات وتكليف المقيّمين.</p>:rows?<><p className="bj-progress">الفرق التي بدأ تقييمها: {num(started)} من {num(rows.length)}</p><ul className="bj-list">{rows.map(team=><TeamScoreRow key={team.id} team={team} refresh={refresh} notify={notify} onAccessLost={onAccessLost}/>)}</ul></>:!fault&&<p role="status">نحمّل درجات الفرق المعلنة…</p>}
 </section>;
}
