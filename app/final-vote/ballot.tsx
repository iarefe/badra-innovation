'use client';

import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {Check,CheckCircle2,Clock3,LockKeyhole,UsersRound,Vote} from 'lucide-react';
import type {FinalBallotView} from '@/lib/final-ballot';

const endpoint='/api/final-vote';
function Notice({icon,title,children,success=false}:{icon:ReactNode;title:string;children:ReactNode;success?:boolean}){
 return <section className={'fv-notice'+(success?' fv-success':'')}><span className="fv-icon" aria-hidden="true">{icon}</span><h2>{title}</h2>{children}</section>;
}
export default function Ballot({initial}:{initial:FinalBallotView|null}){
 const [view,setView]=useState(initial),[choice,choose]=useState(''),[saving,save]=useState(false),[loading,load]=useState(false),[error,fail]=useState('');
 const seq=useRef(0),submitting=useRef(false),receipt=useRef<HTMLDivElement>(null);
 const sync=useCallback(async(interactive=false)=>{
  const n=++seq.current;if(interactive){load(true);fail('')}
  try{
   const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw Error();
   const next=await r.json() as FinalBallotView;if(n!==seq.current)return;
   setView(next);if(next.vote)fail('');
   return next;
  }catch{if(n===seq.current&&interactive)fail('تعذّر تحديث حالة التصويت. حاول مرة أخرى.');}
  finally{if(n===seq.current)load(false)}
 },[]);
 useEffect(()=>{
  if(!initial)void sync(true);
  const onActive=()=>{if(!document.hidden&&!submitting.current)void sync()};
  const timer=window.setInterval(onActive,20000);window.addEventListener('focus',onActive);document.addEventListener('visibilitychange',onActive);
  return ()=>{++seq.current;clearInterval(timer);window.removeEventListener('focus',onActive);document.removeEventListener('visibilitychange',onActive)};
 },[initial,sync]);
 async function submit(e:FormEvent){
  e.preventDefault();const team=view?.teams.find(x=>x.id===choice);
  if(submitting.current||!view?.attending||view.phase!=='open'||view.vote||!team)return;
  submitting.current=true;++seq.current;load(false);save(true);fail('');
  try{
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vote',team:team.id})});
   if(!r.ok){const d=await r.json().catch(()=>null) as {error?:string}|null;throw Error(d?.error||'تعذّر تأكيد الصوت. تحقّق من حالته وحاول مجددًا.')}
   setView({...view,vote:{team:team.id,title:team.title}});requestAnimationFrame(()=>receipt.current?.focus());
  }catch(err){
   const checked=await sync();if(checked?.vote)requestAnimationFrame(()=>receipt.current?.focus());
   else fail(err instanceof TypeError?'تعذّر التأكد من حفظ صوتك. حدّث حالة التصويت قبل المحاولة مجددًا.':err instanceof Error?err.message:'تعذّر تأكيد الصوت.');
  }finally{submitting.current=false;save(false)}
 }
 const refresh=<button className="fv-secondary" type="button" onClick={()=>void sync(true)} disabled={loading||saving}>{loading?'جارٍ التحديث…':'تحديث حالة التصويت'}</button>;
 const confirmed=view?.vote,selected=view?.teams.find(t=>t.id===choice);
 const ready=!!view&&view.phase==='open'&&view.signedIn&&view.attending&&!confirmed&&view.teams.length>0;
 const stage=confirmed?'صوتك محفوظ':!view?'':view.phase==='closed'?'أُغلق تصويت الختام':view.phase==='not_open'?'بانتظار فتح التصويت':ready?'يمكنك الآن اختيار الفريق':view.signedIn?'بانتظار تسجيل حضورك':'التصويت مفتوح؛ سجّل الدخول للمشاركة';
 const issue=error?<div className="fv-error" role="alert"><p>{error}</p>{ready&&refresh}</div>:null;
 return <div className="fv-root" dir="rtl"><header className="fv-bar"><div><a href="/" aria-label="الجهة المنظمة — الرئيسية"><img src="/placeholder.svg" alt="الجهة المنظمة" width="137" height="47"/></a><span className="fv-bar-line" aria-hidden="true"></span><b>هاكاثون الابتكار الرقمي</b></div></header>
 <main className="fv-main"><span className="fv-sr" role="status" aria-atomic="true">{saving?'جارٍ حفظ صوتك…':stage}</span><p className="fv-kicker"><Vote size={17} aria-hidden="true"/> تصويت الجمهور · جلسة الختام</p><h1>تصويت الختام</h1>
 {confirmed?<div className="fv-receipt" tabIndex={-1} ref={receipt}><Notice icon={<CheckCircle2/>} title="سُجّل صوتك" success><div className="fv-receipt-team"><small>الفريق الذي صوّتّ له</small><strong>{confirmed.title}</strong></div><p>يمكنك العودة إلى هذا الرابط لمراجعة اختيارك.</p></Notice></div>
 :!view?<Notice icon={<Clock3/>} title={error?'تعذّر تحميل بطاقة التصويت':'جارٍ التحقق من حالة التصويت'}><p>{error?'يمكنك إعادة المحاولة دون مغادرة الصفحة.':'تظهر لك بطاقة التصويت بعد التحقق من حالة الجلسة.'}</p>{refresh}</Notice>
 :view.phase==='not_open'?<Notice icon={<Clock3/>} title="لم يُفتح التصويت بعد"><p>يفتح المنظّم التصويت بعد عروض الفرق. يمكنك إبقاء هذه الصفحة مفتوحة.</p>{refresh}</Notice>
 :view.phase==='closed'?<Notice icon={<LockKeyhole/>} title="أُغلق تصويت الختام"><p>انتهى استقبال الأصوات لهذه الجلسة.</p>{!view.signedIn&&<a className="fv-secondary" href="/login?returnTo=/final-vote">سجّل الدخول لمراجعة صوتك</a>}</Notice>
 :!view.signedIn?<Notice icon={<UsersRound/>} title="سجّل دخولك للتصويت"><p>استخدم رقم جوالك المسجّل في بذرة. بعد التحقق ستعود إلى هذه الصفحة لاختيار فريقك.</p><a className="fv-primary" href="/login?returnTo=/final-vote">تسجيل الدخول للتصويت</a></Notice>
 :!view.attending?<Notice icon={<UsersRound/>} title="بانتظار تسجيل حضورك"><p>اطلب من المنظّم تسجيل حضورك في جلسة الختام. بعدها يمكنك التصويت من هنا.</p>{refresh}</Notice>
 :!view.teams.length?<Notice icon={<Clock3/>} title="لا توجد فرق متاحة للتصويت"><p>راجع منظم الجلسة أو حدّث هذه الصفحة.</p>{refresh}</Notice>
 :<form onSubmit={submit} className="fv-form" aria-busy={saving}><fieldset aria-describedby="fv-hint" disabled={saving}><legend>أي فريق تقدّم بالحل الأفضل؟</legend><p id="fv-hint">اختر فريقًا واحدًا بناءً على الحل الذي شاهدته في العرض الختامي.</p>
 <div className="fv-choices">{view.teams.map(team=><label key={team.id} className="fv-choice" data-selected={choice===team.id}><input type="radio" name="final-team" value={team.id} checked={choice===team.id} onChange={()=>{choose(team.id);fail('')}}/><strong>{team.title}</strong>{choice===team.id&&<Check className="fv-choice-check" size={18} aria-hidden="true"/>}</label>)}</div></fieldset>
 <div className="fv-review"><p id="fv-choice-note" className="fv-review-line">{selected?<><span>اختيارك قبل التأكيد</span><strong>{selected.title}</strong></>:'اختر فريقًا لتفعيل زر التأكيد.'}</p>
 {selected&&<p className="fv-footnote" id="fv-final-note">يمكنك تغيير اختيارك الآن. بعد تأكيد صوتك لا يمكن تعديله.</p>}
 <button className="fv-primary" type="submit" aria-describedby={selected?'fv-choice-note fv-final-note':'fv-choice-note'} disabled={saving||!selected}>{saving?'جارٍ حفظ صوتك…':'أكّد تصويتي'}</button>{issue}</div>
 </form>}
 {!ready&&issue}
 {view?.phase==='closed'&&<a className="fv-primary" href="/results">عرض نتائج الهاكاثون ←</a>}
 <footer className="fv-footer"><a href="/">العودة إلى الرئيسية ←</a></footer>
 </main></div>;
}
