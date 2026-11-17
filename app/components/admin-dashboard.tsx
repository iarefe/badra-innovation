'use client';
import {useId,useRef,useState,type KeyboardEvent} from 'react';
import {ArrowLeft,ChevronDown,LayoutDashboard,ListChecks,Users,UserRoundCheck,Settings2,ClipboardList,Vote,PanelsTopLeft} from 'lucide-react';
import type {Entry,Workshop} from '@/lib/challenges';
import {adminTotals,num,phase,phaseText,challengeQuantity,type AdminNotify,type AdminTab,type WorkshopAction} from '@/lib/admin-dashboard';
import ChallengeAdmin from './challenge-admin';
import ParticipationAdmin from './participation-admin';
import AdminIntake from './admin-intake';
import AdminWorkshop from './admin-workshop';
import type {TeamReadinessRow} from '@/lib/team-readiness';
import AdminTeamReadiness from './admin-team-readiness';
import AdminFinalVote from './admin-final-vote';
import AdminJudgingResults from './admin-judging-results';
import AdminPresentationLink from './admin-presentation-link';
import AdminReportDownload from './admin-report-download';
import AdminInquiries from './admin-inquiries';
import {useAdminDirectory} from './use-admin-directory';
import {Empty} from './admin-ui';

type Props={initialReadiness?:TeamReadinessRow[]|null;announced?:{id:string;title:string;rank:number}[];entries:Entry[];order:string[];workshop:Workshop;tab:AdminTab;setTab:(t:AdminTab)=>void;title:string;count:number;setTitle:(v:string)=>void;setCount:(v:number)=>void;busy:boolean;onDelete:(e:Entry)=>Promise<boolean>;onWorkshop:(action:WorkshopAction)=>Promise<boolean>;download:()=>void;notify:AdminNotify;onAccessLost:()=>void};
const standardTabs:AdminTab[]=['review','workshop','participation','operations'];
const tabIcons={review:LayoutDashboard,workshop:ListChecks,participation:UserRoundCheck,operations:Settings2,judging:ClipboardList,readiness:PanelsTopLeft,ballot:Vote};
const tabHints:Record<AdminTab,string>={readiness:'',ballot:'',judging:'',review:'افتح «المصوّتون وراغبو الانضمام» تحت أي تحدٍّ للاطلاع على الأسماء وأدوار الراغبين.',workshop:'تابع الترتيب واضبط القائمة قبل اعتمادها.',participation:'دليل موحّد للحسابات والتسجيل والدخول، مع توضيح الروابط المؤكدة.',operations:'أدوات الفعالية، إعدادات المشاركة، والاستفسارات والسجل.'};
export default function AdminDashboard(p:Props){
 const base=useId(),directory=useAdminDirectory(p.onAccessLost),stats=adminTotals(p.entries),w=p.workshop,stage=phase(w);
 const announced=p.announced??[],published=announced.length>0,tabIds:AdminTab[]=published?['readiness','ballot','judging','workshop','review','participation','operations']:standardTabs;
 const d=directory.participation.data,reach=directory.reach.data;
 const shown=p.tab,panel=useRef<HTMLDivElement>(null);
 const [reviewPreset,setReviewPreset]=useState({key:0,withInterests:false});
 function selectTab(id:AdminTab){if(id===shown)return;if(id==='review')setReviewPreset(prev=>({key:prev.key+1,withInterests:false}));p.setTab(id)}
 function openSection(id:AdminTab,withInterests=false){if(id==='review')setReviewPreset(prev=>({key:prev.key+1,withInterests}));p.setTab(id);requestAnimationFrame(()=>{panel.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'start',behavior:'auto'})})}

 const tabs=useRef<Array<HTMLButtonElement|null>>([]);
 function move(index:number,e:KeyboardEvent<HTMLButtonElement>){let next:number;
  if(e.key==='ArrowLeft')next=(index+1)%tabIds.length;else if(e.key==='ArrowRight')next=(index+tabIds.length-1)%tabIds.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabIds.length-1;else return;
  e.preventDefault();selectTab(tabIds[next]);tabs.current[next]?.focus();
 }
 const metrics:Record<AdminTab,[string,string,string]>={
  readiness:['جاهزية الفرق','',''],ballot:['الحضور وتصويت الختام','',''],
  judging:['نتائج التحكيم','',''],
  review:['التحديات',num(stats.all.length),num(stats.published.length)+' منشورة · '+num(stats.drafts)+' مسودة'],
  workshop:[published?'القائمة المعلنة':'التصويت والاختيار',w.finalized?'معتمدة':w.open?'مفتوح':'موقوف',num(stats.votes)+' صوت · أعلى '+num(w.count)],
  operations:['التشغيل والأدوات','',''],
  participation:['المشاركون',d?num(d.employees.length):'—',reach?'دخل المنصة '+num(reach.entered)+' من أصل '+num(reach.total)+' موظفًا':directory.reach.error?'تعذّر تحميل سجل الدخول':'جارٍ تحميل سجل الدخول…']
 };
 async function action(a:WorkshopAction){const success=await p.onWorkshop(a);if(success)void directory.reload('participation');return success}
 async function remove(e:Entry){const success=await p.onDelete(e);if(success)void directory.reload('participation');return success}
 const audit=<details className="ba-card ba-disclosure ba-audit"><summary><span><b>سجل الإجراءات الإدارية</b> <em>{d?num(d.logTotal):'—'}</em></span><ChevronDown size={17}/></summary>
   <div className="ba-disclosure-body">{directory.participation.error?<p className="ba-error" role="alert">{directory.participation.error} <button type="button" className="ba-link" onClick={()=>void directory.reload('participation')}>إعادة التحميل</button></p>:!d?<p role="status">نحمّل سجل الإجراءات…</p>:d.logs.length?<>{d.logTotal>d.logs.length&&<p className="ba-help">آخر {num(d.logs.length)} إجراءً من أصل {num(d.logTotal)}.</p>}<ol className="ba-audit-list">{d.logs.map((x,i)=><li key={x.created_at+'-'+i}><span>{x.action}</span><time dateTime={new Date(x.created_at).toISOString()}>{new Date(x.created_at).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})}</time></li>)}</ol></>:<Empty>لا توجد إجراءات بعد.</Empty>}</div>
  </details>;
 const context=published&&shown==='workshop'?'':tabHints[shown];
 const overview=<dl className="ba-overview" aria-label="ملخص إحصائيات الإدارة">
   <div><dt><button type="button" onClick={()=>openSection('review')} aria-label="فتح قسم التحديات"><LayoutDashboard size={16} aria-hidden="true"/>التحديات</button></dt><dd>{num(stats.all.length)}</dd><dd className="ba-overview-detail">{metrics.review[2]}</dd></div>
   <div><dt><button type="button" onClick={()=>openSection('workshop')} aria-label="فتح ملخص التصويت والترشيح"><ListChecks size={16} aria-hidden="true"/>الأصوات</button></dt><dd>{num(stats.votes)}</dd><dd className="ba-overview-detail">{w.finalized?'عدد التحديات في القائمة المعتمدة: '+num(published?announced.length:w.selected.length):phaseText[stage]+' · أعلى '+num(w.count)}</dd></div>
   <div><dt><button type="button" onClick={()=>openSection('review',true)} aria-label="عرض التحديات التي عليها رغبات انضمام"><Users size={16} aria-hidden="true"/>رغبات الانضمام</button></dt><dd>{num(stats.interests)}</dd><dd className="ba-overview-detail">{stats.interestedChallenges?'على '+challengeQuantity(stats.interestedChallenges):'التحديات ذات الرغبات: '+num(0)}</dd></div>
   <div><dt><button type="button" onClick={()=>openSection('participation')} aria-label="فتح قسم الحسابات المسجّلة"><UserRoundCheck size={16} aria-hidden="true"/>الحسابات المسجّلة</button></dt><dd>{d?num(d.employees.length):'—'}</dd><dd className="ba-overview-detail">{d?metrics.participation[2]:directory.participation.error?'تعذّر تحميل الحسابات':'جارٍ تحميل الحسابات…'}</dd></div>
  </dl>;
 return <section className="ba-dashboard ba-organized" dir="rtl" aria-labelledby={base+'-title'}>
  <header className="ba-page-head ba-command-head"><div><span className="ba-eyebrow">هاكاثون الابتكار الرقمي · مساحة المنظّمين</span><h1 id={base+'-title'}>لوحة إدارة بذرة</h1><p>{published?'تابع جاهزية الفرق، وسجّل حضور جلسة العروض، ثم راجع نتائج التحكيم وتصويت الجمهور.':w.finalized?'اعتُمدت القائمة. راجع التحديات المرشّحة قبل إعلانها وتكوين فرقها.':'تابع مشاركة الموظفين وراجع الترشيحات استعدادًا لتكوين الفرق.'}</p></div><div className="bj-head-actions"><a className={'ba-btn'+(published?'':' ba-primary')} href="/teams">{published?'إدارة الفرق والتقييم':'مراجعة الترشيحات وإعلانها'}<ArrowLeft size={16} aria-hidden="true"/></a></div></header>
  {!published&&overview}

  <label className="ba-mobile-nav">انتقل إلى<select value={p.tab} aria-controls={base+'-panel'} onChange={e=>selectTab(e.target.value as AdminTab)}>{published?<><optgroup label="أعمال يوم الفعالية">{tabIds.slice(0,3).map(id=><option key={id} value={id}>{metrics[id][0]}</option>)}</optgroup><optgroup label="إدارة الدورة">{tabIds.slice(3).map(id=><option key={id} value={id}>{metrics[id][0]}</option>)}</optgroup></>:tabIds.map(id=><option key={id} value={id}>{metrics[id][0]}</option>)}</select></label>
  <div className="ba-tabs" data-announced={published} role="tablist" aria-label="أقسام الإدارة">{tabIds.map((id,i)=>{const [label]=metrics[id],Icon=tabIcons[id];return <button type="button" role="tab" aria-label={label} key={id} ref={el=>{tabs.current[i]=el}} id={base+'-'+id} aria-selected={p.tab===id} aria-controls={base+'-panel'} tabIndex={p.tab===id?0:-1} onKeyDown={e=>move(i,e)} onClick={()=>selectTab(id)}>
    <span className="ba-tab-label"><Icon size={18} aria-hidden="true"/>{label}</span>
   </button>})}</div>
  <div ref={panel} tabIndex={-1} id={base+'-panel'} role="tabpanel" aria-label={metrics[shown][0]} className="ba-panel">
   <div key={shown} className="ba-panel-content">
   {context&&<div className="ba-context"><p>{context}</p></div>}
   {shown==='readiness'&&published?<AdminTeamReadiness initialRows={p.initialReadiness}/>:shown==='ballot'&&published?<AdminFinalVote/>:shown==='judging'&&published?<AdminJudgingResults notify={p.notify} onAccessLost={p.onAccessLost}/>:shown==='review'?<><ChallengeAdmin key={reviewPreset.key} initialWithInterests={reviewPreset.withInterests} announcedIds={announced.map(t=>t.id)} entries={stats.all} busy={p.busy} onDelete={remove}/></>:shown==='workshop'?<>{published&&<details className="ba-card ba-disclosure ba-nomination-history"><summary><b>ملخص مرحلة الترشيح</b><ChevronDown size={17}/></summary>{overview}</details>}<AdminWorkshop announced={announced} entries={stats.published} order={p.order} workshop={w} count={p.count} title={p.title} setTitle={p.setTitle} setCount={p.setCount} busy={p.busy} onAction={action} download={p.download}/></>:shown==='participation'?<ParticipationAdmin directory={directory} notify={p.notify}/>:<div className="ba-stack"><details className="ba-card ba-disclosure"><summary><b>إعدادات الفعالية والمشاركة</b><ChevronDown size={17}/></summary><div className="ba-disclosure-body ba-stack"><AdminIntake announced={published} workshop={w} busy={p.busy} onAction={action}/><ParticipationAdmin directory={directory} notify={p.notify} mode="settings"/></div></details><details className="ba-card ba-disclosure"><summary><b>العرض والتقارير</b><ChevronDown size={17}/></summary><div className="ba-disclosure-body ba-stack"><AdminReportDownload notify={p.notify} onAccessLost={p.onAccessLost}/><AdminPresentationLink notify={p.notify}/></div></details><AdminInquiries onAccessLost={p.onAccessLost} notify={p.notify}/>{audit}</div>}
   </div>
  </div>

 </section>
}
