'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import type {FaqInbox} from '@/lib/faq-inquiries';
import {num,type AdminNotify} from '@/lib/admin-dashboard';

export default function AdminInquiries({onAccessLost,notify}:{onAccessLost:()=>void;notify:AdminNotify}){
 const [data,setData]=useState<FaqInbox|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const read=useRef<AbortController|null>(null),write=useRef<AbortController|null>(null),mounted=useRef(false),lost=useRef(onAccessLost);lost.current=onAccessLost;
 const load=useCallback(async(page=1)=>{
  read.current?.abort();const controller=new AbortController();read.current=controller;setLoading(true);setError('');
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch('/api/faq-inquiries?page='+page,{cache:'no-store',signal:controller.signal}),body=await r.json() as FaqInbox&{error?:string};
   if(!r.ok){if(r.status===401||r.status===403){setData(null);lost.current()}throw Error(body.error||'تعذّر تحميل الاستفسارات.')}
   if(mounted.current&&read.current===controller)setData(body);
  }catch(e){if(mounted.current&&read.current===controller)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'تعذّر تحميل الاستفسارات. أعد المحاولة.')}
  finally{clearTimeout(timeout);if(mounted.current&&read.current===controller)setLoading(false)}
 },[]);
 useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;read.current?.abort();write.current?.abort()}},[load]);
 async function markRead(id:string){
  if(write.current)return;const controller=new AbortController();write.current=controller;setBusy(id);setError('');
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch('/api/faq-inquiries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),signal:controller.signal}),body=await r.json() as {readAt:number;error?:string};
   if(!r.ok||typeof body.readAt!=='number'){if(r.status===401||r.status===403){setData(null);lost.current()}throw Error(body.error||'تعذّر تحديث الاستفسار.')}
   if(mounted.current){setData(previous=>previous?{...previous,unread:Math.max(0,previous.unread-(previous.inquiries.some(q=>q.id===id&&!q.readAt)?1:0)),inquiries:previous.inquiries.map(q=>q.id===id?{...q,readAt:body.readAt}:q)}:previous);notify('حُدّثت حالة الاستفسار')}
  }catch(e){if(mounted.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'تعذّر تأكيد التحديث. أعد المحاولة.')}
  finally{clearTimeout(timeout);write.current=null;if(mounted.current)setBusy('')}
 }
 return <details className="ba-card ba-disclosure ba-inquiries">
  <summary><span><b>استفسارات الزوار</b><small>{data?`${num(data.total)} استفسار · ${num(data.unread)} جديد`:'أسئلة واردة من الصفحة الرئيسية'}</small></span><ChevronDown size={17} aria-hidden="true"/></summary>
  <div className="ba-disclosure-body ba-stack">
   <div className="ba-toolbar"><p className="ba-help">تظهر هذه الأسئلة للإدارة فقط. راجعها للاستفادة منها في توضيح معلومات الهاكاثون.</p><button className="ba-btn" type="button" disabled={loading||!!busy} onClick={()=>void load(data?.page||1)}>{loading?'جارٍ التحميل…':'تحديث'}</button></div>
   {error&&<p className="ba-error" role="alert">{error}</p>}
   {!data&&loading&&<p role="status" className="ba-help">نحمّل الاستفسارات…</p>}
   {data&&!error&&(data.inquiries.length?<>
    <ol className="ba-inquiry-list" aria-label="الاستفسارات الواردة" aria-busy={loading}>
     {data.inquiries.map(q=><li key={q.id}>
      <div className="ba-inquiry-meta"><strong>{q.senderName||'زائر'}</strong><span data-read={!!q.readAt}>{q.readAt?'تم الاطلاع':'جديد'}</span><time dateTime={new Date(q.createdAt).toISOString()}>{new Date(q.createdAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'})}</time></div>
      <p className="ba-inquiry-question">{q.question}</p>
      {!q.readAt&&<button type="button" className="ba-btn" disabled={!!busy||loading} onClick={()=>void markRead(q.id)}><Check size={15} aria-hidden="true"/>{busy===q.id?'جارٍ الحفظ…':'تم الاطلاع'}</button>}
     </li>)}
    </ol>
    {data.pages>1&&<nav className="ba-toolbar" aria-label="صفحات الاستفسارات"><button type="button" className="ba-btn" disabled={loading||!!busy||data.page<=1} onClick={()=>void load(data.page-1)}>السابق</button><span className="ba-help">{num(data.page)} من {num(data.pages)}</span><button type="button" className="ba-btn" disabled={loading||!!busy||data.page>=data.pages} onClick={()=>void load(data.page+1)}>التالي</button></nav>}
   </>:<p className="ba-help">لا توجد استفسارات بعد. ستظهر هنا الأسئلة المرسلة من الصفحة الرئيسية.</p>)}
  </div>
 </details>
}
