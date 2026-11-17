'use client';
import ChallengeImpactFacts from './challenge-impact-facts';
import {useEffect,useRef,useState} from 'react';
import SmoothDisclosure from './smooth-disclosure';
import {Users,Eye,Target,FileText,Search,ArrowLeft,MessageCircle,Workflow,FlaskConical,Focus,Lightbulb} from 'lucide-react';
import {Challenge,howMightWe,explorationQuestions,workshopOutputs} from '@/lib/challenges';
import {ProfileAvatar} from './profile-avatar';
function Lines({text,empty}:{text?:string;empty?:string}){const lines=(text||'').split('\n').map(x=>x.trim().replace(/^[-•]\s*/, '')).filter(Boolean);return lines.length>1?<ul>{lines.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className={lines.length?'':'dossier-empty'}>{lines[0]||empty}</p>}
function Panel({title,text,empty,tone='',note,Icon}:{title:string;text?:string;empty?:string;tone?:string;note?:string;Icon?:typeof Users}){return <div className={'dossier-text-panel '+tone}><h3>{Icon&&<Icon size={18}/>}<span>{title}</span></h3><Lines text={text} empty={empty}/>{note&&<small>{note}</small>}</div>}
export default function ChallengeDossier({challenge:c,preview=false,showOwners=true,authorDepartment}:{challenge:Challenge;preview?:boolean;showOwners?:boolean;authorDepartment?:string}){
 const id=preview?'preview':'dossier';
 const host=useRef<HTMLDivElement>(null),[activeSection,setActiveSection]=useState('');
 useEffect(()=>{
  const root=host.current;if(!root||!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){item.target.setAttribute('data-arrived','true');observer.unobserve(item.target)}},{threshold:.08});
  root.querySelectorAll('.dossier-text-panel,.dossier-exploration,.dossier-call').forEach(el=>observer.observe(el));
  return()=>observer.disconnect();
 },[id]);
 function visit(key:string){
  const target=host.current?.querySelector<HTMLElement>('#'+id+'-'+key);if(!target)return;
  setActiveSection(key);target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});target.focus({preventScroll:true});
 }

 const sections=[['scene','المشهد الحالي'],['evidence','الأثر والشواهد'],['outcome','النتيجة المطلوبة'],['explore','في الهاكاثون']];
 return <div className="challenge-dossier" ref={host}>
 <section className="dossier-question"><div className="dossier-question-label"><MessageCircle size={19}/><span>السؤال الذي تنطلق منه</span></div><h2>{howMightWe(c)}</h2><p>صياغة أولية تُراجع مع المتأثرين في الهاكاثون.</p></section>
 {showOwners&&<section className="dossier-owners"><ProfileAvatar name={c.author}/><div><h3>{c.ownership==='shared'?'أصحاب التحدي':'صاحب التحدي'}</h3><p>{c.author}</p>{authorDepartment&&<small>{authorDepartment}</small>}{c.ownership==='shared'&&<p>{c.coOwners}</p>}</div>{c.ownership==='shared'&&<span className="trial-badge">تحدٍ مشترك</span>}</section>}
 <nav className="dossier-nav" aria-label="أقسام بطاقة التحدي">{sections.map(([key,label],i)=><button key={key} type="button" aria-current={activeSection===key?'location':undefined} aria-controls={id+'-'+key} onClick={()=>visit(key)}><span>{(i+1).toLocaleString('ar-SA')}</span>{label}<ArrowLeft size={13}/></button>)}</nav>
 <section id={id+'-scene'} className="dossier-section" data-current={activeSection==='scene'} tabIndex={-1}><div className="dossier-section-title"><span>01</span><div><h2>المشهد الحالي</h2><p>افهم ما يحدث، ومن يواجهه، وكيف يتعامل معه اليوم.</p></div></div>
  <Panel title="ماذا يحدث في الواقع؟" text={c.situation} tone="scene" Icon={Eye}/>
  <div className="dossier-columns"><Panel title="من يعيش التحدي؟" text={c.stakeholders} Icon={Users}/><Panel title="ما الذي يحاول إنجازه؟" text={c.need} empty="لم يُستكمل وصف الاحتياج بعد؛ يُستكشف مع المتأثرين." Icon={Focus}/></div>
  <Panel title="كيف يجري التعامل معه الآن؟" text={c.workaround} tone="subtle" Icon={Workflow}/>
  {c.initialSolutionStatus&&<section className="dossier-trial"><div className="dossier-trial-heading"><FlaskConical size={22}/><div><span>تجربة صاحب التحدي</span><h3>{c.initialSolutionStatus==='implemented'?'حل أولي جرى تنفيذه':'لم يُنفّذ حل أولي بعد'}</h3></div></div>{c.initialSolutionStatus==='implemented'?<><div className="dossier-columns"><Panel title="ما الذي جُرّب؟" text={c.initialSolution}/><Panel title="ماذا تحقق؟ وما الذي بقي؟" text={c.initialSolutionOutcome} empty="لم تُوثّق نتائج التجربة بعد."/></div><p className="dossier-panel-note">تجربة سابقة تساعدك على فهم ما يمكن البناء عليه.</p></>:<p>ينطلق الفريق من فهم الاحتياج لاستكشاف حلول وتجربتها.</p>}</section>}
 </section>
 <section id={id+'-evidence'} className="dossier-section" data-current={activeSection==='evidence'} tabIndex={-1}><div className="dossier-section-title"><span>02</span><div><h2 data-badra-anchor={preview?undefined:"challenge-evidence"}>الأثر والشواهد</h2><p>ما أهمية التحدي؟ وما المعلومات التي تدعم فهمه؟</p></div></div>
  <ChallengeImpactFacts challenge={c}/>
  <Panel title="لماذا يستحق المعالجة؟" text={c.impact} tone="impact" Icon={Target}/>
  <div className="dossier-columns"><Panel title="ما الذي نعرفه؟" text={c.evidence} Icon={FileText} note="شواهد يقدّمها صاحب التحدي؛ تُراجع مع أصحاب العلاقة."/><Panel title="ما الذي يحتاج تحققًا؟" text={c.assumptions} empty="لم تُذكر تفسيرات محددة بعد. تُراجع الأسباب قبل اختيار الحل." tone="hypothesis" Icon={Search} note="فرضيات وأسئلة، وليست أسبابًا مثبتة."/></div>
 </section>
 <section id={id+'-outcome'} className="dossier-section" data-current={activeSection==='outcome'} tabIndex={-1}><div className="dossier-section-title"><span>03</span><div><h2>النتيجة المطلوبة</h2><p>صورة التحسّن الذي يسعى الفريق إلى تحقيقه.</p></div></div>
  <Panel title="ما التغيير المطلوب؟ وكيف تلاحظ التحسن؟" text={c.success} tone="outcome" Icon={Target}/>
  <SmoothDisclosure className="dossier-details" initialOpen={!!(c.inScope||c.outOfScope||c.criteria)} summary={<>حدود العمل ومعايير قبول الحلول <small>تفاصيل مساندة</small></>}><p className="muted fine">حدود الموضوع ومعايير مقترحة يراجعها الفريق في الهاكاثون.</p><div className="dossier-columns"><Panel title="يشمل" text={c.inScope} empty="لم تحدد حدود العمل بعد."/><Panel title="لا يشمل" text={c.outOfScope} empty="لم تُحدد استبعادات بعد."/></div><Panel title="معايير قبول الحلول المقترحة" text={c.criteria} empty="تُحدد مع الفريق بناءً على الاحتياج والنتيجة المطلوبة."/></SmoothDisclosure>
 </section>
 <section id={id+'-explore'} className="dossier-section" data-current={activeSection==='explore'} tabIndex={-1}><div className="dossier-section-title"><span>04</span><div><h2>في الهاكاثون</h2><p>حوّل فهمك للتحدي إلى أسئلة وتجارب مع فريقك.</p></div></div>
  <div className="dossier-exploration"><h3><Lightbulb size={18}/>أسئلة تساعدك على الاستكشاف</h3><ol className="exploration-list">{explorationQuestions(c).map(q=><li key={q}>{q}</li>)}</ol></div>
  <SmoothDisclosure className="dossier-details" summary="ما الذي سيبنيه الفريق في الهاكاثون؟"><div className="workshop-deliverables">{workshopOutputs.map(x=><div key={x.title}><h3>{x.title}</h3><p>{x.description}</p></div>)}</div></SmoothDisclosure><div className="dossier-call"><Users size={22}/><p><b>صوتك يحدد أولوية الاستكشاف.</b><br/>التحديات المختارة تنتقل إلى الفريق لفهمها، وابتكار بدائل، وبناء نموذج أولي واختباره.</p></div>
 </section>
 </div>;
}
