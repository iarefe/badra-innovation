'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,Check,Copy,MonitorPlay,RefreshCw,Search,UsersRound} from 'lucide-react';
import {normalizeSearch,num} from '@/lib/admin-dashboard';
import type {BallotPhase,FinalBallotAdmin} from '@/lib/final-ballot';
import {ballotLink} from '@/lib/final-vote-link';
import './admin-final-vote.css';


const statusText:Record<BallotPhase,string>={not_open:'لم يُفتح التصويت',open:'التصويت مفتوح',closed:'التصويت مغلق'};
const phaseMessage:Record<BallotPhase,string>={not_open:'عند انتهاء عروض الفرق، افتح التصويت واعرض الرمز في القاعة.',open:'يستطيع كل موظف سُجّل حضوره اختيار فريق واحد من جواله.',closed:'توقّف استقبال الأصوات. يمكنك مراجعة الحصيلة أو استئناف التصويت مع الاحتفاظ بالأصوات السابقة.'};
type Feedback={area:'attendance'|'phase';message:string;error?:boolean};
function ActionFeedback({area,value}:{area:Feedback['area'];value:Feedback|null}){
 const hit=value?.area===area?value:null;
 return <><div aria-live="polite" aria-atomic="true" className={hit&&!hit.error?'afv-notice':'sr-only'}>{hit&&!hit.error?hit.message:''}</div><div role="alert" aria-atomic="true" className={hit?.error?'ba-error afv-message':'sr-only'}>{hit?.error?hit.message:''}</div></>;
}
type Change={action:'attendance';person:string;attending:boolean}|{action:'open'|'close'};

export default function AdminFinalVote(){
 const ballotURL=ballotLink(typeof window==='undefined'?'':window.location.origin);
 const [data,setData]=useState<FinalBallotAdmin|null>(null),[error,setError]=useState(''),[feedback,setFeedback]=useState<Feedback|null>(null);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'present'>('all'),[confirm,setConfirm]=useState(false);
 const [pending,setPending]=useState(''),[refreshing,setRefreshing]=useState(false),[manualCopy,setManualCopy]=useState(false);
 const listId=useId(),search=useRef<HTMLInputElement>(null),phaseAction=useRef<HTMLButtonElement>(null),cancelClose=useRef<HTMLButtonElement>(null);
 const guard=useRef(false),request=useRef<AbortController|null>(null),mounted=useRef(false),copyInput=useRef<HTMLInputElement>(null);
 const load=useCallback(async()=>{
  request.current?.abort();const ctrl=new AbortController();request.current=ctrl;setRefreshing(true);
  try{const res=await fetch('/api/final-vote?admin=1',{cache:'no-store',signal:ctrl.signal});const body=await res.json() as FinalBallotAdmin & {error?:string};
   if(!res.ok){if(res.status===401||res.status===403)setData(null);throw Error(body.error||'تعذّر تحميل بيانات التصويت.');}
   if(!ctrl.signal.aborted){setData(body);setError('');}
  }catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'تعذّر تحميل بيانات التصويت.');}
  finally{if(!ctrl.signal.aborted)setRefreshing(false);}
 },[]);
 useEffect(()=>{mounted.current=true;void load();const active=()=>{if(!document.hidden&&!guard.current)void load()};window.addEventListener('focus',active);document.addEventListener('visibilitychange',active);const interval=window.setInterval(active,15000);return()=>{mounted.current=false;request.current?.abort();window.removeEventListener('focus',active);document.removeEventListener('visibilitychange',active);clearInterval(interval)}},[load]);
 useEffect(()=>{if(confirm)cancelClose.current?.focus()},[confirm]);
 useEffect(()=>{if(manualCopy){copyInput.current?.focus();copyInput.current?.select()}},[manualCopy]);
 async function change(body:Change){
  if(guard.current)return;guard.current=true;const key=body.action==='attendance'?body.person:body.action;setPending(key);setFeedback(null);setError('');
  const area=body.action==='attendance'?'attendance':'phase',name=body.action==='attendance'?data?.people.find(p=>p.id===body.person)?.name:undefined;
  try{const res=await fetch('/api/final-vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!mounted.current)return;
   if(!res.ok){if(res.status===401||res.status===403)setData(null);const e=await res.json() as {error?:string};throw Error(e.error||'تعذّر الحفظ. حاول مجددًا.');}
   setFeedback({area,message:body.action==='attendance'?((body.attending?'سُجّل حضور ':'أُلغي حضور ')+(name||'الموظف')+'.'):(body.action==='open'?'فُتح تصويت الختام.':'أُغلق تصويت الختام.')});setConfirm(false);await load();
   requestAnimationFrame(()=>{if(!mounted.current||document.activeElement!==document.body)return;
    if(body.action==='attendance'&&!body.attending&&filter==='present')search.current?.focus();
    else if(area==='phase')phaseAction.current?.focus();
   });
  }catch(e){if(mounted.current){const message=e instanceof Error?e.message:'تعذّر الحفظ. حاول مجددًا.';setFeedback({area,message,error:true});if(!data)setError(message);}}
  finally{guard.current=false;if(mounted.current)setPending('');}
 }
 async function copy(){try{await navigator.clipboard.writeText(ballotURL);setManualCopy(false);setFeedback({area:'phase',message:'نُسخ رابط تصويت الجمهور.'});}catch{setManualCopy(true);copyInput.current?.select()}}
 const present=data?.people.filter(p=>p.attending).length??0,q=normalizeSearch(query);
 const list=data?.people.filter(p=>(filter==='all'||p.attending)&&normalizeSearch(p.name).includes(q))??[];
 return <section className="ba-announced-panel afv-admin" aria-label="الحضور وتصويت الختام">
  <header className="afv-head"><div><span className="ba-eyebrow">جلسة عرض الحلول</span><h2>الحضور وتصويت الختام</h2></div><button type="button" className="ba-btn" disabled={refreshing||!!pending} onClick={load}><RefreshCw size={16} aria-hidden="true"/>{refreshing?'جارٍ التحديث…':'تحديث'}</button></header>
  {(error||(!data&&feedback?.error))&&<p className="ba-error afv-message" role="alert">{error||feedback?.message}</p>}
  {!data&&!error&&!feedback?.error&&<p role="status">نحمّل سجل الحضور وحصيلة التصويت…</p>}
  {data&&<>
   <div className="afv-grid">
    <section className="afv-block"><header className="afv-title"><span aria-hidden="true">01</span><h3>سجّل حضور الجلسة</h3></header>
     <p>سجّل الموظف عند حضوره فعليًا للجلسة الختامية. تسجيل دخوله إلى المنصة لا يُسجّل حضوره هنا.</p>
     <label className="afv-search-field"><span>البحث عن موظف</span><span className="afv-search"><Search size={17} aria-hidden="true"/><input ref={search} type="search" aria-controls={listId} placeholder="اكتب اسم الموظف" value={query} onChange={e=>setQuery(e.target.value)}/></span></label>
     <div className="afv-filter" role="group" aria-label="تصفية الحضور">{(['all','present'] as const).map(v=><button type="button" aria-pressed={filter===v} key={v} onClick={()=>setFilter(v)}>{v==='all'?'الكل · '+num(data.people.length):'الحاضرون · '+num(present)}</button>)}</div>
     {q&&<p className="afv-match" role="status" aria-atomic="true">عدد الأسماء المطابقة: <b>{num(list.length)}</b></p>}
     {list.length?<ul className="afv-roster" id={listId} aria-label="الموظفون المطابقون">{list.map(p=><li key={p.id}><span className="afv-person">{p.name}{p.attending&&<small><Check size={13} aria-hidden="true"/>حاضر</small>}</span><button className="afv-check" type="button" aria-label={(p.attending?'إلغاء تسجيل حضور ':'تسجيل حضور ')+p.name} data-present={p.attending} aria-disabled={!!pending} onClick={()=>change({action:'attendance',person:p.id,attending:!p.attending})}>{pending===p.id?'جارٍ الحفظ…':p.attending?'إلغاء الحضور':'تسجيل الحضور'}</button></li>)}</ul>:<div id={listId} className="afv-empty"><p>{q?'لا يوجد موظف يطابق البحث.':filter==='present'?'لم يُسجّل حضور أحد بعد.':'لا توجد حسابات موظفين متاحة.'}</p>{(q||filter==='present')&&<button className="ba-link" type="button" onClick={()=>{setQuery('');setFilter('all');search.current?.focus()}}>عرض جميع الموظفين</button>}</div>}
     <ActionFeedback area="attendance" value={feedback}/>
    </section>
    <section className="afv-block"><header className="afv-title"><span aria-hidden="true">02</span><h3>اعرض رمز التصويت</h3></header>
     <div className="afv-phase" data-phase={data.phase}><b>{statusText[data.phase]}</b><p>{phaseMessage[data.phase]}</p></div>
     {data.phase==='open'?confirm?<div className="afv-confirm" role="group" aria-label="تأكيد إغلاق التصويت"><p>سيُوقف استقبال أصوات جديدة، وتبقى الأصوات المسجّلة محفوظة.</p><button type="button" className="ba-btn ba-primary" disabled={!!pending} onClick={()=>change({action:'close'})}>{pending==='close'?'جارٍ الإغلاق…':'تأكيد الإغلاق'}</button><button type="button" className="ba-btn" disabled={!!pending} ref={cancelClose} onClick={()=>{setConfirm(false);requestAnimationFrame(()=>phaseAction.current?.focus())}}>تراجع</button></div>:<button type="button" className="ba-btn" disabled={!!pending} ref={phaseAction} onClick={()=>setConfirm(true)}>إغلاق تصويت الختام</button>:<button className="ba-btn ba-primary" type="button" disabled={!!pending||!data.teams.length} ref={phaseAction} onClick={()=>change({action:'open'})}>{pending==='open'?'جارٍ الفتح…':data.phase==='closed'?'استئناف التصويت':'فتح تصويت الختام'}</button>}
     {!data.teams.length&&<small>يُتاح الفتح بعد إعلان الفرق.</small>}
     <div className="afv-screen-links"><a className="ba-btn" href="/final-vote/screen" target="_blank" rel="noopener noreferrer"><MonitorPlay size={17} aria-hidden="true"/>فتح شاشة القاعة ↗</a><button type="button" className="ba-btn" onClick={copy}><Copy size={15} aria-hidden="true"/>نسخ رابط التصويت</button></div>
     {manualCopy&&<label>انسخ الرابط<input ref={copyInput} readOnly value={ballotURL} dir="ltr" onFocus={e=>e.currentTarget.select()}/></label>}
     <ActionFeedback area="phase" value={feedback}/>
    </section>
   </div>
   <section className="afv-block"><header className="afv-head"><div className="afv-title"><span aria-hidden="true">03</span><h3>حصيلة تصويت الجمهور</h3></div><small className="afv-count"><UsersRound size={16} aria-hidden="true"/>الأصوات: {num(data.cast)} · الحاضرون: {num(present)}</small></header>
    <p>تمثّل النسبة حصة الفريق من الأصوات المسجّلة. ترصد الإدارة درجة الجمهور من 30 في نتائج التحكيم.</p>
    {data.teams.length?<ul className="afv-tally">{data.teams.map(team=>{const share=data.cast?team.votes*100/data.cast:0;return <li key={team.id}><div><strong>{team.title}</strong><span>{num(team.votes)} صوت · {new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(share)}٪</span></div><div className="afv-track" aria-hidden="true"><i style={{width:share+'%'}}/></div></li>})}</ul>:<p className="afv-empty">تظهر الحصيلة بعد إعلان الفرق.</p>}
    <a className="ba-btn" href="/admin?tab=results">نتائج التحكيم ورصد درجة الجمهور <ArrowLeft size={15} aria-hidden="true"/></a>
   </section>
  </>}
 </section>;
}
