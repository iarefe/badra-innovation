'use client';
import {useEffect,useRef,useState} from 'react';
export const homeBlocks=['roles','journey','program','evaluation','challenges','faq','invite'] as const;
export type HomeBlock=typeof homeBlocks[number];
type View={mode:'static'|'on'|'final';seen:ReadonlySet<HomeBlock>};
export function useHomeMotion(announced=false){
 const root=useRef<HTMLDivElement>(null);
 // SSR, disabled JS, and print always have complete visible content.
 const [view,setView]=useState<View>({mode:'static',seen:new Set()});
 useEffect(()=>{
  const host=root.current;if(!host)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const nodes=Array.from(host.querySelectorAll<HTMLElement>('[data-home-block]')),seen=new Set<HomeBlock>();
  let frame=0,poll:ReturnType<typeof setInterval>|undefined,backup:ReturnType<typeof setTimeout>|undefined,done=false;
  const stop=()=>{cancelAnimationFrame(frame);clearInterval(poll);clearTimeout(backup);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);host.removeEventListener('focusin',focus)};
  function finish(){if(done)return;done=true;stop();setView({mode:'final',seen:new Set(homeBlocks)})}
  function inspect(){
   frame=0;if(done)return;if(document.hidden||reduce.matches){finish();return}
   let changed=false;
   for(const el of nodes){const key=el.dataset.homeBlock as HomeBlock;if(seen.has(key))continue;if(el.getBoundingClientRect().top<=window.innerHeight*.85){seen.add(key);changed=true}}
   if(changed)setView({mode:'on',seen:new Set(seen)});
   if(seen.size>=nodes.length)stop();
  }
  function schedule(){if(!done&&!frame)frame=requestAnimationFrame(inspect)}
  function focus(e:FocusEvent){if(!(e.target instanceof Element))return;let el=e.target.closest<HTMLElement>('[data-home-block]');while(el){seen.add(el.dataset.homeBlock as HomeBlock);el=el.parentElement?.closest<HTMLElement>('[data-home-block]')??null}setView({mode:'on',seen:new Set(seen)});}
  const visibility=()=>{if(document.hidden||reduce.matches)finish();else schedule()};
  if(document.hidden||reduce.matches)finish();else{
   setView({mode:'on',seen:new Set()});window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);host.addEventListener('focusin',focus);
   poll=setInterval(inspect,400);backup=setTimeout(()=>{if(!seen.size)finish();else inspect()},3000);inspect();
  }
  document.addEventListener('visibilitychange',visibility);reduce.addEventListener('change',visibility);window.addEventListener('beforeprint',finish);
  return()=>{done=true;stop();document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',visibility);window.removeEventListener('beforeprint',finish)};
 },[announced]);
 return {root,mode:view.mode,block:(key:HomeBlock)=>({'data-home-block':key,'data-entered':view.seen.has(key)}),seen:view.seen};
}

// Numeric text is final in the HTML and for assistive technology. Only its
// decorative copy changes while visible; hidden tabs never depend on animation frames.
export function startHomeCounters(host:HTMLElement,skip=false){
 const doc=host.ownerDocument,win=doc.defaultView;
 const nodes=Array.from(host.querySelectorAll<HTMLElement>('[data-home-count]'));
 const fmt=new Intl.NumberFormat('en-US');
 const paint=(p:number)=>{for(const el of nodes)el.textContent=fmt.format(Math.round(Number(el.dataset.homeCount)*p))};
 if(!win||!nodes.length)return;
 const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
 if(skip||doc.hidden||reduced.matches){paint(1);return}
 let frame=0,timer=0,finished=false;
 const onChange=()=>{if(doc.hidden||reduced.matches)finish()};
 function finish(){
  if(finished)return;
  finished=true;win!.cancelAnimationFrame(frame);win!.clearTimeout(timer);paint(1);
  doc.removeEventListener('visibilitychange',onChange);reduced.removeEventListener('change',onChange);
 }
 const start=win.performance.now();
 const tick=(t:number)=>{
  if(finished)return;
  const p=Math.max(0,Math.min(1,(t-start)/1600));
  if(doc.hidden||p>=1){finish();return}
  paint(1-(1-p)**3);frame=win.requestAnimationFrame(tick);
 };
 paint(0);doc.addEventListener('visibilitychange',onChange);reduced.addEventListener('change',onChange);
 timer=win.setTimeout(finish,1750);frame=win.requestAnimationFrame(tick);
 return finish;
}
export function useHomeCounters(active:boolean,skip:boolean){
 const host=useRef<HTMLElement>(null);
 useEffect(()=>{if(active&&host.current)return startHomeCounters(host.current,skip)},[active,skip]);
 return host;
}
