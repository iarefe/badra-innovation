'use client';
import ChallengeImpactFacts from './challenge-impact-facts';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {howMightWe,explorationQuestions,workshopOutputs,type Challenge} from '@/lib/challenges';
import {outcomeMetrics} from '@/lib/challenge-outcome';

const chapters=[
 ['scene','المشهد الحالي','افهم ما يحدث، ومن يواجهه، وكيف يتعامل معه اليوم.'],
 ['evidence','الأثر والشواهد','ما أهمية التحدي؟ وما المعلومات التي تدعم فهمه؟'],
 ['outcome','النتيجة المطلوبة','صورة التحسّن الذي يسعى الفريق إلى تحقيقه.'],
 ['explore','في الهاكاثون','حوّل فهمك للتحدي إلى أسئلة وتجارب مع فريقك.']
] as const;
function Section({index,children}:{index:number;children:ReactNode}){
 const [key,title,description]=chapters[index];
 return <section className="cd-chapter" id={'dossier-'+key} aria-labelledby={'cd-title-'+key} tabIndex={-1}>
  <header className="cd-chapter-heading"><span aria-hidden="true">{'0'+(index+1)}</span><h2 id={'cd-title-'+key} data-badra-anchor={key==='evidence'?'challenge-evidence':undefined}>{title}</h2><p>{description}</p></header>{children}
 </section>;
}
function Fold({title,children}:{title:string;children:ReactNode}){
 return <details className="cd-fold"><summary>{title}<span className="cd-toggle-mark" aria-hidden="true"/></summary><div className="cd-fold-body">{children}</div></details>;
}
function Text({value,empty='لم تُضف تفاصيل بعد.'}:{value?:string;empty?:string}){return <p className="cd-text">{value?.trim()||empty}</p>}

export default function ChallengeReader({challenge:c,call}:{challenge:Challenge;call:ReactNode}){
 const reader=useRef<HTMLDivElement>(null),nav=useRef<HTMLElement>(null),[active,setActive]=useState(0);
 const metrics=outcomeMetrics(c.success);
 useEffect(()=>{
  const host=reader.current,bar=nav.current,head=document.querySelector<HTMLElement>('.cd-header'),page=host?.closest<HTMLElement>('.cd-page');
  if(!host||!bar||!page)return;
  const sections=Array.from(host.querySelectorAll<HTMLElement>('.cd-chapter'));let frame=0;
  const inspect=()=>{frame=0;const boundary=(head?.getBoundingClientRect().height||0)+bar.offsetHeight+20;
   let i=0;for(let j=1;j<sections.length;j++)if(sections[j].getBoundingClientRect().top<=boundary)i=j;
   if(window.scrollY>0&&document.documentElement.scrollHeight-window.innerHeight-window.scrollY<3)i=sections.length-1;
   setActive(i);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(inspect)};
  const resize=()=>{page.style.setProperty('--cd-head',(head?.offsetHeight||64)+'px');page.style.setProperty('--cd-tabs',bar.offsetHeight+'px');schedule()};
  const observer=new ResizeObserver(resize);if(head)observer.observe(head);observer.observe(bar);observer.observe(host);resize();
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',resize);
  return()=>{observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);cancelAnimationFrame(frame)};
 },[]);
 useEffect(()=>{const bar=nav.current,button=bar?.querySelector<HTMLElement>('[aria-current="location"]');if(!bar||!button)return;
  const b=button.getBoundingClientRect(),n=bar.getBoundingClientRect();if(b.left<n.left||b.right>n.right)bar.scrollBy({left:b.left<n.left?b.left-n.left:b.right-n.right,behavior:'auto'});
 },[active]);
 function jump(index:number){const el=reader.current?.querySelector<HTMLElement>('#dossier-'+chapters[index][0]);if(!el)return;el.focus({preventScroll:true});el.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}

 return <div className="cd-reader" ref={reader}>
  <div className="cd-question"><span>السؤال الذي تنطلق منه</span><h2>{howMightWe(c)}</h2><p>صياغة أولية تُراجع مع المتأثرين في الهاكاثون.</p></div>
  <nav className="cd-section-nav" aria-label="أقسام بطاقة التحدي" ref={nav}>{chapters.map(([key,label],i)=><button type="button" key={key} aria-current={active===i?'location':undefined} aria-controls={'dossier-'+key} onClick={()=>jump(i)}><span aria-hidden="true">{'0'+(i+1)}</span>{label}</button>)}</nav>
  <Section index={0}>
   <div className="cd-scene"><h3>ماذا يحدث في الواقع؟</h3><Text value={c.situation}/></div>
   <dl className="cd-definitions">{[['من يعيش التحدي؟',c.stakeholders],['ما الذي يحاول إنجازه؟',c.need||'لم يُستكمل وصف الاحتياج بعد؛ يُستكشف مع المتأثرين.'],['كيف يجري التعامل معه الآن؟',c.workaround]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   {c.initialSolutionStatus&&<div className="cd-box cd-trial"><div className="cd-box-title"><h3>{c.initialSolutionStatus==='implemented'?'حل أولي جرى تنفيذه':'لم يُنفّذ حل أولي بعد'}</h3><span>تجربة صاحب التحدي</span></div>{c.initialSolutionStatus==='implemented'?<><div className="cd-before-after"><div><h4>ما الذي جُرّب؟</h4><Text value={c.initialSolution}/></div><span className="cd-trial-arrow" aria-hidden="true"/><div><h4>ماذا تحقق؟</h4><Text value={c.initialSolutionOutcome} empty="لم تُوثّق نتائج التجربة بعد."/></div></div><p className="cd-note">تجربة سابقة تساعدك على فهم ما يمكن البناء عليه.</p></>:<p>ينطلق الفريق من فهم الاحتياج لاستكشاف حلول وتجربتها.</p>}</div>}
  </Section>
  <Section index={1}>
   <ChallengeImpactFacts challenge={c}/>
   <blockquote className="cd-impact"><h3>لماذا يستحق المعالجة؟</h3><Text value={c.impact}/></blockquote>
   <div className="cd-evidence-grid"><div className="cd-box cd-evidence"><h3>ما الذي نعرفه؟</h3><Text value={c.evidence}/><p className="cd-note">شواهد يقدّمها صاحب التحدي؛ تُراجع مع أصحاب العلاقة.</p></div>
    <div className="cd-box cd-evidence unverified"><h3>ما الذي يحتاج تحققًا؟</h3><Text value={c.assumptions} empty="لم تُذكر تفسيرات محددة بعد. تُراجع الأسباب قبل اختيار الحل."/><p className="cd-note">فرضيات وأسئلة، وليست أسبابًا مثبتة.</p></div></div>
  </Section>
  <Section index={2}>
   {metrics?<>{metrics.intro&&<p>{metrics.intro}</p>}<div className="cd-metrics">{metrics.items.map((m,i)=><div key={i}><span>{m.label}</span><strong>{m.direction&&<b dir="ltr" aria-hidden="true">{m.direction}</b>}{m.value}</strong></div>)}</div></>:<div className="cd-outcome"><h3>ما التغيير المطلوب؟ وكيف تلاحظ التحسّن؟</h3><Text value={c.success}/></div>}
   <Fold title="حدود العمل ومعايير قبول الحلول"><p className="cd-note">حدود الموضوع ومعايير مقترحة يراجعها الفريق في الهاكاثون.</p>{[['يشمل',c.inScope,'لم تُحدد حدود العمل بعد.'],['لا يشمل',c.outOfScope,'لم تُحدد استبعادات بعد.'],['معايير قبول الحلول المقترحة',c.criteria,'تُحدد مع الفريق بناءً على الاحتياج والنتيجة المطلوبة.']].map(([label,val,empty])=><div key={label}><h4>{label}</h4><Text value={val} empty={empty}/></div>)}</Fold>
  </Section>
  <Section index={3}>
   <div className="cd-box cd-questions"><h3>أسئلة تساعدك على الاستكشاف</h3><ol>{explorationQuestions(c).map((q,i)=><li key={q}><span aria-hidden="true">{i+1}</span><p>{q}</p></li>)}</ol></div>
   <Fold title="ما الذي سيبنيه الفريق؟">{workshopOutputs.map(x=><div key={x.title}><h4>{x.title}</h4><p>{x.description}</p></div>)}</Fold>
   {call}
  </Section>
 </div>;
}
