'use client';
import {useState} from 'react';
import {ArrowLeft,Check,Download,Minus,Plus,Lock} from 'lucide-react';
import type {Workshop,Entry} from '@/lib/challenges';
import {adminRanking,num,phase,challengeQuantity,type WorkshopAction} from '@/lib/admin-dashboard';
import {stagger,Empty,AdminBar} from './admin-ui';
type Props={announced?:{id:string;title:string;rank:number}[];entries:Entry[];order:string[];workshop:Workshop;count:number;title:string;setCount:(v:number)=>void;setTitle:(v:string)=>void;busy:boolean;onAction:(action:WorkshopAction)=>Promise<boolean>;download:()=>void};
export default function AdminWorkshop({announced=[],entries,order,workshop:w,count,title,setCount,setTitle,busy,onAction,download}:Props){
 const [armed,setArmed]=useState<string|null>(null);
 const locked=w.finalized,disabled=locked||busy,dirty=count!==w.count||title!==w.title,rows=adminRanking(entries,order,w,count),accepted=rows.filter(e=>e.inside).length,max=Math.max(1,...rows.map(e=>e.votes));
 // Changing the saved revision, pending settings, or selected membership invalidates the old confirmation.
 const token=JSON.stringify([w.revision,title,count,rows.filter(e=>e.inside).map(e=>[e.id,e.votes])]),confirming=armed===token;
 const canFinalize=!locked&&!busy&&accepted>0&&!dirty;
 if(announced.length){
  const live=new Map(entries.map(e=>[e.id,e])),snapshot=new Map(w.selected.map(e=>[e.id,e]));
  return <section className="ba-announced-panel" aria-label="القائمة المعلنة">
   <div className="ba-announced-heading"><div><span className="ba-result-tag"><Check size={14} aria-hidden="true"/> أُعلنت الترشيحات</span><h2>التحديات المرشّحة للهاكاثون</h2></div><button type="button" className="ba-btn" disabled={!w.selected.length} onClick={download}><Download size={15} aria-hidden="true"/>تنزيل ملف التحضير</button></div>
   <ul className="ba-announced-teams">{announced.map(t=>{const entry=live.get(t.id),selected=snapshot.get(t.id);return <li key={t.id}>
    <div className="ba-team-line"><span className="ba-team-label">فريق التحدي {num(t.rank)}</span>{selected&&<span className="ba-team-votes">أصوات الترشيح: {num(selected.votes)}</span>}</div>
    <h3><a href={'/challenge/'+t.id}>{t.title}</a></h3>{entry?.challenge.author&&<p>صاحب التحدي: {entry.challenge.author}</p>}
    <a className="ba-team-action" href={'/teams#team-'+t.id}>مساحة الفريق <ArrowLeft size={15} aria-hidden="true"/></a>
   </li>})}</ul>
  </section>;
 }
 return <section className="ba-work-grid" aria-label="التصويت والاختيار"><div className="ba-card ba-settings">
  <div className="ba-vote-status" data-phase={phase(w)}><div><strong><i className="ba-dot"/>{locked?'اعتُمدت القائمة وأُغلق التصويت':w.open?'التصويت مفتوح':'التصويت موقوف مؤقتًا'}</strong><p>{locked?'ثبتت الأصوات لحظة الاعتماد.':w.open?'يمكن إيقاف التصويت مؤقتًا قبل اعتماد القائمة النهائية.':'لا تُقبل أصوات جديدة حتى تستأنفه.'}</p></div>
   {!locked&&<button type="button" className="ba-btn" disabled={busy} onClick={()=>{setArmed(null);void onAction(w.open?'pause':'resume')}}>{w.open?'إغلاق التصويت':'فتح التصويت'}</button>}</div>
  <div className="ba-vote-status" data-phase={w.joiningOpen?'open':'paused'}><div><strong><i className="ba-dot"/>{w.joiningOpen?'الانضمام مفتوح':'الانضمام مغلق'}</strong><p>إغلاق الانضمام يمنع تسجيل الرغبات أو سحبها، ويحفظ الرغبات السابقة. مستقل عن التصويت.{locked?' ألغِ اعتماد القائمة قبل فتح الانضمام.':''}</p></div><button type="button" className="ba-btn" disabled={busy||(locked&&!w.joiningOpen)} onClick={()=>{setArmed(null);void onAction(w.joiningOpen?'pause-joining':'resume-joining')}}>{w.joiningOpen?'إغلاق الانضمام':'فتح الانضمام'}</button></div>
  <details className="ba-work-config"><summary>إعداد القائمة · أعلى {num(count)} تحديات {dirty&&<span>· تغييرات غير محفوظة</span>}</summary><div className="ba-stack">
  <label className="ba-field">اسم الهاكاثون<input value={title} maxLength={100} disabled={disabled} onChange={e=>{setArmed(null);setTitle(e.target.value)}}/></label>
  <fieldset className="ba-count-field" disabled={disabled}><legend>عدد التحديات الأعلى تصويتًا</legend>
   <div className="ba-actions">{[3,4,5].map(k=><button type="button" className="ba-btn ba-preset" aria-pressed={count===k} key={k} onClick={()=>{setArmed(null);setCount(k)}}>{num(k)} تحديات</button>)}
    <div className="ba-stepper"><button type="button" disabled={disabled||count<=1} aria-label="تقليل عدد التحديات" onClick={()=>{setArmed(null);setCount(Math.max(1,count-1))}}><Minus size={15}/></button><output aria-label="العدد المختار">{num(count)}</output><button type="button" disabled={disabled||count>=20} aria-label="زيادة عدد التحديات" onClick={()=>{setArmed(null);setCount(Math.min(20,count+1))}}><Plus size={15}/></button></div>
   </div><p className="ba-help">اختر ٣ أو ٤ أو ٥، أو أي عدد يناسب وقت الهاكاثون من ١ إلى ٢٠.</p>
  </fieldset>
  {dirty&&!locked&&<p className="ba-unsaved" role="status">لديك تغييرات غير محفوظة. احفظها قبل اعتماد القائمة.</p>}
  <button type="button" className="ba-btn ba-save-settings" disabled={disabled||!dirty} onClick={()=>{setArmed(null);void onAction('configure')}}>{busy?'جارٍ التنفيذ…':dirty?'حفظ التغييرات':'الإعدادات محفوظة'}</button></div></details>
 </div><div className="ba-card ba-ranking"><div className="ba-ranking-head"><div><h2>{locked?'القائمة النهائية':'أعلى التحديات حاليًا'}</h2><p className="ba-help">{locked?'ثبتت الأصوات لحظة الاعتماد.':'ترتيب مبدئي يتغير مع التصويت.'}</p></div><button type="button" className="ba-btn" disabled={!w.selected.length} onClick={download}>تنزيل ملف التحضير <Download size={14}/></button></div>
  {rows.length?<ol className="ba-rank-list">{rows.map((e,i)=><li key={e.id} data-inside={e.inside}>
   {i===accepted&&<div className="ba-cut"><span>خارج القائمة</span></div>}
   <div className="ba-rank-row ba-appear" style={stagger(i)}><span className="ba-rank-no">{num(e.rank)}</span><div><a href={'/challenge/'+e.id}>{e.challenge.title}</a><AdminBar value={e.votes} max={max}/></div><span className="ba-votes-total">{num(e.votes)} صوت</span></div>
  </li>)}</ol>:<Empty>بانتظار نشر التحديات.</Empty>}
  <div className="ba-rank-notes">{!!rows.length&&<p aria-live="polite">{locked?'عدد التحديات في القائمة المعتمدة: '+num(accepted)+'.':rows.length<=count?'عدد التحديات المنشورة ('+num(rows.length)+') لا يتجاوز العدد المطلوب ('+num(count)+')، فكلها ستدخل القائمة.':'ستدخل أعلى '+challengeQuantity(accepted)+' من أصل '+num(rows.length)+' في القائمة.'}</p>}
   <p className="ba-help">تُرتّب التحديات حسب الأصوات، وعند التعادل تُقدّم الأسبق نشرًا. عند الاعتماد يُغلق التصويت والانضمام وتُحفظ نسخة من القائمة.</p>
   {dirty&&!locked&&<p className="ba-help">الاعتماد متاح بعد حفظ إعداد القائمة.</p>}
  </div>
  {locked?<button type="button" className="ba-btn ba-reopen" disabled={busy} onClick={()=>void onAction('reopen')}>إعادة فتح التصويت</button>:
   confirming&&canFinalize?<div className="ba-final-confirm"><p>ستُعتمد قائمة من {challengeQuantity(accepted)} ويُغلق التصويت والانضمام.</p><div className="ba-actions"><button type="button" className="ba-btn ba-primary" disabled={busy} onClick={async()=>{if(await onAction('finalize'))setArmed(null)}}>تأكيد الاعتماد والإغلاق</button><button type="button" className="ba-btn" onClick={()=>setArmed(null)}>تراجع</button></div></div>:
   <button type="button" className="ba-btn ba-primary ba-finalize" disabled={!canFinalize} onClick={()=>setArmed(token)}><Lock size={15}/>اعتماد القائمة وإغلاق التصويت والانضمام</button>}
 </div></section>
}
