'use client';
import {useLayoutEffect,useRef} from 'react';
import {advanceCompanionMotion,companionAtRest,type CompanionMotion,type MotionPoint} from '@/lib/companion-motion';
import type {GuidePosition} from '@/lib/companion-position';

/** Only the compositor transform changes per frame; hints and layout do not rerender. */
export function useCompanionMotion(destination:GuidePosition|null,onRest:()=>void){
 const element=useRef<HTMLDivElement>(null),settled=useRef(true),notify=useRef(onRest);
 const state=useRef<CompanionMotion|null>(null),target=useRef<MotionPoint|null>(null),wake=useRef<()=>void>(()=>{});
 notify.current=onRest;
 useLayoutEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0,last=0;
  const paint=()=>{const s=state.current,node=element.current;if(!s||!node)return;node.style.transform=`translate3d(${s.x.toFixed(3)}px,${s.y.toFixed(3)}px,0)`;node.style.setProperty('--badra-lean',`${Math.max(-3,Math.min(3,s.vx/650)).toFixed(2)}deg`)};
  const tick=(now:number)=>{
   frame=0;if(!state.current||!target.current)return;
   state.current=preference.matches?{...target.current,vx:0,vy:0}:advanceCompanionMotion(state.current,target.current,last?(now-last)/1000:1/60);last=now;
   settled.current=companionAtRest(state.current,target.current);
   if(settled.current)state.current={...target.current,vx:0,vy:0};
   paint();if(settled.current){last=0;notify.current()}else frame=requestAnimationFrame(tick);
  };
  wake.current=()=>{if(!target.current)return;if(!state.current){state.current={...target.current,vx:0,vy:0};paint()}
   settled.current=companionAtRest(state.current,target.current);if(!frame){last=0;frame=requestAnimationFrame(tick)}};
  const changed=()=>wake.current();preference.addEventListener('change',changed);wake.current();
  return()=>{cancelAnimationFrame(frame);preference.removeEventListener('change',changed);wake.current=()=>{}};
 },[]);
 useLayoutEffect(()=>{
  if(!destination)return;target.current={x:destination.mascotLeft,y:destination.mascotTop};wake.current();
 },[destination?.mascotLeft,destination?.mascotTop]);
 return {element,settled};
}
