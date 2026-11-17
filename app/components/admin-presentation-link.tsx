'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpLeft,Check,Copy,MonitorPlay} from 'lucide-react';
import {displayPath,displayUrl} from '@/lib/presentation';
import type {AdminNotify} from '@/lib/admin-dashboard';

export default function AdminPresentationLink({notify}:{notify:AdminNotify}){
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!copied)return;const t=setTimeout(()=>setCopied(false),2400);return()=>clearTimeout(t)},[copied]);
 useEffect(()=>{if(manual){field.current?.focus();field.current?.select();}},[manual]);
 async function copy(){
  try{await navigator.clipboard.writeText(displayUrl);setManual(false);setCopied(true);notify('نُسخ رابط شاشة العرض.');}
  catch{setManual(true);field.current?.select();}
 }
 return <section className="ba-display-link" aria-label="شاشة عرض التحديات"><div className="ba-display-intro"><span className="ba-display-icon"><MonitorPlay aria-hidden="true" size={25}/></span><div><h2>شاشة عرض التحديات</h2><p>افتح الرابط على شاشة الفعالية. لكل تحدٍّ منشور شريحة ورمز لبطاقته، وتُضاف التحديات الجديدة تلقائيًا.</p></div></div>
  <div className="ba-display-actions"><a className="ba-btn ba-primary" href={displayPath} target="_blank" rel="noopener noreferrer">فتح العرض <ArrowUpLeft size={17} aria-hidden="true"/></a><button type="button" className="ba-btn" onClick={copy}>{copied?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}{copied?'تم النسخ':'نسخ رابط العرض'}</button></div>
  {manual&&<label className="ba-display-copy">انسخ الرابط لفتحه على شاشة العرض<input ref={field} readOnly dir="ltr" value={displayUrl} onFocus={e=>e.currentTarget.select()}/></label>}
 </section>;
}
