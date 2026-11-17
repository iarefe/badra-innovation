'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {ArrowUpLeft,X} from 'lucide-react';
import type {GuideContext} from '@/lib/companion-guidance';
import {challengeReminder,readReminded,rememberChallenges,reminderEntries,reminderStorageKey,reminderDelay,reminderDuration,type ChallengeReminder} from '@/lib/companion-reminder';

const storage=()=>{try{return window.localStorage}catch{return null}};
const editing=()=>document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
const blocked=()=>document.hidden||editing()||!!document.querySelector('dialog[open],[role="dialog"][aria-modal="true"],.badra-assistant[data-badra-busy="true"]');

/** The sole automatic guide message. It never scrolls, focuses, or starts a tour. */
export function useImprovementReminder(context:GuideContext,touring:boolean){
 const [reminder,setReminder]=useState<ChallengeReminder|null>(null);
 const actor=context.viewer.employeeId||'',eligible=reminderEntries(context),key=eligible.map(e=>e.id+':'+JSON.stringify(e.challenge)).join('|');
 const current=useRef({actor,eligible,touring});current.current={actor,eligible,touring};
 const suppressed=useRef(false);
 function dismiss(){setReminder(null);suppressed.current=true}
 function startTour(){
  // An explicitly started tour wins over a scheduled reminder, including on later routes.
  const state=current.current;rememberChallenges(state.actor,state.eligible.map(e=>e.id),storage());dismiss();
 }
 useEffect(()=>{
  if(touring){setReminder(null);return}
  if(!actor||!eligible.length){setReminder(null);return}
  if(suppressed.current||reminder)return;
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined;
  const pending=()=>current.current.eligible.filter(e=>!readReminded(actor,storage()).has(e.id));
  if(!pending().length)return;
  const show=()=>{
   if(disposed||suppressed.current||current.current.touring||blocked())return;
   const next=challengeReminder(pending());if(!next)return;
   rememberChallenges(actor,next.ids,storage());suppressed.current=true;setReminder(next);
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(show,reminderDelay)};
  const crossTab=(e:StorageEvent)=>{if(e.key===reminderStorageKey(actor)&&!pending().length)clearTimeout(timer)};
  // Defer while the visitor scrolls, types, or uses a modal; retry only when it is quiet.
  const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','aria-modal']});
  window.addEventListener('scroll',schedule,{passive:true});document.addEventListener('focusout',schedule);document.addEventListener('visibilitychange',schedule);window.addEventListener('storage',crossTab);schedule();
  return()=>{disposed=true;clearTimeout(timer);observer.disconnect();window.removeEventListener('scroll',schedule);document.removeEventListener('focusout',schedule);document.removeEventListener('visibilitychange',schedule);window.removeEventListener('storage',crossTab)};
 },[actor,key,touring,reminder]);
 useEffect(()=>{if(reminder&&!reminder.ids.some(id=>eligible.some(e=>e.id===id)))dismiss()},[key]);
 return {reminder,dismiss,startTour};
}

export default function CompanionReminder({value,onClose,control}:{value:ChallengeReminder;onClose:()=>void;control:RefObject<HTMLButtonElement|null>}){
 const root=useRef<HTMLElement>(null),close=useRef(onClose),hovered=useRef(false),remaining=useRef(reminderDuration),last=useRef(0);
 close.current=onClose;
 useEffect(()=>{
  last.current=performance.now();
  const tick=()=>{
   const now=performance.now(),paused=hovered.current||root.current?.contains(document.activeElement);
   if(blocked()){close.current();return}
   if(!paused)remaining.current-=now-last.current;last.current=now;
   if(remaining.current<=0)close.current();
  };
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){const restore=!!root.current?.contains(document.activeElement);close.current();if(restore)requestAnimationFrame(()=>control.current?.focus({preventScroll:true}))}};
  const hide=()=>{if(document.hidden)close.current()};
  const interval=setInterval(tick,250);document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);
  return()=>{clearInterval(interval);document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide)};
 },[]);
 function dismiss(){const restore=!!root.current?.contains(document.activeElement);onClose();if(restore)requestAnimationFrame(()=>control.current?.focus({preventScroll:true}))}
 return <aside ref={root} className="badra-reminder" aria-label="تذكير بذرة بتحسين التحدي" onMouseEnter={()=>{hovered.current=true}} onMouseLeave={()=>{hovered.current=false}}>
  <img className="badra-reminder-character" src="/placeholder.svg" width={64} height={76} alt=""/>
  <div className="badra-guide-bubble"><div className="badra-guide-caption"><span><i/>بذرة · تذكير لك</span><button type="button" onClick={dismiss} aria-label="إغلاق تذكير بذرة"><X size={17}/></button></div>
   <div role="status" aria-live="polite"><h2>{value.title}</h2><p>{value.text}</p></div>
   <div className="badra-reminder-actions"><a href={value.href} onClick={onClose}>{value.action}<ArrowUpLeft size={15}/></a><button type="button" onClick={dismiss}>ليس الآن</button></div>
  </div>
 </aside>;
}
