'use client';
import {useEffect,useRef,type MouseEvent,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

/** Native details remain usable without JS; animation never delays the chosen state. */
export default function SmoothDisclosure({summary,children,className='',initialOpen=false}:{summary:ReactNode;children:ReactNode;className?:string;initialOpen?:boolean}){
 const element=useRef<HTMLDetailsElement>(null),motion=useRef<Animation|null>(null),initial=useRef(initialOpen),desired=useRef(initialOpen);
 function settle(){
  const el=element.current;if(!el)return;
  motion.current?.cancel();motion.current=null;
  el.open=desired.current;el.dataset.expanded=String(desired.current);
  delete el.dataset.animating;
  el.style.removeProperty('height');el.style.removeProperty('overflow');
 }
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{if(preference.matches)settle()};preference.addEventListener('change',stop);
  return()=>{preference.removeEventListener('change',stop);motion.current?.cancel();motion.current=null;};
 },[]);
 function toggle(event:MouseEvent<HTMLElement>){
  const el=element.current;if(!el)return;
  event.preventDefault();
  const start=el.getBoundingClientRect().height;
  desired.current=motion.current?!desired.current:!el.open;
  motion.current?.cancel();motion.current=null;
  el.style.removeProperty('height');el.style.removeProperty('overflow');
  el.dataset.expanded=String(desired.current);
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||typeof el.animate!=='function'){settle();return;}
  // Measure both states in the same frame, keeping content visible while closing.
  el.open=desired.current;
  const end=el.getBoundingClientRect().height;
  el.open=true;el.style.overflow='hidden';el.dataset.animating='true';
  try{
   const animation=el.animate([{height:start+'px'},{height:end+'px'}],{duration:230,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
   motion.current=animation;
   animation.onfinish=()=>{if(motion.current===animation)settle()};
  }catch{settle()}
 }
 return <details ref={element} className={'smooth-disclosure '+className} open={initial.current} data-expanded={initial.current} onToggle={()=>{if(!motion.current&&element.current){desired.current=element.current.open;element.current.dataset.expanded=String(desired.current)}}}>
  <summary onClick={toggle}><span className="disclosure-label">{summary}</span><ChevronDown className="disclosure-chevron" size={17} aria-hidden="true"/></summary>
  <div className="disclosure-body">{children}</div>
 </details>;
}
