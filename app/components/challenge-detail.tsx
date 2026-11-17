'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,PenLine,Sparkles,X} from 'lucide-react';
import type {Challenge,Entry,Viewer,Workshop} from '@/lib/challenges';
import type {ChallengeCover} from '@/lib/challenge-cover';
import {RoleTags,StatusBadge} from './participation-badges';
import {ChallengeAuthor} from './profile-avatar';
import CoverEditor,{CoverImage} from './challenge-cover';
import ChallengeCompletion from './challenge-completion';
import ChallengeReader from './challenge-reader';
import {useFollowingRail} from './use-following-rail';
import MotionAction from './motion-action';
import ChallengeCategory from './challenge-category';

type Props={
 entry:Entry;viewer:Viewer;workshop:Workshop|null;busy:boolean;
 onAction:(entry:Entry,action:string)=>void;onEdit:(entry:Entry)=>void;onReview:(entry:Entry)=>void;onStart:(value:Challenge)=>void;
 onCover:(id:string,cover:ChallengeCover)=>void;onSaved:(id:string,challenge:Challenge)=>void;
 onCategory:(id:string,domain:Challenge['domain'])=>void;
};
function ManagerCounters({entry:e}:{entry:Entry}){
 const [list,setList]=useState<'votes'|'joins'|null>(null),dlg=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(list&&!dlg.current?.open)dlg.current?.showModal()},[list]);
 const voters=list==='votes',people=voters?e.voters:e.interestedMembers;
 return <><div className="cd-counts">{([['votes',e.votes,'مصوّت','المصوّتين'],['joins',e.interestCount,'راغب بالانضمام','الراغبين بالانضمام']] as const).map(([key,value,label,names])=><button type="button" key={key} onClick={()=>setList(key)} aria-haspopup="dialog" aria-label={'عرض قائمة '+names+' ('+(value??0)+')'}><b>{(value??0).toLocaleString('ar-SA')}</b><span>{label}</span></button>)}</div>
  <dialog ref={dlg} className="cd-members-dialog" aria-labelledby="cd-members-title" onClose={()=>setList(null)}><header><h2 id="cd-members-title">{voters?'المصوّتون':'الراغبون بالانضمام'}</h2><button type="button" aria-label="إغلاق القائمة" onClick={()=>dlg.current?.close()}><X size={18}/></button></header>
  {people?.length?<ul>{voters?e.voters!.map((p,i)=><li key={i}>{p.name}</li>):e.interestedMembers!.map((p,i)=><li key={i}><strong>{p.name}</strong><RoleTags roles={p.roles}/></li>)}</ul>:<p>{voters?'لا توجد أصوات بعد.':'لم يسجّل أحد رغبته بالانضمام بعد.'}</p>}</dialog></>;
}
function ShareTools({entry:e}:{entry:Entry}){
 const [copied,setCopied]=useState(false),[manual,setManual]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current)}},[]);
 async function copy(){const url=new URL('/challenge/'+encodeURIComponent(e.id),window.location.origin).href;try{await navigator.clipboard.writeText(url);if(!alive.current)return;setManual('');setCopied(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),1500)}catch{if(alive.current)setManual(url)}}
 return <><div className="cd-share"><button type="button" onClick={copy} aria-live="polite">{copied?'تم النسخ':'نسخ الرابط'}</button><a href={'/api/challenge-pdf?id='+encodeURIComponent(e.id)} download>تنزيل PDF</a></div>
 {manual&&<label className="cd-manual-link">انسخ رابط التحدي:<input readOnly dir="ltr" value={manual} onFocus={e=>e.target.select()}/></label>}</>;
}
export default function ChallengeDetail({entry:e,viewer,workshop,busy,onAction,onCover,onEdit,onReview,onSaved,onStart,onCategory}:Props){
 const rail=useFollowingRail();
 const c=e.challenge,published=e.status==='published',real=!e.example,owner=real&&e.mine;
 const taking=!workshop?.intake||workshop.intake.phase==='open';
 const afterAnnouncement=!!workshop?.announced?.length,chosen=!!workshop?.announced?.some(t=>t.id===e.id);
 const teamLink=chosen?'/teams?team='+encodeURIComponent(e.id):'/teams';
 const ownerTools=useRef<HTMLElement>(null);
 const eligible=real&&published&&!owner,open=!!workshop?.open,joiningOpen=!!workshop?.joiningOpen,frozen=!!workshop?.finalized;
 const vote=(footer=false)=><MotionAction className={'cd-btn '+(footer?'cd-vote-footer':'cd-vote')} data-companion-target={footer?undefined:'vote'} selected={e.voted} disabled={busy||!open} onClick={()=>onAction(e,'vote')}>{e.voted&&<Check size={17} aria-hidden="true"/>}{!open?'التصويت مغلق':e.voted?(footer?'تم التصويت':'صوّتّ لهذا التحدي'):(footer?'صوّت الآن':'صوّت لهذا التحدي')}</MotionAction>;
 const call=e.example?<div className="cd-call"><div><h3>مثال للاستلهام</h3><p>مثال افتراضي لا يمثل مشاركة مسجّلة ولا يدخل في التصويت أو الانضمام.</p></div>{taking?<button type="button" className="cd-btn cd-vote-footer" onClick={()=>onStart(c)}>صف تحديًا مستوحى من المثال</button>:<a className="cd-btn cd-vote-footer" href="/challenges">استعرض تحديات زملائك</a>}</div>:
  afterAnnouncement&&published?<div className="cd-call"><div><h3>{chosen?'من التحدّي إلى الحل':'اكتمل ترشيح التحديات'}</h3><p>{chosen?'اختير هذا التحدّي للهاكاثون. ينتقل الفريق الآن إلى بناء النموذج وعرض الحل.':'تعرّف على التحديات التي انتقلت إلى مرحلة بناء الحلول.'}</p></div><a className="cd-btn cd-vote-footer" href={teamLink}>{chosen?'انتقل إلى مساحة الفريق':'استعرض التحديات المعتمدة'} ←</a></div>:<div className="cd-call"><div><h3>صوتك يحدد أولوية الاستكشاف</h3><p>التحديات المختارة تنتقل إلى الفريق لفهمها، وابتكار بدائل، وبناء نموذج أولي واختباره.</p></div>{eligible&&vote(true)}</div>;
 return <article className="cd-page" dir="rtl">
  <nav className="cd-crumb" aria-label="مسار التنقل"><a href="/challenges">التحديات</a><span aria-hidden="true">/</span><span>{c.domain}</span></nav>
  <div className="cd-cover"><CoverImage entry={e} priority/></div>
  <header className="cd-intro"><div className="cd-tags">{chosen&&<StatusBadge state="challenge-published">معتمد للهاكاثون</StatusBadge>}<div className="cd-category"><span className="cd-domain-tag">{c.domain}</span>{real&&(owner||viewer.manager)&&<ChallengeCategory entry={e} frozen={frozen} disabled={busy} onSaved={onCategory}/>}</div> {e.example&&<span>مثال للاستلهام</span>}{!published&&<StatusBadge state={`challenge-${e.status}`}>{({draft:'مسودة خاصة',pending:'لم يُنشر بعد',returned:'يحتاج استكمالًا',published:''})[e.status]}</StatusBadge>}</div><h1 data-badra-anchor="challenge-title">{c.title}</h1></header>
  {e.reviewNote&&<div className="cd-review-note"><b>ملاحظة مدير النظام:</b> {e.reviewNote}</div>}
  <div className="cd-layout"><ChallengeReader challenge={c} call={call}/>
   <aside ref={rail} className="cd-rail" aria-label="المشاركة ومعلومات التحدي">
    {published&&real&&<section className="cd-box cd-participate" aria-label="التصويت ورغبات الانضمام">
     {viewer.manager&&<ManagerCounters entry={e}/>}
     {afterAnnouncement?<><h2>{chosen?'تحدٍّ معتمد للهاكاثون':'اكتملت مرحلة الترشيح'}</h2><p className="cd-note">{chosen?'يعمل الفريق على بناء النموذج وإعداد العرض.':'أُغلق التصويت وتسجيل رغبات الانضمام.'}</p><a href={teamLink} className="cd-btn cd-vote">{chosen?'مساحة الفريق':'التحديات المعتمدة'} ←</a></>:owner?<><h2>هذا تحدّيك</h2><p className="cd-note">يمكنك التصويت وتسجيل رغبتك بالانضمام إلى تحديات الآخرين.</p></>:<>
      {!viewer.manager&&<h2>{!open||e.voted?'مشاركتك في التحدي':e.hasVotes?'انضم للمصوّتين':'كن أول مصوّت'}</h2>}
      {vote()}<MotionAction className="cd-btn cd-join" data-companion-target="interest" selected={!!e.interested} disabled={busy||!joiningOpen} onClick={()=>onAction(e,'interest')}>{e.interested&&<Check size={17} aria-hidden="true"/>}{!joiningOpen?'الانضمام مغلق':e.interested?'سجّلت رغبتي بالانضمام':'أرغب بالانضمام لفريقه'}</MotionAction>
      <p className="cd-note">{open&&joiningOpen?'صوتك يرفع أولوية التحدي، ورغبتك بالانضمام تساعد المدير في توزيع الفرق.':open?'التصويت متاح. الانضمام مغلق ورغباتك السابقة محفوظة.':joiningOpen?'التصويت مغلق، ويمكنك تسجيل رغبتك بالانضمام إلى الفريق.':'التصويت والانضمام مغلقان، والأصوات والرغبات السابقة محفوظة.'}</p>
     </>}
    </section>}
    <section className="cd-box cd-info" aria-label="معلومات التحدي">
     {e.example?<div className="cd-example-note"><strong>مثال للاستلهام</strong><p>هذه البطاقة مثال افتراضي وليست مشاركة مسجّلة.</p></div>:<div><ChallengeAuthor entry={e} label/>{owner&&<a className="cd-photo-link" href="/account#profile-photo">{e.authorAvatar?'تعديل صورتك':'أضف صورتك الشخصية'}</a>}</div>}
     <ShareTools entry={e}/>
    </section>
    {owner&&<section className="cd-owner" ref={ownerTools} tabIndex={-1} aria-label="أدوات صاحب التحدي"><span>أدوات صاحب التحدي</span><div><CoverEditor entry={e} onUpdate={onCover} compact/><button type="button" className="cd-delete" disabled={busy||(frozen&&published&&!viewer.manager)} title={frozen&&published&&!viewer.manager?'لا يمكن حذف تحدٍّ بعد اعتماد القائمة.':undefined} onClick={()=>onAction(e,'delete')}>حذف</button></div></section>}
    {real&&(owner||viewer.manager)&&!viewer.needsProfile&&<div className="cd-edit-actions br-tools" role="group" aria-label="تعديل تفاصيل التحدي">
     {published&&frozen?<p>اعتُمدت القائمة النهائية. يتاح التعديل بعد إعادة فتحها.</p>:<><button className="br-direct" type="button" data-badra-anchor="edit-card" disabled={busy} onClick={()=>onEdit(e)}><PenLine size={16}/>تعديل التحدي</button><button className="br-review-link" type="button" disabled={busy} onClick={()=>onReview(e)}><Sparkles size={16}/>تقييم البطاقة مع بذرة</button>
      {published&&<details className="br-unpublish"><summary>خيارات النشر</summary><button type="button" disabled={busy} onClick={()=>onAction(e,'withdraw')}>سحب التحدي من النشر وتصفير التفاعل</button></details>}</>}
    </div>}
    {owner&&<ChallengeCompletion entry={e} finalized={frozen} onEdit={onEdit} onSaved={onSaved}/>}
   </aside>
  </div>
 </article>;
}
