'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import EventHeader from '../components/event-header';
import {Users,ArrowLeft,FileCheck2,ClipboardList} from 'lucide-react';
import TeamDeliverables,{type DeliveryData} from './team-deliverables';
import {rubric,weighted,resultDisplay,type TeamResult,type JudgingReview} from '@/lib/team-card';
import {useJudgingResults} from '../components/use-judging-results';
type Person={id:string;name:string};type Entry={id:string;title:string;rank:number};type Score=JudgingReview;
type Team=Entry&DeliveryData&{result?:TeamResult;audience?:number|null;members:Person[];evaluations:Score[]};
export type DeskData={name:string;manager:boolean;judge:boolean;me:string;teams:Team[];announced:Entry[];people:Person[];judges:string[];options:{id:string;title:string;votes:number}[];suggested:string[]|null;count:number;revision:number};
type Act=(p:Record<string,unknown>)=>Promise<boolean>;
const suggested=(d:DeskData|null)=>d?.manager?(d.suggested??d.options.slice(0,d.count).map(x=>x.id)):[];
function Published({list}:{list:Entry[]}){return <div className="td-public">{list.map(x=><a key={x.id} href={'/challenge/'+x.id}><span className="td-number">{String(x.rank).padStart(2,'0')}</span><b>{x.title}</b><ArrowLeft size={17} aria-hidden="true"/></a>)}</div>}
export default function TeamDesk({initialData=null,initialTeam=''}:{initialData?:DeskData|null;initialTeam?:string}){
 const [d,set]=useState(initialData),[msg,say]=useState(''),[err,error]=useState(false),[busy,lock]=useState(false),[picks,pick]=useState<string[]>(suggested(initialData)),[confirm,arm]=useState(false),[focus,choose]=useState(initialTeam),[judges,showJudges]=useState(false);
 async function load(){const res=await fetch('/api/teams',{cache:'no-store'});if(!res.ok)throw Error('تعذّر تحميل الفرق.');const next=await res.json() as DeskData;set(next);if(next.manager)pick(suggested(next));}
 useEffect(()=>{if(!initialData)load().catch(e=>{error(true);say(e.message)})},[initialData]);
 useEffect(()=>{if(!msg||err||busy)return;const timer=setTimeout(()=>say(''),4000);return()=>clearTimeout(timer)},[msg,err,busy]);
 const latest=useRef(d);latest.current=d;const hasDesk=!!d;
 useEffect(()=>{function followLink(){
  const d=latest.current;
  const hash=location.hash;
  if(hash==='#judges'&&d?.manager){showJudges(true);requestAnimationFrame(()=>document.getElementById('judges')?.scrollIntoView({block:'start'}));return}
  const id=hash.startsWith('#team-')?hash.slice(6):new URLSearchParams(location.search).get('team');
  if(!id||!d?.teams.some(t=>t.id===id))return;choose(id);
  requestAnimationFrame(()=>{
   if(hash==='#deliverables'){const heading=document.getElementById('td-deliveries-'+id);heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'});return}
   if(hash==='#judging-results'&&d.manager){
    const details=document.getElementById('results-'+id) as HTMLDetailsElement|null;
    if(details){details.open=true;details.querySelector('summary')?.focus({preventScroll:true});details.scrollIntoView({block:'start'});return}
   }
   document.getElementById('team-workspace')?.scrollIntoView({block:'start'});
  });
 }followLink();window.addEventListener('hashchange',followLink);return()=>window.removeEventListener('hashchange',followLink)},[hasDesk]);
 async function send(url:string,init:RequestInit,success='حُفظ التغيير.'){if(busy)return false;lock(true);say('');error(false);try{const r=await fetch(url,init);if(!r.ok)throw Error(((await r.json()) as {error:string}).error);await load();say(success);return true;}catch(e){error(true);say((e as Error).message||'تعذّر الحفظ. حاول مجددًا.');return false;}finally{lock(false)}}
 const act:Act=p=>{if(p.action==='score'&&typeof p.team==='string')choose(p.team);return send('/api/teams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)},({announce:'أُعلنت التحديات وأصبحت الفرق متاحة.',judge:'حُدّث تكليف المقيّم.',member:'حُدّث أعضاء الفريق.',score:'حُفظت بطاقة التقييم.',solution:'حُفظ رابط الحل.',instructions:'حُفظت إرشادات الحل.',slidesLink:'حُفظ العرض التقديمي.',audience:'حُفظت درجة تصويت الجمهور.'} as Record<string,string>)[String(p.action)]);};
 const eligible=d?.judge?d.teams.filter(t=>!t.mine):[],judged=eligible.filter(t=>t.evaluations.some(e=>e.person===d?.me));
 const active=d?.teams.find(t=>t.id===focus)??eligible.find(t=>!t.evaluations.some(e=>e.person===d?.me))??eligible[0]??d?.teams[0],announced=!!d?.announced.length;
 function selectTeam(id:string,advance=false){choose(id);history.replaceState(null,'','#team-'+id);if(advance||matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>{const heading=document.getElementById('workspace-title-'+id);heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'});});}

 return <><EventHeader route="teams" judge={!!d?.judge} manager={!!d?.manager} employee={!!d?.me}/><main id="bz-main" tabIndex={-1} className="team-page"><div className="team-wrap">
 <nav className="td-breadcrumb" aria-label="مسار الصفحة"><a href={d?.manager?'/admin':'/challenges'}>{d?.manager?'الإدارة':'التحديات'}</a><span aria-hidden="true">/</span>تحديات الفريق</nav>
 <div className="td-heading"><span className="td-eyebrow">{announced?'مرحلة بناء الحلول':'الترشيح للهاكاثون'}</span><h1>{d?.manager?'إدارة فرق التحديات':d?.judge?'بطاقات تقييم الفرق':'تحديات الفريق'}</h1><p>{d?.manager?(announced?'وزّع الأعضاء، وتابع تسليم الحلول والعروض ودرجات التحكيم لكل فريق.':'راجع الترشيحات قبل إعلان الفرق وتكليف المقيّمين.') :d?.judge?'لك بطاقة مستقلة لكل فريق. راجع الحل والعرض، ثم قيّم المعايير الستة ووقّع بطاقتك.':d?.me?'هنا تجد الفرق التي تعمل معها، ومكان تسليم الحل والعرض التقديمي.':'تعرّف على التحديات المختارة وادخل إلى مساحة فريقك.'}</p></div>
 <div className={'td-status'+(err?' is-error':'')} role="status">{busy?'جارٍ الحفظ…':msg}</div>
 {!d?<p>{msg?<button onClick={()=>location.reload()}>إعادة المحاولة</button>:'جارٍ تحميل الفرق…'}</p>:<fieldset className="team-body" disabled={busy}>
 {d.manager&&<>{!announced&&<section className="td-card"><h2>إعلان التحديات المرشّحة</h2><p>حدّد التحديات التي ستشارك في الورشة. يمكنك مراجعة الاختيار قبل الإعلان.</p>{d.options.map(x=><label className="pick" key={x.id}><input type="checkbox" checked={picks.includes(x.id)} onChange={e=>{arm(false);pick(e.target.checked?[...picks,x.id]:picks.filter(id=>id!==x.id))}}/>{x.title}<small>{x.votes} صوت</small></label>)}{confirm?<div className="notice"><b>سيرى الجميع هذه التحديات، ويُغلق التصويت والانضمام.</b><ul>{d.options.filter(x=>picks.includes(x.id)).map(x=><li key={x.id}>{x.title}</li>)}</ul><button onClick={()=>act({action:'announce',ids:picks,revision:d.revision})}>تأكيد الإعلان وتكوين الفرق</button> <button className="plain" onClick={()=>arm(false)}>تراجع</button></div>:<button disabled={!picks.length||picks.length>20} onClick={()=>arm(true)}>مراجعة الترشيحات ({picks.length})</button>}</section>}
 <details id="judges" open={judges} onToggle={e=>showJudges(e.currentTarget.open)} className="td-card td-judges"><summary><span><ClipboardList size={20} aria-hidden="true"/>لجنة التحكيم</span><small>عدد المقيّمين: {d.judges.length}</small></summary><p>يستطيع المقيّم مراجعة تسليمات الفرق وتقييم الفرق التي ليس عضوًا فيها.</p><People people={d.people} chosen={d.judges} label="مقيّم" change={(person,enabled)=>act({action:'judge',person,enabled})}/></details></>}
 {!!d.teams.length&&active?<div className="td-work-grid"><aside className="td-card td-picker"><h2>{d.manager||d.judge?'الفرق المعتمدة':'فرقي'} <small>{d.teams.length}</small></h2>{d.judge&&<p className="jury-progress" aria-live="polite">بطاقاتي المحفوظة: <b>{judged.length} من {eligible.length}</b></p>}<div className="td-picker-list">{d.teams.map(t=><button key={t.id} type="button" aria-pressed={active.id===t.id} aria-controls="team-workspace" onClick={()=>selectTeam(t.id)}><span className="td-number">{String(t.rank).padStart(2,'0')}</span><span>{t.title}{d.judge&&<small className="jury-picker-status">{t.mine?'عضو في الفريق · لا يُقيّم':t.evaluations.some(e=>e.person===d.me)?'✓ حُفظ تقييمي':'بانتظار تقييمي'}</small>}</span></button>)}</div></aside>
 <div id="team-workspace" className="td-card td-workspace">{d.teams.map(t=><div key={t.id} hidden={t.id!==active.id}><div className="td-title-row"><span className="td-eyebrow">فريق التحدي {t.rank} {t.mine?' · فريقي':''}</span><a href={'/challenge/'+t.id}>بطاقة التحدي ←</a></div><h2 id={'workspace-title-'+t.id} tabIndex={-1}>{t.title}</h2>{d.judge&&!t.mine&&<button className="jury-jump" type="button" onClick={()=>{const heading=document.getElementById('jury-title-'+t.id);heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start'})}}>انتقل إلى بطاقة تقييمي لهذا الفريق ↓</button>}<div className="td-roster"><span><Users size={16} aria-hidden="true"/>أعضاء الفريق</span><p>{t.members.map(m=>m.name).join('، ')||'لم يُسند أعضاء بعد.'}</p></div>
 {d.manager&&<details className="td-disclosure"><summary>إسناد أعضاء الفريق</summary><People label="عضو" people={d.people} chosen={t.members.map(m=>m.id)} change={(person,enabled)=>act({action:'member',team:t.id,person,enabled})}/></details>}
 <TeamDeliverables team={t} title={t.title} manager={d.manager} act={act} upload={(file)=>send('/api/teams/file?team='+encodeURIComponent(t.id)+'&kind=slides&name='+encodeURIComponent(file.name),{method:'POST',body:file},'حُفظ مرفق العرض التقديمي.')}/>
 {d.judge&&!!t.mine&&<p className="td-note">أنت عضو في هذا الفريق؛ لا تدخل بطاقته ضمن تقييماتك.</p>}
 {d.judge&&!t.mine&&<Evaluation key={t.evaluations.find(x=>x.person===d.me)?.stamp||'new'} t={t} me={d.me} name={d.name} act={act} next={()=>{const other=eligible.find(x=>x.id!==t.id&&!x.evaluations.some(s=>s.person===d.me));if(other)selectTeam(other.id,true)}} remaining={eligible.filter(x=>x.id!==t.id&&!x.evaluations.some(s=>s.person===d.me)).length}/>}
 {d.manager&&<Results t={t} active={t.id===active.id} act={act}/>}</div>)}</div></div>:!d.manager&&<section className="td-card"><h2>{announced?'التحديات المعتمدة':'التحديات المرشّحة'}</h2>{announced?<Published list={d.announced}/>:<p>لم تُعلن الترشيحات بعد.</p>}{d.me&&!d.judge&&<p className="td-note">تظهر مساحة العمل والتسليم هنا عندما يُسند إليك فريق.</p>}{!d.me&&<a className="td-cta" href="/login?next=%2Fteams">دخول الموظفين ←</a>}</section>}
 {!!d.teams.length&&d.announced.length>d.teams.length&&<details className="td-card"><summary>استعرض بقية التحديات المعتمدة</summary><Published list={d.announced.filter(e=>!d.teams.some(t=>t.id===e.id))}/></details>}
 </fieldset>}</div></main></>;
}
function People({people,chosen,label,change}:{people:Person[];chosen:string[];label:string;change:(id:string,on:boolean)=>Promise<boolean>}){
 const [id,set]=useState('');return <><div className="chips">{people.filter(p=>chosen.includes(p.id)).map(p=><button className="plain" key={p.id} aria-label={'إزالة '+p.name} onClick={()=>change(p.id,false)}>{p.name} ×</button>)}</div><form onSubmit={async e=>{e.preventDefault();if(id&&await change(id,true))set('')}}><label>إضافة {label}<select required value={id} onChange={e=>set(e.target.value)}><option value="">اختر من الحسابات المسجلة</option>{people.filter(p=>!chosen.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button>إضافة</button></form></>;
}
const scale=['ضعيف','مقبول','جيد','جيد جدًا','ممتاز'];
const cardDate=(stamp:number)=>new Intl.DateTimeFormat('ar-SA',{calendar:'gregory',timeZone:'Asia/Riyadh',day:'numeric',month:'long',year:'numeric'}).format(stamp);
function Evaluation({t,me,name,act,next,remaining}:{t:Team;me:string;name:string;act:Act;next:()=>void;remaining:number}){
 const old=t.evaluations.find(x=>x.person===me),[scores,setScores]=useState<number[]>(old?.card.scores??rubric.map(()=>0)),[notes,setNotes]=useState<string[]>(old?.card.notes??rubric.map(()=>'')),[signature,sign]=useState(old?.card.signature??'');
 const dirty=scores.some((n,i)=>n!==(old?.card.scores[i]??0))||notes.some((n,i)=>n!==(old?.card.notes[i]??''))||signature!==(old?.card.signature??'');
 const total=weighted(scores),complete=scores.filter(Boolean).length;
 const [attempted,check]=useState(false),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false);
 const sigError=attempted&&signature.trim().length<2,missing=scores.findIndex(n=>!n),receiptId='jury-receipt-'+t.id;
 const focus=(id:string,near=false)=>requestAnimationFrame(()=>{const el=document.getElementById(id);el?.focus({preventScroll:true});el?.scrollIntoView({block:near?'nearest':'center'})});
 useEffect(()=>{if(!dirty)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect)},[dirty]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(saving)return;check(true);setFailed(false);
  if(missing!==-1){focus('rating-'+t.id+'-'+missing+'-1');return}
  if(signature.trim().length<2){focus('signature-'+t.id);return}
  setSaving(true);try{if(await act({action:'score',team:t.id,scores,notes,signature:signature.trim()}))focus(receiptId,true);else setFailed(true)}finally{setSaving(false)}
 }
 return <section className="jury-card" aria-labelledby={'jury-title-'+t.id}><header className="jury-head"><div><span className="td-eyebrow">بطاقتي لهذا الفريق</span><h3 id={'jury-title-'+t.id} tabIndex={-1}><FileCheck2 size={21} aria-hidden="true"/>بطاقة تقييم لجنة التحكيم</h3></div><span className="jury-state" data-state={dirty?'draft':old?'saved':'new'}>{dirty?'تعديلات غير محفوظة':old?'✓ حُفظ تقييمي':'لم تُرسل البطاقة'}</span></header>
 <dl className="jury-facts"><div><dt>اسم الفريق</dt><dd>{t.title}</dd></div><div><dt>رقم التحدي</dt><dd>{t.rank}</dd></div><div><dt>اسم المقيّم</dt><dd>{name}</dd></div><div><dt>{old?'تاريخ حفظ التقييم':'التاريخ'}</dt><dd>{cardDate(old?.stamp??Date.now())}</dd></div></dl>
 <div className="jury-scale"><b>سلّم الدرجات</b><p>اختر لكل معيار درجة من 1 (ضعيف) إلى 5 (ممتاز). يمكنك إضافة ملاحظة بجانب كل معيار.</p><small>الدرجة الموزونة = (الدرجة ÷ 5) × وزن المعيار.</small></div>
 <form className="score-form jury-form" noValidate onSubmit={submit} aria-busy={saving}>{rubric.map(([criterion,question,weight],i)=><fieldset className="jury-criterion" data-invalid={attempted&&!scores[i]} key={criterion}><legend>{i+1}. {criterion}</legend>
 <p id={'jury-question-'+t.id+'-'+i}>{question}</p><div className="jury-rating"><div className="jury-options">{scale.map((label,j)=><label className="jury-option" key={label}><input type="radio" name={'rating-'+t.id+'-'+i} value={j+1} id={'rating-'+t.id+'-'+i+'-'+(j+1)} required aria-invalid={attempted&&!scores[i]||undefined} aria-describedby={'jury-question-'+t.id+'-'+i+(attempted&&!scores[i]?' jury-error-'+t.id+'-'+i:'')} checked={scores[i]===j+1} aria-label={criterion+': '+(j+1)+' · '+label} onChange={()=>setScores(previous=>previous.map((v,k)=>k===i?j+1:v))}/><span aria-hidden="true"><b>{j+1}</b><em>{label}</em></span></label>)}</div>
 <output aria-label={'الدرجة الموزونة لمعيار '+criterion}>{scores[i]?scores[i]*weight/5:'—'} / {weight}</output></div>
 {attempted&&!scores[i]&&<p className="jury-field-error" id={'jury-error-'+t.id+'-'+i}>اختر درجة لهذا المعيار.</p>}
 <label className="jury-note">ملاحظات المقيّم <small>(اختياري)</small><textarea rows={1} maxLength={1000} value={notes[i]} onChange={e=>setNotes(previous=>previous.map((v,k)=>k===i?e.target.value:v))}/></label></fieldset>)}
 <div className="jury-summary"><span>مجموع درجتي لهذا الفريق<b>{total} / 70</b></span><small>{complete} من {rubric.length} معايير مكتملة</small></div>
 <label htmlFor={'signature-'+t.id}>توقيع المقيّم (الاسم)<input id={'signature-'+t.id} aria-invalid={sigError||undefined} aria-describedby={sigError?'signature-hint-'+t.id:undefined} name="signature"  required minLength={2} maxLength={100} pattern=".*\S.*\S.*" placeholder="اكتب اسمك للتوقيع" value={signature} onChange={e=>sign(e.target.value)}/></label>
 {sigError&&<p id={'signature-hint-'+t.id} className="jury-field-error">اكتب اسمك للتوقيع بحرفين على الأقل.</p>}
 {failed&&<p role="alert" className="jury-field-error">تعذّر حفظ هذه البطاقة. إجاباتك ما زالت هنا؛ حاول الحفظ مجددًا.</p>}
 {old&&!dirty&&<div id={receiptId} tabIndex={-1} className="jury-receipt"><b>حُفظ تقييمك لهذا الفريق.</b> <span>{remaining?'بطاقات تنتظر تقييمك: '+remaining+'.':'أكملت تقييم جميع الفرق المكلّف بها.'}</span></div>}
 <div className="jury-save"><button type="submit" disabled={saving||!!old&&!dirty}>{saving?'جارٍ حفظ بطاقتك…':old?'حفظ تعديلات التقييم':'حفظ بطاقة التقييم'}</button>{old&&!dirty&&remaining>0&&<button type="button" className="plain" onClick={next}>الفريق التالي الذي ينتظر تقييمي ←</button>}</div>
 </form></section>;
}
function Results({t,active,act}:{t:Team;active:boolean;act:Act}){
 const [open,setOpen]=useState(false);
 const {rows,refresh,fault}=useJudgingResults({enabled:open&&active,teamId:t.id,onAccessLost:()=>location.reload()});
 const live=open&&active?rows?.[0]:undefined,reviews=live?.evaluations??t.evaluations,r=live?.result??t.result,display=r?resultDisplay(r):null;
 return <details id={'results-'+t.id} onToggle={e=>{if(e.target===e.currentTarget)setOpen(e.currentTarget.open)}}>
  <summary>نتيجة التحكيم وتصويت الجمهور</summary>
  <p>بطاقات اللجنة المحتسبة: {r?.submitted??0} من {r?.required??0}</p>
  <p>متوسط تقييم اللجنة: {r?.committee==null?'بانتظار أول بطاقة':r.committee.toFixed(2)+' / 70'}</p>
  <b>{display?.label??'النتيجة الحالية'}: {display?.value==null?'بانتظار أول بطاقة':display.value.toFixed(2)+' / '+display.max}</b>
  {display&&<p>{display.status}</p>}
  {fault&&<p role="alert">{fault} تظهر آخر نتيجة متاحة. <button type="button" className="plain" onClick={()=>void refresh()}>تحديث النتائج</button></p>}
  {reviews.map(e=><details key={e.person}><summary>{e.name} · {e.card.total} / 70 {e.eligible===false?'· بطاقة سابقة غير محتسبة':''}</summary><p>الفريق: {t.title} · رقم التحدي: {t.rank} · {new Date(e.stamp).toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh'})}</p>{rubric.map(([n,,w],i)=><p key={n}>{n}: {e.card.scores[i]} / 5 · الموزونة {e.card.scores[i]*w/5} / {w} {e.card.notes[i]&&'· '+e.card.notes[i]}</p>)}<p>توقيع المقيّم: {e.card.signature}</p></details>)}
  <form onSubmit={async e=>{e.preventDefault();const value=Number(new FormData(e.currentTarget).get('audience'));if(await act({action:'audience',team:t.id,value}))await refresh()}}>
   <label>درجة تصويت الجمهور على الحل النهائي (من 30)<input type="number" name="audience" required step="0.01" min="0" max="30" defaultValue={r?.audience??''}/></label><button>حفظ الدرجة من 30</button>
  </form><p><a href="/admin?tab=results">عرض نتائج جميع الفرق ←</a></p>
 </details>;
}
