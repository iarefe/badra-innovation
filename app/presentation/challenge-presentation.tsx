'use client';
import {useCallback,useEffect,useMemo,useReducer,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpLeft,ChevronLeft,ChevronRight,Maximize,Minimize,Pause,Play,Plus,ScanLine,UsersRound} from 'lucide-react';
import {cardPath,displayOrigin,displayReducer,displayState,refreshMs,slideDurationMs,submitUrl,type DisplayFeed} from '@/lib/presentation';
import {displayQR} from '@/lib/display-qr';
import EventLogo from '../components/event-logo';
import {eventLogoStill} from '@/lib/event-logo';
import {useTravellingLogo} from './travelling-logo';
import {useLiveIntake} from '../components/intake-state';
import {engagementFocus} from '@/lib/hackathon-intake';
import SlideTimer from './slide-timer';

const folio=(n:number)=>String(n).padStart(2,'0');
function ScanCode({url,label}:{url:string;label:string}){
 const {size,path}=useMemo(()=>displayQR(url),[url]);
 return <a href={url} className="deck-code" aria-label={label}><svg role="img" aria-label={label} viewBox={'0 0 '+size+' '+size} shapeRendering="crispEdges"><rect width={size} height={size} fill="white"/><path d={path} fill="#101816"/></svg></a>;
}
function AuthorImage({url,name}:{url:string|null;name:string}){
 const [failed,setFailed]=useState<string|null>(null);
 return <span className="deck-avatar" aria-hidden="true">{url&&failed!==url?<img src={url} alt="" onError={()=>setFailed(url)}/>:name.trim().slice(0,1)||'•'}</span>;
}
export default function ChallengePresentation({initial}:{initial:DisplayFeed|null}){
 const [{feed,id},dispatch]=useReducer(displayReducer,initial,displayState);
 const [paused,setPaused]=useState(false),[visible,setVisible]=useState(true),[unavailable,setUnavailable]=useState(!initial);
 const [full,setFull]=useState(false),[canFull,setCanFull]=useState(false),[hint,setHint]=useState('');
 const refreshNow=useRef<(()=>void)|null>(null),startedWithoutFeed=useRef(!initial);
 const slides=feed?.slides??[],idx=slides.findIndex(s=>s.id===id),slide=slides[idx],hasSlides=slides.length>0,opening=id===null;
 const nextIsOpening=!opening&&idx===slides.length-1,nextLabel=nextIsOpening?'العودة إلى الافتتاحية':'التحدي التالي';
 const {dock,traveller,destination,shell}=useTravellingLogo(opening);
 const advance=useCallback(()=>dispatch({type:'move',offset:1}),[]);
 useEffect(()=>{
  let disposed=false,inFlight=false,timer:ReturnType<typeof setTimeout>,active:AbortController|null=null;
  function arm(){clearTimeout(timer);if(!disposed&&!document.hidden)timer=setTimeout(refresh,refreshMs);}
  async function refresh(){
   if(disposed||inFlight||document.hidden)return;
   clearTimeout(timer);const req=new AbortController();active=req;inFlight=true;
   const deadline=setTimeout(()=>req.abort(),12000);
   try{
    const res=await fetch('/api/presentation',{cache:'no-store',credentials:'omit',signal:req.signal});
    if(!res.ok)throw Error();
    const next:DisplayFeed=await res.json();
    if(!Array.isArray(next.slides)||typeof next.votingOpen!=='boolean'||typeof next.title!=='string')throw Error();
    if(!disposed){dispatch({type:'refresh',feed:next});setUnavailable(false);}
   }catch{if(!disposed)setUnavailable(true);}
   finally{clearTimeout(deadline);active=null;inFlight=false;arm();}
  }
  function visibility(){setVisible(!document.hidden);if(document.hidden){clearTimeout(timer);}else{void refresh();}}
  function offline(){setUnavailable(true);}
  function fullscreenChange(){setFull(!!document.fullscreenElement);}
  setCanFull(!!document.fullscreenEnabled);fullscreenChange();setVisible(!document.hidden);
  refreshNow.current=refresh;
  if(startedWithoutFeed.current)void refresh();else arm();
  window.addEventListener('online',refresh);window.addEventListener('offline',offline);
  document.addEventListener('visibilitychange',visibility);document.addEventListener('fullscreenchange',fullscreenChange);
  return ()=>{disposed=true;clearTimeout(timer);active?.abort();refreshNow.current=null;window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',fullscreenChange);};
 },[]);
 useEffect(()=>{
  function key(e:KeyboardEvent){
   if(!hasSlides||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.repeat||(e.target instanceof HTMLElement&&e.target.closest('button,a,input,textarea,select,[contenteditable="true"]')))return;
   if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();dispatch({type:'move',offset:e.key==='ArrowLeft'?1:-1});}
   else if(e.key===' '){e.preventDefault();setPaused(p=>!p);}
  }
  window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key);
 },[hasSlides]);
 async function toggleFull(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setHint('');}catch{setHint('استخدم خيار ملء الشاشة في متصفحك.');}}
 const intake=useLiveIntake(feed?.intake,undefined,false),taking=intake.phase==='open'&&!!feed,focus=engagementFocus(intake),libraryUrl=displayOrigin+'/challenges',entryUrl=taking?submitUrl:libraryUrl;
 const joinTarget=slide?displayOrigin+cardPath(slide.id):entryUrl,closed=feed?.votingOpen===false,eventTitle=feed?.title||'هاكاثون الابتكار الرقمي';
 return <main dir="rtl" className="challenge-deck" aria-label="شاشة عرض التحديات">
  <div className="deck-shell" data-opening={opening} ref={shell}>
   <header className="deck-mast">
    <div className="deck-event"><div ref={dock} className="deck-logo-dock"><div className="deck-logo-traveller" ref={traveller}><EventLogo placement="presentation" paused={paused}/></div></div><div className="deck-event-caption"><span className="deck-kicker">مبادرة لمنسوبي المؤسسة</span><p>{opening?'شاشة التحديات':eventTitle}</p></div></div>
    <div className="deck-mast-end"><span className="deck-live" data-offline={unavailable}><i/>{unavailable?'بانتظار الاتصال':'عرض مباشر'}</span><img className="deck-organization" src="/placeholder.svg" alt="الجهة المنظمة"/></div>
   </header>
   <section className={'deck-stage'+(opening?' deck-stage-opening':'')} aria-roledescription="عرض شرائح" aria-label="عرض الهاكاثون">
    {opening?<article className="deck-opening" aria-roledescription="شريحة" aria-label="الشريحة الافتتاحية">
     <div className="deck-opening-folio"><span>افتتاح العرض</span><b dir="ltr">01 / {folio(slides.length+1)}</b></div>
     <div className="deck-opening-center">
      <div className="deck-intro-mark" ref={destination} aria-hidden="true"><img src={eventLogoStill} alt="" width={576} height={256}/></div>
      <span className="deck-opening-kicker">من التحدّي إلى الحلّ الرقمي</span>
      <h1>{eventTitle}</h1>
      {hasSlides?<p>تعرّف على تحديات زملائك، واختر التحدّي الذي تودّ العمل على حلّه.</p>:<div className="deck-waiting"><ScanCode url={entryUrl} label={taking?'فتح صفحة طرح تحدٍّ':'فتح مكتبة التحديات'}/><div><strong>{taking?'أوّل تحدٍّ قد يكون تحدّيك.':feed?'مكتبة التحديات':'بانتظار اتصال العرض'}</strong><p>{taking?'امسح الرمز واطرح تحدّيك. سيظهر هنا بعد نشره.':feed?'لا توجد تحديات منشورة للعرض. امسح الرمز لاستعراض المكتبة.':'نحاول تحميل التحديات تلقائيًا. يمكنك استعراض المكتبة عبر الرمز.'}</p></div></div>}
     </div>
    </article>:slide&&<>
    <div className="deck-story" key={slide.id} aria-roledescription="شريحة" aria-label={'التحدي '+(idx+1)+' من '+slides.length} aria-live={paused?'polite':'off'}>
     <img key={slide.coverUrl} alt="" className="deck-cover" src={slide.coverUrl}/>
     <div className="deck-scrim"/>
     <div className="deck-story-body">
      <div className="deck-folio"><span className="deck-rule"/><span>تحدٍّ من واقع العمل</span><b dir="ltr" aria-label={'الشريحة '+(idx+2)+' من '+(slides.length+1)}>{folio(idx+2)} / {folio(slides.length+1)}</b></div>
      <div className="deck-copy">
       {(slide.domain||slide.scope)&&<div className="deck-tags">{slide.domain&&<span>{slide.domain}</span>}{slide.scope&&<span>{slide.scope}</span>}</div>}
       <h1 className={slide.title.length>70?'deck-long-title':undefined}>{slide.title}</h1>
       <p className="deck-summary">{slide.summary}</p>
      </div>
      <div className="deck-people">
       {slide.author&&<div className="deck-owner"><AuthorImage name={slide.author} url={slide.avatarUrl}/><div><span className="deck-label">صاحب التحدي</span><strong>{slide.author}</strong>{slide.department&&<small>{slide.department}</small>}</div></div>}
       {slide.team&&<div className="deck-team"><UsersRound size={19} aria-hidden="true"/><div><span className="deck-label">شركاء طرح التحدي</span><p>{slide.team}</p></div></div>}
      </div>
     </div>
    </div>
    <aside className="deck-participate" aria-label="المشاركة في هذا التحدي">
     <div className="deck-scan-heading"><ScanLine size={20} aria-hidden="true"/><span>شارك من جوالك</span></div>
     <div className="deck-qr-frame"><ScanCode url={joinTarget} label={'فتح بطاقة التحدي: '+slide.title}/></div>
     <h2>{!taking&&focus==='browse'?'استعرض بطاقة التحدي':closed?'انضم إلى فريق الحل':'صوّت أو سجّل رغبتك'}</h2>
     <p>{!taking&&focus==='browse'?'امسح الرمز لقراءة بطاقة التحدي والتعرّف على أثره.':closed?'التصويت مغلق حاليًا. افتح البطاقة وسجّل رغبتك في الانضمام إلى فريق الحل.':'امسح الرمز لفتح بطاقة التحدي والتصويت له أو تسجيل رغبتك في الانضمام إلى فريقه.'}</p>
     <a className="deck-direct" href={joinTarget}>افتح بطاقة التحدي<ArrowUpLeft size={17} aria-hidden="true"/></a>
    </aside></>}
   </section>
   <div className="deck-invite"><span className="deck-plus">{taking?<Plus size={22} aria-hidden="true"/>:<UsersRound size={22} aria-hidden="true"/>}</span><div><strong>{taking?'عندك تحدٍّ من واقع عملك؟':focus==='browse'?'تحديات الهاكاثون':'أيّ تحدٍّ تودّ العمل عليه؟'}</strong><span>{taking?' اطرحه عبر مساعد بذرة ليظهر على هذه الشاشة.':focus==='vote-join'?' صوّت لما تراه أولوية وسجّل رغبتك في الانضمام.':focus==='join'?' استعرض التحديات وسجّل رغبتك بالانضمام.':' استعرض البطاقات المنشورة وتعرّف على أصحابها.'}</span></div><a href={entryUrl}><b>{taking?'اطرح تحدّيك':'استعرض التحديات'}</b><span dir="ltr">{taking?'example.invalid/submit':'example.invalid/challenges'}</span><ArrowLeft size={18} aria-hidden="true"/></a></div>
   <footer className="deck-controls">
    <div className="deck-playback-info">{hasSlides&&<SlideTimer key={id??'opening'} durationMs={slideDurationMs(id)} onEnd={advance} running={!paused&&visible} final={nextIsOpening}/>}
     <div className="deck-status"><i aria-hidden="true"/><span>{unavailable&&feed?'تعذّر التحديث مؤقتًا · آخر عرض متاح':hasSlides?'الشريحة '+(opening?1:idx+2)+' من '+(slides.length+1):'يتحدّث العرض تلقائيًا'}</span></div>
    </div>
    <div className="deck-controls-row">
     {hasSlides&&<button type="button" title="الشريحة السابقة" aria-label="الشريحة السابقة" onClick={()=>dispatch({type:'move',offset:-1})}><ChevronRight size={19}/></button>}
     <button type="button" className="deck-play" aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'استئناف العرض':'إيقاف مؤقت'}</button>
     {hasSlides&&<button type="button" title={nextLabel} aria-label={nextLabel} onClick={advance}><ChevronLeft size={19}/></button>}
     {canFull&&<button type="button" className="deck-full" onClick={toggleFull} aria-label={full?'إنهاء ملء الشاشة':'ملء الشاشة'}>{full?<Minimize size={17}/>:<Maximize size={17}/>}<span>{full?'إنهاء ملء الشاشة':'ملء الشاشة'}</span></button>}
     {unavailable&&<button type="button" onClick={()=>refreshNow.current?.()}>إعادة المحاولة</button>}
    </div>
   </footer><p className="sr-only" role="status">{hint}</p>
  </div>
 </main>;
}
