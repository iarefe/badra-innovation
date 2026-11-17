'use client';
import {useRef,useState,type MouseEvent} from 'react';
import {FileDown} from 'lucide-react';
import type {AdminNotify} from '@/lib/admin-dashboard';

const endpoint='/api/admin/hackathon-report';
export default function AdminReportDownload({notify,onAccessLost}:{notify:AdminNotify;onAccessLost:()=>void}){
 const [busy,setBusy]=useState(false),running=useRef(false);
 async function download(e:MouseEvent<HTMLAnchorElement>){
  if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  e.preventDefault();if(running.current)return;
  running.current=true;setBusy(true);
  try{
   const res=await fetch(endpoint,{credentials:'same-origin',cache:'no-store'});
   if(!res.ok||!res.headers.get('Content-Type')?.startsWith('application/pdf')){
    if(res.status===401||res.status===403){onAccessLost();throw Error('تحتاج إلى تسجيل الدخول بحساب المدير لتنزيل التقرير.')}
    throw Error('تعذّر تنزيل التقرير. حاول التصدير مرة أخرى.');
   }
   const disposition=res.headers.get('Content-Disposition')||'';
   const encoded=/filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
   const url=URL.createObjectURL(await res.blob()),a=document.createElement('a');
   a.download=encoded?decodeURIComponent(encoded):'تقرير الهاكاثون.pdf';a.href=url;
   document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   notify('جُهّز تقرير الهاكاثون للتنزيل.');
  }catch(error){notify(error instanceof Error?error.message:'تعذّر تنزيل التقرير.','error')}
  finally{running.current=false;setBusy(false)}
 }
 return <a className="ba-btn ba-primary ba-export-report" href={endpoint} download onClick={download} aria-disabled={busy} aria-busy={busy}><FileDown size={18} aria-hidden="true"/><span aria-live="polite">{busy?'جارٍ تجهيز التقرير…':'تصدير تقرير الهاكاثون'}</span><small dir="ltr">PDF</small></a>;
}
