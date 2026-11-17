'use client';
import {useLayoutEffect,useRef,type CSSProperties} from 'react';
import EventDate from './event-date';
import {Check,ArrowDown} from 'lucide-react';
import {journeyStages,type EventCalendar} from '@/lib/hackathon-event';
type BlockAttrs={'data-home-block':string;'data-entered':boolean};
export default function HomeJourney({calendar,attrs,onDay}:{calendar:EventCalendar;attrs:BlockAttrs;onDay:(index:number)=>void}){
 const map=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const el=map.current;if(!el)return;const nodes=Array.from(el.querySelectorAll<HTMLElement>('.bh-station-node'));
  function measure(){if(!el||nodes.length!==4)return;
   const rect=el.getBoundingClientRect(),centers=nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}});
   const first=centers[0],last=centers[3],horizontal=Math.abs(first.x-last.x)>Math.abs(last.y-first.y);
   const distance=(p:{x:number;y:number})=>horizontal?first.x-p.x:p.y-first.y;
   const total=Math.max(1,distance(last)),s=calendar.progress*3,from=Math.min(2,Math.floor(s)),fraction=s-from;
   const point=distance(centers[from])+(distance(centers[from+1])-distance(centers[from]))*fraction;
   el.style.setProperty('--path-right',(rect.right-first.x)+'px');el.style.setProperty('--path-top',(first.y-rect.top)+'px');el.style.setProperty('--path-length',total+'px');el.style.setProperty('--path-progress',Math.max(0,Math.min(100,100*point/total))+'%');
  }
  measure();const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);ro?.observe(el);for(const node of nodes)if(node.parentElement)ro?.observe(node.parentElement);window.addEventListener('resize',measure);return()=>{ro?.disconnect();window.removeEventListener('resize',measure)};
 },[calendar.progress]);
 return <section className="bh-journey bh-reveal" {...attrs} id="home-journey" aria-labelledby="journey-heading">
  <div className="bh-section-head"><div><span className="bh-eyebrow">أربع محطات · نوفمبر 2026</span><h2 id="journey-heading" data-badra-anchor="journey">رحلتك في الهاكاثون</h2><p>من ملاحظة في عملك إلى نموذج حل تعرضه مع فريقك.</p></div><div className="bh-now"><span>أنت الآن في:</span><b>{calendar.currentLabel}</b></div></div>
  <div className="bh-map" ref={map} style={{'--path-progress':(calendar.progress*100)+'%'} as CSSProperties}>
   <div className="bh-track" aria-hidden="true"><div className="bh-track-fill"/>{calendar.showMarker&&<div className="bh-today"><span>اليوم · {calendar.todayLabel}</span></div>}</div>
   <ol className="bh-stations">{journeyStages.map((s,i)=>{const state=calendar.stages[i];return <li key={s.start} data-state={state} aria-current={state==='current'?'step':undefined} style={{'--delay':i*.12+'s','--node-delay':i*.18+'s'} as CSSProperties}>
    <div className="bh-station-node" aria-hidden="true">{state==='done'?<Check size={24}/>:String(i+1).padStart(2,'0')}</div>
    <div className="bh-station-card"><div className="bh-station-meta"><time dateTime={s.start}><EventDate label={s.date}/></time><span>{state==='done'?'اكتملت':state==='current'?'المرحلة الحالية':'قادمة'}</span></div><h3>{s.title}</h3><p>{s.description}</p>{i>1&&<button type="button" className="bh-agenda-link" aria-label={'برنامج اليوم '+(i===2?'الأول':'الثاني')} onClick={()=>onDay(i-2)}>برنامج اليوم <ArrowDown size={15} aria-hidden="true"/></button>}</div>
   </li>})}</ol>
  </div>
 </section>;
}
