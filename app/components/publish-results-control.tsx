'use client';
import {useEffect,useRef,useState} from 'react';
import {Megaphone,ArrowLeft} from 'lucide-react';
import {numberLabel,placeLabel,type PublicationPreview,type PublishedResults} from '@/lib/published-results';
import type {AdminNotify} from '@/lib/admin-dashboard';
import {usePublicResults} from './public-result-notice';

export default function PublishResultsControl({notify,onAccessLost}:{notify:AdminNotify;onAccessLost:()=>void}){
 const live=usePublicResults(),[saved,setSaved]=useState<PublishedResults|null>(null),pub=live&&(!saved||live.revision>saved.revision)?live:saved;
 const [preview,setPreview]=useState<PublicationPreview|null>(null),[open,show]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const panel=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)panel.current?.focus({preventScroll:true})},[open]);
 async function read(){
  show(true);setBusy(true);setError('');setPreview(null);
  try{const res=await fetch('/api/results?preview=1',{cache:'no-store'});if([401,403].includes(res.status))onAccessLost();
   if(!res.ok){const err=await res.json() as {error?:string};throw Error(err.error||'تعذّر تحميل المعاينة.');}
   setPreview(await res.json() as PublicationPreview);
  }catch(e){setError(e instanceof Error?e.message:'تعذّر تحميل المعاينة.')}finally{setBusy(false)}
 }
 function cancel(){show(false);setError('');setPreview(null);requestAnimationFrame(()=>button.current?.focus())}
 async function submit(){
  if(!preview||preview.reason||busy)return;setBusy(true);setError('');
  try{const res=await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:preview.revision,fingerprint:preview.fingerprint})});
   if([401,403].includes(res.status))onAccessLost();if(!res.ok){const err=await res.json() as {error?:string};if(res.status===409)setPreview(null);throw Error(err.error||'تعذّر تعميم النتائج.');}
   const data=await res.json() as {publication:PublishedResults};
   setSaved(data.publication);cancel();notify('عُمّمت النتائج وظهرت التهنئة في الرئيسية.');
  }catch(e){setError(e instanceof Error?e.message:'تعذّر تعميم النتائج.')}finally{setBusy(false)}
 }
 return <section className="bp-admin" aria-label="تعميم النتائج"><div className="bp-admin-summary">
  <div><span className="ba-eyebrow">إعلان ختام الهاكاثون</span><h3>تعميم النتائج</h3><p>{pub?'التعميم منشور في الرئيسية. أي تعديل لاحق على الدرجات يحتاج إلى تعميم جديد.':'عاين الترتيب ثم انشره في الرئيسية مع تهنئة صاحب المركز الأول.'}</p></div>
  <div className="bp-admin-actions"><button type="button" ref={button} className="ba-btn ba-primary" aria-expanded={open} aria-controls="bp-preview" disabled={busy} onClick={open?cancel:read}><Megaphone size={16} aria-hidden="true"/>{open?'إغلاق المعاينة':'تعميم النتائج'}</button>
  {pub&&<a className="ba-link" href="/results">عرض التعميم المنشور <ArrowLeft size={15} aria-hidden="true"/></a>}</div></div>
  {open&&<div className="bp-preview" id="bp-preview" ref={panel} tabIndex={-1} aria-label="معاينة التعميم"><h4>معاينة الترتيب الذي سيظهر للجميع</h4>
   {busy&&!preview&&<p role="status">جارٍ تحميل الترتيب…</p>}
   {preview?.reason&&<p role="status">{preview.reason}</p>}
   {preview&&!preview.reason&&<><ol>{preview.standings.map(t=><li key={t.id}><b>{placeLabel(t.place)}</b><span>{t.title}</span><strong><bdi>{numberLabel(t.score)}</bdi> / {numberLabel(100)}</strong></li>)}</ol>
   {preview.unchanged?<p role="status">هذا الترتيب منشور بالفعل.</p>:<button type="button" className="ba-btn ba-primary" disabled={busy} onClick={submit}>{busy?'جارٍ التعميم…':'تأكيد التعميم للجميع'}</button>}</>}
   {error&&<p className="ba-error" role="alert">{error} <button type="button" className="ba-link" disabled={busy} onClick={read}>تحديث المعاينة</button></p>}
  </div>}</section>;
}
