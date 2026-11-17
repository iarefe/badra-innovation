'use client';
import {useEffect,useMemo,useState} from 'react';
import {Expand,Minimize,CheckCircle2,Clock3} from 'lucide-react';
import {displayQR} from '@/lib/display-qr';
import {ballotLink} from '@/lib/final-vote-link';
import type {BallotPhase} from '@/lib/final-ballot';
import EventLogo from '@/app/components/event-logo';


export default function FinalVoteProjector({initialPhase,initialLink}:{initialPhase:BallotPhase|null;initialLink:string}){
 const [url,setUrl]=useState(initialLink);const code=useMemo(()=>displayQR(url),[url]);
 const [phase,setPhase]=useState<BallotPhase|null>(initialPhase),[offline,setOffline]=useState(false),[full,setFull]=useState(false),[hint,setHint]=useState('');
 useEffect(()=>{
  setUrl(ballotLink(window.location.origin));
  let active=true;let inflight:AbortController|null=null;
  async function refresh(){if(document.hidden)return;inflight?.abort();const ctrl=new AbortController();inflight=ctrl;
   try{const res=await fetch('/api/final-vote',{cache:'no-store',credentials:'omit',signal:ctrl.signal});if(!res.ok)throw Error();const data=await res.json() as {phase:BallotPhase};
    if(!['not_open','open','closed'].includes(data.phase))throw Error();if(active&&!ctrl.signal.aborted){setPhase(data.phase);setOffline(false)}
   }catch{if(active&&!ctrl.signal.aborted)setOffline(true)}
  }
  const onFull=()=>setFull(!!document.fullscreenElement);
  void refresh();const timer=window.setInterval(refresh,6000);document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('fullscreenchange',onFull);
  return()=>{active=false;inflight?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);document.removeEventListener('fullscreenchange',onFull)};
 },[]);
 async function toggle(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();setHint('');}catch{setHint('يمكنك تكبير عرض الصفحة من قائمة المتصفح.');}}
 const open=phase==='open'&&!offline,closed=phase==='closed'&&!offline;
 const phaseLabel=offline?'نعيد الاتصال':open?'التصويت مفتوح':closed?'انتهى التصويت':phase==='not_open'?'بانتظار فتح التصويت':'نتحقق من حالة التصويت';
 return <main className="fv-projector" dir="rtl"><header className="fv-pro-head"><img width={223} height={76} src="/placeholder.svg" alt="الجهة المنظمة"/><EventLogo placement="presentation"/></header>
 <section className="fv-pro-stage" aria-labelledby="fv-projector-title"><div className="fv-pro-copy"><span className="fv-pro-kicker">هاكاثون الابتكار الرقمي <i aria-hidden="true"/> جلسة الختام</span>
 <span className="fv-pro-phase" data-tone={open?'open':closed?'closed':'wait'}>{open||closed?<CheckCircle2 size={16} aria-hidden="true"/>:<Clock3 size={16} aria-hidden="true"/>}{phaseLabel}</span>
 <h1 id="fv-projector-title">{open?'أيّ الحلول تختار؟':closed?'شكرًا لمشاركتكم':'تصويت الجمهور'}</h1>
 <p role="status">{offline?'نعيد الاتصال لمعرفة حالة التصويت…':open?'امسح الرمز بجوالك، واختر الحل الذي تراه الأجدر، ثم أكّد صوتك.':closed?'أُغلق تصويت الجمهور. تتولى الإدارة الآن مراجعة الحصيلة.':phase==='not_open'?'بعد عروض الفرق، سيظهر هنا رمز واحد للتصويت.':'نتحقق من حالة التصويت…'}</p>
 {open&&<small>للموظفين المسجّل حضورهم في هذه الجلسة · صوت واحد لكل حاضر</small>}</div>
 {open?<div className="fv-pro-code"><svg viewBox={'0 0 '+code.size+' '+code.size} role="img" aria-label="رمز QR لفتح تصويت الجمهور" shapeRendering="crispEdges"><rect width={code.size} height={code.size} fill="white"/><path d={code.path} fill="#142523"/></svg><a href="/final-vote" dir="ltr">{url.replace('https://','')}</a></div>:<div className="fv-pro-idle" aria-hidden="true">{closed?<CheckCircle2/>:<Clock3/>}</div>}
 </section>
 <footer className="fv-pro-foot"><span>شاشة القاعة · تصويت الحلول النهائية</span><button type="button" onClick={toggle} aria-pressed={full}>{full?<Minimize size={17} aria-hidden="true"/>:<Expand size={17} aria-hidden="true"/>} {full?'إنهاء ملء الشاشة':'ملء الشاشة'}</button></footer>{hint&&<small role="status">{hint}</small>}
 </main>;
}
