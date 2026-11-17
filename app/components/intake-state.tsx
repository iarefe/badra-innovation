'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {advanceWindow,intakeWindow,type IntakeSnapshot} from '@/lib/hackathon-intake';
export const IntakeContext=createContext<IntakeSnapshot|null>(null);
export const useIntake=()=>useContext(IntakeContext);
export const requestIntakeUpdate=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('badra:intake-changed'))};
// Seed SSR and hydration from the same server clock. Subsequent reads contain only public window flags.
// Already-open tabs switch at the boundary without waiting for a poll or for another page navigation.
export function useLiveIntake(seed?:IntakeSnapshot,initialDay?:string,poll=true){
 const [state,setState]=useState(()=>seed??intakeWindow({},initialDay?Date.parse(initialDay+'T12:00:00+03:00'):Date.now()));
 const base=useRef({data:state,wall:Date.now(),perf:typeof performance==='undefined'?0:performance.now(),verified:!!seed});
 const activate=useRef<((s:IntakeSnapshot)=>void)|null>(null),seedRef=useRef(seed);seedRef.current=seed;
 useEffect(()=>{
  let ended=false,timer:ReturnType<typeof setTimeout>,ticker:ReturnType<typeof setInterval>,req:AbortController|null=null;
  function adopt(s:IntakeSnapshot){if(ended||base.current.verified&&s.serverNow<base.current.data.serverNow)return;
   base.current={data:s,wall:Date.now(),perf:performance.now(),verified:true};tick();}
  function tick(){if(ended)return;clearTimeout(timer);const b=base.current;
   const now=b.data.serverNow+Math.max(0,Date.now()-b.wall,performance.now()-b.perf);
   setState(advanceWindow(b.data,now));const boundary=[b.data.opensAt,b.data.closesAt,b.data.engagementEndsAt].find(n=>n>now);
   if(boundary)timer=setTimeout(tick,Math.min(2_000_000_000,Math.max(10,boundary-now+8)));}
  async function refresh(){if(ended||req||document.hidden||!poll)return;
   const controller=new AbortController();req=controller;const limit=setTimeout(()=>controller.abort(),10000);
   try{const r=await fetch('/api/intake',{cache:'no-store',credentials:'omit',signal:controller.signal});
    if(r.ok){const s=await r.json() as IntakeSnapshot;if(typeof s.serverNow==='number'&&typeof s.manualPause==='boolean'&&typeof s.votingOpen==='boolean')adopt(s)}
   }catch{/* The server still validates every submission. */}finally{clearTimeout(limit);req=null;}}
  function resume(){if(!document.hidden){tick();void refresh()}}
  activate.current=adopt;if(seedRef.current)adopt(seedRef.current);else{base.current={data:intakeWindow(),wall:Date.now(),perf:performance.now(),verified:false};tick();void refresh()}
  if(poll)ticker=setInterval(refresh,45000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);window.addEventListener('badra:intake-changed',resume);
  return()=>{ended=true;activate.current=null;req?.abort();clearTimeout(timer);clearInterval(ticker);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('badra:intake-changed',resume)};
 },[poll]);
 useEffect(()=>{if(seed)activate.current?.(seed)},[seed]);
 return state;
}
