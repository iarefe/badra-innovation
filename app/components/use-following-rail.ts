'use client';
import {useLayoutEffect,useRef} from 'react';

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(value,high));

// CSS sticky handles the track and its end. For an oversized rail we move the
// sticky inset between its two readable edges, using only *document* scrolling.
export function useFollowingRail(){
 const ref=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  const rail=ref.current,track=rail?.parentElement;if(!rail||!track)return;
  const header=document.querySelector<HTMLElement>('.cd-header');
  const desktop=window.matchMedia('(min-width: 900px)'),viewport=window.visualViewport;
  let docTop:number|null=null,frame=0,dirty=true,high=0,low=0,height=0,bottom=0;
  let focusTarget:HTMLElement|null=null,lastInset='';
  const write=(top:number)=>{const next=(Math.round(top*100)/100)+'px';if(next!==lastInset){rail.style.setProperty('--cd-rail-inset',next);lastInset=next}};
  const update=()=>{
   frame=0;
   if(!desktop.matches){rail.style.removeProperty('--cd-rail-inset');lastInset='';docTop=null;focusTarget=null;low=high=0;dirty=true;return}
   if(dirty){
    const visibleTop=viewport?.offsetTop??0;
    high=Math.max(visibleTop,header?.getBoundingClientRect().height??64)+20;
    bottom=visibleTop+Math.min(window.innerHeight,viewport?.height??window.innerHeight)-14;
    height=rail.getBoundingClientRect().height;low=Math.min(high,bottom-height);dirty=false;
   }
   // A short rail follows natively without any per-scroll layout work.
   if(low===high){docTop=null;focusTarget=null;write(high);return}
   const y=window.scrollY,box=track.getBoundingClientRect();
   let previous=docTop??y+rail.getBoundingClientRect().top;
   if(focusTarget){
    // Tab / Shift+Tab can reach controls at either edge of a tall rail.
    const rect=focusTarget.getBoundingClientRect(),current=rail.getBoundingClientRect().top;
    if(rect.top<high)previous=y+current+high-rect.top;
    else if(rect.bottom>bottom)previous=y+current+bottom-rect.bottom;
    focusTarget=null;
   }
   // Keep the same document position through a direction change. Downward
   // movement reveals the foot, then follows it; upward reveals the head.
   const wanted=clamp(previous,y+low,y+high);
   docTop=clamp(wanted,y+box.top,y+Math.max(box.top,box.bottom-height));
   write(clamp(docTop-y,low,high));
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
  const resize=()=>{dirty=true;schedule()};
  const scroll=()=>{if(low<high)schedule()};
  const focus=(event:FocusEvent)=>{if(low<high&&event.target instanceof HTMLElement&&event.target.matches(':focus-visible')&&!event.target.closest('dialog')){focusTarget=event.target;schedule()}};
  const observer=new ResizeObserver(resize);observer.observe(rail);observer.observe(track);if(header)observer.observe(header);
  desktop.addEventListener('change',resize);window.addEventListener('resize',resize);
  viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  window.addEventListener('scroll',scroll,{passive:true});rail.addEventListener('focusin',focus);
  update();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();desktop.removeEventListener('change',resize);
   window.removeEventListener('resize',resize);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);
   window.removeEventListener('scroll',scroll);rail.removeEventListener('focusin',focus);rail.style.removeProperty('--cd-rail-inset')};
 },[]);
 return ref;
}
