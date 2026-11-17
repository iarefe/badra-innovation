'use client';
import {useState} from 'react';
import {CalendarClock} from 'lucide-react';
import {intakeLabels,intakeDeadline,intakeWindow} from '@/lib/hackathon-intake';
import type {Workshop} from '@/lib/challenges';
import type {WorkshopAction} from '@/lib/admin-dashboard';
export default function AdminIntake({announced=false,workshop,busy,onAction}:{announced?:boolean;workshop:Workshop;busy:boolean;onAction:(a:WorkshopAction)=>Promise<boolean>}){
 const [armed,setArmed]=useState(false),w=workshop.intake??intakeWindow({finalized:workshop.finalized});
 const open=w.phase==='open';
 return <section className="ba-card ba-intake" aria-label="استقبال التحديات"><div className="ba-intake-row"><div><span className="ba-eyebrow"><CalendarClock size={15} aria-hidden="true"/> جدولة المشاركة</span><h2>استقبال التحديات</h2><p><strong>{w.manualOpen&&open?'الاستقبال مفتوح بقرار المدير':intakeLabels[w.phase]}</strong> · {announced?'انتهت مرحلة استقبال التحديات وبدأت مرحلة عمل الفرق.':w.finalized?'لإعادة فتح الاستقبال، ألغِ اعتماد القائمة أولًا.':w.manualOpen?'يبقى مفتوحًا حتى تغلقه أو تعتمد القائمة.':'موعد الإغلاق المجدول: '+intakeDeadline+'.'}</p></div>
  {!w.finalized&&<button type="button" className={'ba-btn '+(!open?'ba-primary':'')} disabled={busy} aria-expanded={open?armed:undefined} onClick={()=>{if(!open){setArmed(false);void onAction('resume-intake')}else setArmed(!armed)}}>{open?'إغلاق استقبال التحديات':'فتح استقبال التحديات'}</button>}</div>
  {armed&&open&&<div className="ba-intake-confirm" role="group" aria-label="تأكيد إيقاف الاستقبال"><p>سيُمنع طرح تحديات جديدة ونشر المسودات فورًا. سيبقى التصويت وتسجيل رغبات الانضمام على حالهما.</p><div className="ba-actions"><button type="button" className="ba-btn" disabled={busy} onClick={()=>setArmed(false)}>تراجع</button><button type="button" className="ba-btn ba-primary" disabled={busy} onClick={async()=>{if(await onAction('pause-intake'))setArmed(false)}}>تأكيد إيقاف الاستقبال</button></div></div>}
 </section>;
}
