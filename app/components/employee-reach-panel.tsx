'use client';
import {useEffect,useId,useState} from 'react';
import {ChevronDown,RefreshCw} from 'lucide-react';
import {accessTime,type EntryState,type EmployeePresence} from '@/lib/employee-reach';
import {num} from '@/lib/admin-dashboard';
import type {AdminDirectory} from './use-admin-directory';

export default function EmployeeReachPanel({directory,peopleTab}:{directory:AdminDirectory;peopleTab:boolean}){
 const [open,setOpen]=useState(peopleTab),id=useId();useEffect(()=>{if(peopleTab)setOpen(true)},[peopleTab]);
 const {data:r,error,loading}=directory.reach;
 const group=(title:string,rows:EmployeePresence[],kind:EntryState,key:string)=><section key={key} className="ba-access-group" data-status={kind}><h3>{title} <b>{num(rows.length)}</b></h3>
  {rows.length?<ul>{rows.map((p,i)=><li key={i}><strong>{p.name}</strong>{(kind==='entered'||kind==='unknown')&&<small>{accessTime(p)}</small>}</li>)}</ul>:<p>{kind==='entered'?'لا يوجد دخول موثّق حتى الآن.':'لا يوجد موظفون في هذه القائمة.'}</p>}</section>;
 return <section className="ba-card ba-access-panel" aria-labelledby={id+'-title'}>
  <div className="ba-access-head"><div><span className="ba-eyebrow">دخول الموظفين</span>
   <h2 id={id+'-title'}>{r?<>دخل المنصة <strong>{num(r.entered)}</strong> من أصل <strong>{num(r.total)}</strong> موظفًا</>:'مَن دخل المنصة؟'}</h2>
   {r?<p>بحسب دليل المؤسسة · لم يدخل بعد: <b>{num(r.waiting)}</b>{r.unknown>0&&<> · بحاجة إلى تحقق: <b>{num(r.unknown)}</b></>}</p>:<p role="status">{error||'جارٍ قراءة سجل الدخول…'}</p>}</div>
   <div className="ba-actions">{r&&<button type="button" className="ba-btn ba-primary" aria-expanded={open} aria-controls={id+'-names'} onClick={()=>setOpen(v=>!v)}>{open?'إخفاء الأسماء':'عرض أسماء الموظفين'} <ChevronDown size={15} aria-hidden="true"/></button>}
    <button type="button" disabled={loading} className="ba-btn" onClick={()=>void directory.reload('reach')}><RefreshCw size={15} aria-hidden="true"/>{loading?'جارٍ التحديث…':'تحديث'}</button></div>
  </div>
  {r&&<div id={id+'-names'} hidden={!open}><p className="ba-access-help">يُحتسب الدخول عند التحقق بنجاح أو عند فتح المنصة بجلسة محفوظة. يظهر كل موظف مرة واحدة باسمه في الدليل.</p>
   {!r.total&&<p>لا يوجد موظفون في دليل المؤسسة بعد.</p>}
   <div className="ba-access-grid">{group('دخلوا المنصة',r.rows.filter(p=>p.status==='entered'),'entered','yes')}{group('لم يدخلوا المنصة بعد',r.rows.filter(p=>p.status==='waiting'),'waiting','no')}
    {r.unknown>0&&group('بحاجة إلى تحقق',r.rows.filter(p=>p.status==='unknown'),'unknown','uncertain')}</div>
   {!!r.outside.length&&<details className="ba-access-extra"><summary>حسابات دخلت ولم تُطابَق مع دليل الموظفين ({num(r.outside.length)})</summary><p>هذه الحسابات خارج إجمالي الموظفين أعلاه.</p><ul>{r.outside.map((p,i)=><li key={i}>{p.name}</li>)}</ul></details>}
  </div>}
 </section>;
}
