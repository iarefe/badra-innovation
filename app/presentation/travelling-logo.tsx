'use client';
import {useLayoutEffect,useRef} from 'react';

export function useTravellingLogo(opening:boolean){
 const dock=useRef<HTMLDivElement>(null),traveller=useRef<HTMLDivElement>(null),destination=useRef<HTMLDivElement>(null),shell=useRef<HTMLDivElement>(null);
 const phase=useRef<boolean|null>(null),lastTarget=useRef(''),flight=useRef<Animation|null>(null);
 useLayoutEffect(()=>{
  const origin=dock.current,mark=traveller.current,root=shell.current;if(!origin||!mark||!root)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function position(){
   const dest=opening?destination.current:origin;
   if(!dest||!origin||!mark||!root)return;
   const a=origin.getBoundingClientRect(),b=dest.getBoundingClientRect();if(!a.width||!b.width)return;
   const next=opening?`translate(${b.left-a.left}px,${b.top-a.top}px) scale(${b.width/a.width})`:'none';
   const changed=phase.current!==null&&phase.current!==opening;
   if(root.dataset.logoReady==='true'&&!changed&&lastTarget.current===next)return;
   const previous=getComputedStyle(mark),from=previous.transform,opacity=Number(previous.opacity)||1;
   flight.current?.cancel();lastTarget.current=next;mark.style.transform=next;
   root.dataset.logoReady='true';
   if(changed&&!reduced.matches&&typeof mark.animate==='function'){
    // The same <video> travels between the measured rectangles, including on rapid reversals.
    flight.current=mark.animate([{transform:from,opacity},{offset:.55,opacity:opening ? .62 : .42},{transform:next,opacity:1}],{duration:820,easing:'cubic-bezier(.32,0,.15,1)'});
   }
   phase.current=opening;
  }
  position();
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(position):null;
  observer?.observe(origin);if(destination.current)observer?.observe(destination.current);observer?.observe(root);
  const preference=()=>{if(reduced.matches)flight.current?.cancel();position()};
  window.addEventListener('resize',position);document.addEventListener('fullscreenchange',position);reduced.addEventListener('change',preference);
  return ()=>{observer?.disconnect();window.removeEventListener('resize',position);document.removeEventListener('fullscreenchange',position);reduced.removeEventListener('change',preference)};
 },[opening,destination,shell]);
 useLayoutEffect(()=>()=>{flight.current?.cancel();},[]);
 return {dock,traveller,destination,shell};
}
