'use client';
import {useEffect,useRef} from 'react';
// Record an actual visible visit, including a return on a remembered device. No background heartbeat.
export function usePortalVisit(identity:string|null|undefined,route:string){
 const previous=useRef({id:'',time:0});
 useEffect(()=>{
  if(!identity){previous.current={id:'',time:0};return}
  const id=identity;
  function visit(){
   if(document.visibilityState!=='visible')return;
   const now=Date.now();if(previous.current.id===id&&now-previous.current.time<60000)return;
   previous.current={id,time:now};
   void fetch('/api/portal-visit',{method:'POST',headers:{'x-badra-visit':'visible'},credentials:'same-origin',cache:'no-store',keepalive:true})
    .then(r=>{if(!r.ok&&previous.current.id===id&&previous.current.time===now)previous.current.time=0})
    .catch(()=>{if(previous.current.id===id&&previous.current.time===now)previous.current.time=0});
  }
  visit();document.addEventListener('visibilitychange',visit);window.addEventListener('pageshow',visit);
  return()=>{document.removeEventListener('visibilitychange',visit);window.removeEventListener('pageshow',visit)};
 },[identity,route]);
}
