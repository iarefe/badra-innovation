'use client';
import {useEffect,useRef,useState} from 'react';
import {makeSlideClock} from '@/lib/presentation-clock';
export default function SlideTimer({durationMs,running,onEnd,final}:{durationMs:number;running:boolean;onEnd:()=>void;final:boolean}){
 const [seconds,setSeconds]=useState(durationMs/1000);
 const clock=useRef<ReturnType<typeof makeSlideClock>|null>(null);
 useEffect(()=>{const c=makeSlideClock(durationMs,setSeconds,onEnd);clock.current=c;return ()=>{c.pause();clock.current=null};},[durationMs,onEnd]);
 useEffect(()=>{
  // Stop synchronously on visibility changes, before the browser throttles timers.
  const sync=()=>{const c=clock.current;if(running&&!document.hidden)c?.resume();else c?.pause();};
  sync();document.addEventListener('visibilitychange',sync);return ()=>{document.removeEventListener('visibilitychange',sync);clock.current?.pause();};
 },[running,durationMs,onEnd]);
 return <div className="deck-timer" role="timer" aria-live="off" aria-label="الوقت المتبقي لهذه الشريحة" data-soon={seconds<=5}>
  <svg aria-hidden="true" viewBox="0 0 24 24"><circle className="deck-timer-track" cx="12" cy="12" r="9"/><circle className="deck-timer-arc" cx="12" cy="12" r="9" pathLength="100" strokeDasharray={`${seconds*100/(durationMs/1000)} 100`}/></svg>
  <b dir="ltr">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</b>
  <span>{!running?'العدّ متوقف':final?'حتى الافتتاحية':'حتى التحدي التالي'}</span>
 </div>;
}
