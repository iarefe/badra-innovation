"use client";
import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {ArrowLeft,ArrowRight,Play,X} from 'lucide-react';
import {getCompanionSteps,type GuideContext,type GuideStep} from '@/lib/companion-guidance';
import {placeCompanion,type GuidePosition} from '@/lib/companion-position';
import {useCompanionMotion} from './use-companion-motion';
import CompanionReminder,{useImprovementReminder} from './companion-reminder';
import {canRevise} from '@/lib/challenge-revision';
import type {Entry} from '@/lib/challenges';
type CompanionProps=GuideContext&{onReview:(entry:Entry)=>void;reviewing?:boolean};

const mascot='/brand/badra-guide/point-';
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const editable=(el:Element|null)=>!!el?.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]');
// Offscreen targets are included: a tour visits the page in order, not viewport order.
function findTarget(step:GuideStep){
 return Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(el=>{
  if(!el.isConnected||el.closest('[hidden],[inert]')||el.matches(':disabled,[aria-disabled="true"]')||!el.getClientRects().length)return false;
  const style=getComputedStyle(el);return style.visibility!=='hidden'&&style.display!=='none';
 });
}

export default function BadraCompanion(props:CompanionProps){
 // Consent belongs to this visit and account. It never survives navigation or reload.
 return <OptInGuide key={props.route+':'+(props.viewer.employeeId||'visitor')} {...props}/>;
}
function OptInGuide(props:CompanionProps){
 const [steps,setSteps]=useState<GuideStep[]|null>(null),control=useRef<HTMLButtonElement>(null);
 const plan=getCompanionSteps(props);
 const reminder=useImprovementReminder(props,!!steps||!!props.reviewing);
 const selected=props.entries.find(e=>props.route==='challenge/'+e.id);
 const reviewable=selected&&props.workshop&&!props.loading&&canRevise(selected,props.viewer,props.workshop.finalized)?selected:null;
 function start(){reminder.startTour();const available=plan.filter(s=>findTarget(s));if(available.length)setSteps(available)}
 function finish(restore=true){setSteps(null);if(restore)requestAnimationFrame(()=>control.current?.focus({preventScroll:true}))}
 return <>
  {!steps&&(plan.length>0||reminder.reminder||reviewable)&&<div className="badra-guide-root" data-phase="idle">
   {reviewable?<div className="badra-guide-control br-launcher" data-visible="true" role="group" aria-label="بذرة العائمة"><button type="button" className="br-launch-main" aria-haspopup="dialog" onClick={()=>{reminder.dismiss();props.onReview(reviewable)}}><img src={'/placeholder.svg'} width={29} height={31} alt=""/>قيّم البطاقة مع بذرة</button>{plan.length>0&&<button ref={control} type="button" className="br-launch-tour" onClick={start} aria-label="ابدأ جولة مع بذرة" title="جولة في الصفحة"><Play size={13}/>جولة</button>}</div>:plan.length>0&&<button ref={control} type="button" className="badra-guide-control" data-visible="true" onClick={start} aria-label="ابدأ جولة مع بذرة" title="تبدأ الجولة عند النقر فقط">
    <img src={'/placeholder.svg'} width={29} height={31} alt=""/><span>جولة مع بذرة</span><Play size={13} aria-hidden="true"/>
   </button>}
   {reminder.reminder&&<CompanionReminder value={reminder.reminder} onClose={reminder.dismiss} control={control}/>}
  </div>}
  {steps&&<PageTour steps={steps} onFinish={finish}/>}
 </>;
}

function PageTour({steps,onFinish}:{steps:GuideStep[];onFinish:(restore?:boolean)=>void}){
 const [index,setIndex]=useState(0),[placement,setPlacement]=useState<GuidePosition|null>(null),[explaining,setExplaining]=useState(false),[detached,setDetached]=useState(false),[returnTo,setReturnTo]=useState(0);
 const card=useRef<HTMLDivElement>(null),measure=useRef<HTMLDivElement>(null),nextButton=useRef<HTMLButtonElement>(null),wake=useRef<()=>void>(()=>{}),lastPosition=useRef<GuidePosition|null>(null);
 const finish=useRef(onFinish);finish.current=onFinish;
 const motion=useCompanionMotion(placement,()=>wake.current()),step=steps[index];
 const sequence={index:index+1,total:steps.length};
 useLayoutEffect(()=>{
  const target=findTarget(step);if(!target){finish.current();return}
  let disposed=false,frame=0,settleTimer:ReturnType<typeof setTimeout>|undefined,quietTimer:ReturnType<typeof setTimeout>|undefined;
  let lastScroll=performance.now(),lastMove=performance.now(),isExplaining=false,marked=false,focused=false,first=true;
  const unmark=()=>{
   if(!marked)return;marked=false;target.removeAttribute('data-badra-highlight');
   const description=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='badra-guide-message');
   if(description.length)target.setAttribute('aria-describedby',description.join(' '));else target.removeAttribute('aria-describedby');
  };
  const hide=()=>{unmark();isExplaining=false;setExplaining(false)};
  hide();setDetached(false);
  const viewport=()=>{const v=window.visualViewport;return {width:v?.width||window.innerWidth,height:v?.height||window.innerHeight,top:v?.offsetTop||0,left:v?.offsetLeft||0,header:Math.max(16,Math.min(110,document.querySelector('.site-header')?.getBoundingClientRect().bottom||16))}};
  const place=(p:GuidePosition)=>{lastPosition.current=p;lastMove=performance.now();setPlacement(p)};
  const tick=()=>{
   frame=0;if(disposed)return;if(!target.isConnected){finish.current();return}
   const now=performance.now();if(now-lastScroll<100){settleTimer=setTimeout(schedule,110);return}
   const v=viewport(),width=Math.min(380,v.width-24);
   if(measure.current){measure.current.style.width=width+'px';measure.current.style.maxHeight=Math.max(140,v.height-v.header-24)+'px'}
   const height=Math.max(99,measure.current?.offsetHeight||240),r=target.getBoundingClientRect();
   const inView=r.top>=v.top+v.header&&r.bottom<=v.top+v.height-12&&r.left>=v.left&&r.right<=v.left+v.width;
   const obstacles=Array.from(document.querySelectorAll<HTMLElement>('main button,main a,main input,main textarea,main select,main summary')).filter(el=>el!==target&&!target.contains(el)&&!el.contains(target)&&el.getClientRects().length).map(el=>el.getBoundingClientRect()).filter(r=>r.top>=v.top+v.header&&r.bottom<v.top+v.height);
   // Prefer free space; on narrow screens the note may cover other content, never its target.
   const near=inView?(placeCompanion(r,{width,height},v,obstacles,lastPosition.current)||placeCompanion(r,{width,height},v,[],lastPosition.current)):null;
   const p:GuidePosition=near||{left:v.left+12,top:Math.max(v.top+v.header,v.top+v.height-height-12),width,mascotLeft:v.left+12,mascotTop:Math.max(v.top+v.header,v.top+v.height-111),figure:'left',facing:'right',pose:'up',side:'bottom',path:'',endX:0,endY:0};
   setDetached(!near);
   const old=lastPosition.current;
   const changed=!old||Math.max(Math.abs(old.left-p.left),Math.abs(old.top-p.top),Math.abs(old.mascotLeft-p.mascotLeft),Math.abs(old.mascotTop-p.mascotTop),Math.abs(old.width-p.width),Math.abs(old.endX-p.endX),Math.abs(old.endY-p.endY))>.75||old.pose!==p.pose||old.facing!==p.facing;
   if(first&&!old){first=false;place({...p,mascotLeft:v.left+18,mascotTop:v.top+v.height-115});frame=requestAnimationFrame(()=>{frame=0;schedule()});return}
   first=false;
   if(changed){hide();place(p);settleTimer=setTimeout(schedule,180);return}
   // A throttled animation clock must not leave the visitor waiting for the controls.
   if(!isExplaining&&(motion.settled.current||now-lastMove>=1600)&&now-lastMove>=140){
    isExplaining=true;setExplaining(true);
    if(near){marked=true;target.dataset.badraHighlight='true';target.setAttribute('aria-describedby',[target.getAttribute('aria-describedby'),'badra-guide-message'].filter(Boolean).join(' '))}
    if(!focused){focused=true;requestAnimationFrame(()=>nextButton.current?.focus({preventScroll:true}))}
   }else if(!isExplaining)settleTimer=setTimeout(schedule,160);
  };
  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(tick)}
  wake.current=schedule;
  const scroll=()=>{lastScroll=performance.now();hide();clearTimeout(quietTimer);quietTimer=setTimeout(schedule,130)};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();finish.current()}};
  const interaction=(e:MouseEvent)=>{
   const el=e.target instanceof Element?e.target:null;
   if(el&&!el.closest('.badra-guide-root')&&el.closest('a,button,input,textarea,select,summary,[role="tab"]'))finish.current(false);
  };
  const focus=(e:FocusEvent)=>{if(editable(e.target as Element)&&!(e.target as Element).closest('.badra-guide-root'))finish.current(false)};
  const visibility=()=>{if(document.hidden)finish.current(false)};
  const resize=new ResizeObserver(schedule);resize.observe(target);if(measure.current)resize.observe(measure.current);
  const observer=new MutationObserver(()=>{if(!target.isConnected||document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]'))finish.current(false)});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','aria-modal']});
  document.addEventListener('scroll',scroll,{capture:true,passive:true});window.addEventListener('resize',scroll);window.visualViewport?.addEventListener('resize',scroll);window.visualViewport?.addEventListener('scroll',scroll);
  document.addEventListener('keydown',key);document.addEventListener('click',interaction,true);document.addEventListener('focusin',focus);document.addEventListener('visibilitychange',visibility);
  // Leave room below the target for the note on a phone or short viewport.
  const v=viewport(),compact=v.width<900||v.height<650,originalMargin=target.style.scrollMarginTop;
  // Also allow for the page's 28px section entrance animation finishing after scroll.
  if(compact)target.style.scrollMarginTop=(v.header+56)+'px';
  // Only Start, Next, Previous and Return may initiate scrolling.
  target.scrollIntoView({block:compact?'start':'center',inline:'nearest',behavior:reduced()?'instant':'smooth'});schedule();
  return()=>{disposed=true;unmark();target.style.scrollMarginTop=originalMargin;cancelAnimationFrame(frame);clearTimeout(settleTimer);clearTimeout(quietTimer);resize.disconnect();observer.disconnect();wake.current=()=>{};
   document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);window.visualViewport?.removeEventListener('resize',scroll);window.visualViewport?.removeEventListener('scroll',scroll);
   document.removeEventListener('keydown',key);document.removeEventListener('click',interaction,true);document.removeEventListener('focusin',focus);document.removeEventListener('visibilitychange',visibility);
  };
 },[step,returnTo]);
 const note=(measuring=false)=><GuideNote step={step} sequence={sequence} measuring={measuring} detached={detached} onReturn={()=>setReturnTo(v=>v+1)} onClose={()=>onFinish()} onPrevious={()=>setIndex(v=>Math.max(0,v-1))} onNext={()=>index+1<steps.length?setIndex(v=>v+1):onFinish()} nextRef={measuring?undefined:nextButton}/>;
 return <div className="badra-guide-root" data-phase={explaining?'explain':'travel'} data-step={step.id}>
  <div ref={measure} className="badra-guide badra-guide-measure" aria-hidden="true" inert>{note(true)}</div>
  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{explaining?`بذرة · ${sequence.index} من ${sequence.total}: ${step.title}. ${step.text}`:''}</p>
  <div ref={motion.element} className="badra-guide-traveller" data-visible={!!placement} aria-hidden="true"><div className="badra-guide-sprite">{(['up','down'] as const).flatMap(pose=>(['left','right'] as const).map(facing=><img key={pose+facing} className="badra-guide-mascot" data-pose={pose} data-facing={facing} data-visible={placement?.pose===pose&&placement?.facing===facing} src={'/placeholder.svg'} width={84} height={99} alt="" draggable={false}/>))}</div></div>
  {placement&&<>
   {!detached&&<svg className="badra-guide-pointer" aria-hidden="true"><defs><marker id="badra-guide-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1L6 4L1 7"/></marker></defs><path d={placement.path} markerEnd="url(#badra-guide-arrow)"/></svg>}
   <div ref={card} className="badra-guide" role="region" aria-label="جولة بذرة" aria-hidden={!explaining} inert={!explaining} data-figure={placement.figure} style={{left:placement.left,top:placement.top,width:placement.width}}>{note()}</div>
  </>}
 </div>;
}

function GuideNote({step,sequence,measuring=false,detached,onReturn,onClose,onPrevious,onNext,nextRef}:{step:GuideStep;sequence:{index:number;total:number};measuring?:boolean;detached:boolean;onReturn:()=>void;onClose:()=>void;onPrevious:()=>void;onNext:()=>void;nextRef?:RefObject<HTMLButtonElement|null>}){
 return <div className="badra-guide-bubble"><div className="badra-guide-caption"><span><i/>بذرة · جولة الصفحة<small>{sequence.index.toLocaleString('ar-SA')} / {sequence.total.toLocaleString('ar-SA')}</small></span><button type="button" aria-label="إنهاء جولة بذرة" onClick={onClose}><X size={17}/></button></div>
  <div id={measuring?undefined:'badra-guide-message'}><h2>{step.title}</h2><p>{step.text}</p></div>
  {detached&&<button type="button" className="badra-guide-return" onClick={onReturn}>العودة إلى موضع الخطوة</button>}
  <div className="badra-guide-actions"><button type="button" onClick={onPrevious} disabled={sequence.index===1}><ArrowRight size={14} aria-hidden="true"/>السابق</button><button ref={nextRef} type="button" onClick={onNext}>{sequence.index<sequence.total?'التالي':'إنهاء الجولة'}<ArrowLeft size={14} aria-hidden="true"/></button></div>
  {sequence.index<sequence.total&&<button type="button" className="badra-guide-exit" onClick={onClose}>إنهاء الجولة</button>}
 </div>;
}
