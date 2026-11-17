'use client';
import {useEffect,useRef} from 'react';

const clamp=(value:number)=>Math.max(0,Math.min(1,value));

/** Decorative progress follows the viewport, never elapsed time or React renders. */
export function useJourneyScroll(){
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{
  const section=root.current;if(!section)return;
  const stops=Array.from(section.querySelectorAll<HTMLElement>('.journey-stop'));
  const nodes=stops.map(stop=>stop.querySelector<HTMLElement>('.journey-node')!);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile=window.matchMedia('(max-width: 760px)');
  let frame=0;
  function update(){
   frame=0;
   if(!section||!nodes.length)return;
   // Finish geometry reads before style writes. No scrolling or focus is forced.
   const viewport=window.innerHeight,rect=section.getBoundingClientRect();
   const centers=mobile.matches?nodes.map(node=>{const r=node.getBoundingClientRect();return r.top+r.height/2}):[];
   const progress=reduced.matches?1:mobile.matches
    ?clamp((viewport*.68-centers[0])/Math.max(1,centers[centers.length-1]-centers[0]))
    :clamp((viewport*.8-rect.top)/Math.max(1,rect.height+viewport*.08));
   section.style.setProperty('--journey-progress',progress.toFixed(4));
   section.dataset.scrollProgress=progress.toFixed(3);
   stops.forEach((stop,index)=>{
    const segment=reduced.matches?1:mobile.matches
     ?clamp((viewport*.68-centers[index])/Math.max(1,(centers[index+1]??centers[index]+1)-centers[index]))
     :clamp(progress*(stops.length-1)-index);
    const arrival=reduced.matches?1:mobile.matches
     ?clamp((viewport*.78-centers[index])/Math.max(1,viewport*.1))
     :clamp((progress*(stops.length-1)-index+.22)/.22);
    stop.style.setProperty('--segment-progress',segment.toFixed(4));
    stop.style.setProperty('--node-arrival',arrival.toFixed(4));
    stop.dataset.reached=String(arrival>=.99);
   });
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update)}
  update();
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  reduced.addEventListener('change',schedule);
  mobile.addEventListener('change',schedule);
  const resize=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);
  resize?.observe(section);
  return()=>{cancelAnimationFrame(frame);resize?.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduced.removeEventListener('change',schedule);mobile.removeEventListener('change',schedule)};
 },[]);
 return root;
}

/** Content starts visible; only newly encountered surfaces receive a short accent. */
export function useScrollReveal<T extends HTMLElement>(revision:unknown){
 const root=useRef<T>(null);
 useEffect(()=>{
  const host=root.current;
  if(!host||typeof IntersectionObserver==='undefined')return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(preference.matches)return;
  const observer=new IntersectionObserver(entries=>{
   entries.filter(entry=>entry.isIntersecting).forEach((entry,index)=>{
    const element=entry.target as HTMLElement;
    element.style.setProperty('--arrival-delay',Math.min(index,3)*35+'ms');
    element.dataset.revealed='true';observer.unobserve(element);
   });
  },{threshold:.08,rootMargin:'0px 0px -24px 0px'});
  host.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed])').forEach(element=>observer.observe(element));
  return()=>observer.disconnect();
 },[revision]);
 return root;
}
