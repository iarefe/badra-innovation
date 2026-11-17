'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {JudgingRow} from '@/lib/team-card';

export const judgingRefreshMs=5000;

// Poll only a results view a manager has open. Keep keyed rows and any edits mounted.
export function useJudgingResults({enabled=true,teamId,onAccessLost}:{enabled?:boolean;teamId?:string;onAccessLost:()=>void}){
 const [rows,setRows]=useState<JudgingRow[]|null>(null),[busy,setBusy]=useState(false),[fault,setFault]=useState('');
 const request=useRef<AbortController|null>(null),lost=useRef(onAccessLost);lost.current=onAccessLost;
 const read=useCallback(async(background:boolean)=>{
  if(!enabled||background&&(document.hidden||request.current))return;
  request.current?.abort();const ctrl=new AbortController();request.current=ctrl;
  if(!background)setBusy(true);
  try{
   const res=await fetch('/api/teams?view=results'+(teamId?'&team='+encodeURIComponent(teamId):''),{cache:'no-store',signal:ctrl.signal});
   if(ctrl.signal.aborted)return;
   if(!res.ok){if(res.status===401||res.status===403){setRows(null);lost.current()}throw Error('تعذّر تحميل نتائج التحكيم.');}
   const data=await res.json() as {teams:JudgingRow[]};if(ctrl.signal.aborted)return;
   setRows(data.teams);setFault('');
  }catch(e){if(!ctrl.signal.aborted)setFault(e instanceof Error?e.message:'تعذّر تحميل النتائج.');}
  finally{if(request.current===ctrl){request.current=null;if(!background)setBusy(false)}}
 },[enabled,teamId]);
 const refresh=useCallback(()=>read(false),[read]);
 useEffect(()=>{
  if(!enabled)return;
  void refresh();
  const update=()=>{void read(true)};
  const timer=window.setInterval(update,judgingRefreshMs);
  window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
  return()=>{request.current?.abort();request.current=null;window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)};
 },[enabled,read,refresh]);
 return {rows,busy,fault,refresh};
}
