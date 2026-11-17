'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {Pencil,X} from 'lucide-react';
import {domains,type Challenge,type Entry} from '@/lib/challenges';

type Props={entry:Entry;disabled?:boolean;frozen:boolean;onSaved:(id:string,domain:Challenge['domain'])=>void};
export default function ChallengeCategory({entry,disabled=false,frozen,onSaved}:Props){
 const id=useId(),dialog=useRef<HTMLDialogElement>(null),request=useRef<AbortController|null>(null),alive=useRef(true);
 const [selected,setSelected]=useState(entry.challenge.domain),[baseline,setBaseline]=useState(entry.challenge.domain),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort()}},[]);
 function open(){setSelected(entry.challenge.domain);setBaseline(entry.challenge.domain);setError('');dialog.current?.showModal()}
 async function save(event:FormEvent){
  event.preventDefault();if(busy||disabled||frozen||selected===baseline)return;
  const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);setBusy(true);setError('');
  try{
   const response=await fetch('/api/challenges',{method:'PATCH',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({id:entry.id,action:'category',domain:selected,previousDomain:baseline})});
   const result=await response.json() as {domain?:unknown;currentDomain?:unknown;error?:unknown};if(!alive.current)return;
   if(!response.ok){const current=domains.find(d=>d===result.currentDomain);if(current){setBaseline(current);setSelected(current)}throw Error(typeof result.error==='string'?result.error:'تعذّر حفظ الفئة. حاول مجددًا.')}
   const confirmed=domains.find(d=>d===result.domain);if(!confirmed)throw Error('لم يتأكد حفظ الفئة. حدّث الصفحة للتحقق.');
   onSaved(entry.id,confirmed);dialog.current?.close();
  }catch(e){if(alive.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'تعذّر تأكيد حفظ الفئة. حدّث الصفحة للتحقق ثم أعد المحاولة.')}
  finally{clearTimeout(timeout);if(request.current===controller)request.current=null;if(alive.current)setBusy(false)}
 }
 return <><button type="button" className="category-edit" aria-label={'تعديل فئة تحدي '+entry.challenge.title} aria-haspopup="dialog" disabled={disabled||frozen} title={frozen?'القائمة معتمدة؛ يمكن تعديل الفئة بعد إعادة فتحها.':'تعديل الفئة'} onClick={open}><Pencil size={17} aria-hidden="true"/></button>
  <dialog ref={dialog} className="category-dialog" dir="rtl" aria-labelledby={id+'-title'} aria-describedby={id+'-help'} onCancel={e=>{if(busy)e.preventDefault()}}>
   <form onSubmit={save} aria-busy={busy}>
    <header><h2 id={id+'-title'}>تعديل فئة التحدي</h2><button type="button" className="category-close" aria-label="إغلاق تعديل الفئة" disabled={busy} onClick={()=>dialog.current?.close()}><X size={19}/></button></header>
    <p className="category-title">{entry.challenge.title}</p>
    <label htmlFor={id+'-select'}>فئة التحدي</label><select id={id+'-select'} value={selected} disabled={busy||frozen} onChange={e=>{setSelected(e.target.value as Challenge['domain']);setError('')}}>{domains.map(domain=><option key={domain}>{domain}</option>)}</select>
    <p className="category-help" id={id+'-help'}>اختر الفئة الأقرب لموضوع التحدي. تعديلها يحافظ على وصف التحدي وأصواته ورغبات الانضمام إليه.</p>
    {error&&<p className="category-error" role="alert">{error}</p>}
    <footer><button type="submit" className="category-save" disabled={busy||disabled||frozen||selected===baseline}>{busy?'جارٍ الحفظ…':'حفظ الفئة'}</button><button type="button" disabled={busy} onClick={()=>dialog.current?.close()}>إلغاء</button></footer>
   </form>
  </dialog>
 </>;
}
