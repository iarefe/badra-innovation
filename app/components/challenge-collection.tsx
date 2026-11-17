'use client';
import {useEffect,useState,type MouseEvent} from 'react';
import {ArrowUpLeft,Plus,PenLine,Check,Lock,ArrowLeft,UserPlus,ThumbsUp} from 'lucide-react';
import {useIntake} from './intake-state';
import {closedIntakeText,engagementFocus} from '@/lib/hackathon-intake';
import {StatusBadge} from './participation-badges';
import {CollectionTabs} from './challenge-library-tabs';
import {myChallengesLoginPath} from '@/lib/routes';
import {ChallengeAuthor} from './profile-avatar';
import {CoverImage} from './challenge-cover';
import ChallengeCompletion from './challenge-completion';
import MotionAction from './motion-action';
import {MyParticipation} from './home-participation';
import {challengeFeed,voteLabel,type Challenge,type Entry} from '@/lib/challenges';
type Props={announced?:{id:string}[];mine:boolean;manager:boolean;entries:Entry[];signedIn:boolean;loading:boolean;failed:boolean;votingOpen:boolean;joiningOpen:boolean;onStart:()=>void;onEdit:(entry:Entry)=>void;onCompleted:(id:string,challenge:Challenge)=>void;finalized:boolean;busy:boolean;onAction:(entry:Entry,action:'vote'|'interest')=>void};
const states={draft:{label:'مسودة',hint:'لم تُنشر بعد. أكملها عندما تكون مستعدًا.'},pending:{label:'لم يُنشر بعد',hint:'أكمل البطاقة وانشرها لتظهر للجميع.'},returned:{label:'يحتاج استكمالًا',hint:'أكمل التحدي وانشره مباشرة.'},published:{label:'منشور',hint:'تحدّيك ظاهر في صفحة التحديات.'}};
export default function ChallengeCollection({announced=[],mine,manager,entries,signedIn,loading,failed,votingOpen,joiningOpen,onStart,onEdit,onCompleted,finalized,busy,onAction}:Props){
 const intake=useIntake(),taking=!intake||intake.phase==='open',focus=intake?engagementFocus(intake):'vote-join';
 const [intent,setIntent]=useState<'vote'|'join'|null>(null);
 useEffect(()=>{const read=()=>{const value=new URLSearchParams(location.search).get('participate');setIntent(value==='vote'||value==='join'?value:null)};read();window.addEventListener('popstate',read);window.addEventListener('badra:navigation',read);return()=>{window.removeEventListener('popstate',read);window.removeEventListener('badra:navigation',read)}},[mine]);
 const winners=new Set(announced.map(x=>x.id)),afterAnnouncement=winners.size>0;
 const intentText=intent==='join'&&joiningOpen&&focus!=='browse'?'افتح التحدي الذي تودّ العمل على حلّه، ثم اختر «أرغب بالانضمام». ستصل رغبتك وأدوارك إلى المنظّمين.':intent==='vote'&&votingOpen&&focus!=='browse'?'اقرأ التحديات واختر ما تراه أولوية. صوّت من زر التصويت في البطاقة، ويمكنك التصويت لأكثر من تحدٍّ.':null;
 const cards=mine?entries.filter(e=>!e.example&&e.mine).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)):challengeFeed(entries);
 const publishedCount=cards.filter(e=>!e.example).length;
 const examplesOnly=!mine&&!loading&&!failed&&!publishedCount;
 function goToChallenges(event:MouseEvent<HTMLAnchorElement>){
  if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const grid=document.getElementById('challenge-collection-grid');
  grid?.focus({preventScroll:true});grid?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 return <section className={'wrap collection-page '+(mine?'my-collection':'public-collection')}>
  <div className="collection-heading" data-reveal><div><span className="eyebrow">{mine?'من ملاحظتك يبدأ التغيير':examplesOnly?'من العمل التشغيلي إلى الابتكار':'تحديات زملائك، وأولوياتك'}</span><h1>التحديات</h1><p>{mine?'كل ما طرحته، وحالته، والخطوة التالية.':afterAnnouncement?'تعرّف على التحديات المطروحة. تحمل التحديات المختارة للورشة شارة «معتمد للهاكاثون».':examplesOnly?(taking?'ابدأ بهذه الأمثلة من عمل المؤسسة المانحة، ثم صف تحديًا من واقعك.':'تعرّف على أمثلة من عمل المؤسسة المانحة.'):!taking?'تصفّح بطاقات زملائك، وتعرّف على المشكلة وأثرها قبل اختيار التحدّي الذي يهمّك.':'تصفّح تحديات زملائك وأمثلة الاستلهام. صوّت لتحديات الآخرين وسجّل رغبتك بالانضمام إلى ما تحب العمل عليه.'}</p></div>{taking&&<button data-badra-anchor="participate" className="button orange" onClick={onStart}><Plus size={18}/> أضف تحديًا</button>}</div>
  {!afterAnnouncement&&!mine&&(intentText||!taking&&intake)&&<p className="intake-state-note" role="status">{intentText||closedIntakeText(intake!)}</p>}
  <CollectionTabs mine={mine}/>{!afterAnnouncement&&<a className="text-link" href="/teams">تحديات الفريق ←</a>}
  <div role="tabpanel" hidden id={'collection-panel-'+(mine?'all':'mine')} aria-labelledby={'collection-tab-'+(mine?'all':'mine')}/>
  <div role="tabpanel" id={'collection-panel-'+(mine?'mine':'all')} aria-labelledby={'collection-tab-'+(mine?'mine':'all')} tabIndex={0} className="collection-tab-panel">
  {!afterAnnouncement&&!mine&&signedIn&&!loading&&!failed&&<MyParticipation votingOpen={votingOpen} joiningOpen={joiningOpen} real={entries.filter(e=>e.status==='published'&&!e.example)} onGrid={goToChallenges} gridId="challenge-collection-grid"/>}
  {loading?<div className="collection-empty" role="status">نحمّل التحديات…</div>:failed?<div className="collection-empty"><h2>تعذّر تحميل التحديات</h2><p>أعد المحاولة من التنبيه أعلى الصفحة.</p></div>:mine&&!signedIn?<div className="collection-empty"><Lock size={28}/><h2>تحدياتك محفوظة في حسابك.</h2><p>سجّل دخولك لمتابعة مسوداتك ومشاركاتك.</p><a href={myChallengesLoginPath} className="button dark">تسجيل الدخول <ArrowLeft size={17}/></a></div>:cards.length?<>
   <div className="collection-context"><span>{mine?<>تحدياتك · {publishedCount.toLocaleString('ar-SA')}</>:examplesOnly?'أمثلة افتراضية للاستلهام':<>التحديات المنشورة · {publishedCount.toLocaleString('ar-SA')} <span>ومعها أمثلة للاستلهام</span></>}</span>{!afterAnnouncement&&!mine&&<span>{!votingOpen&&!examplesOnly?'التصويت مغلق حاليًا. ':''}{!joiningOpen&&!examplesOnly?'الانضمام مغلق حاليًا. ':''}الأمثلة لا تقبل التصويت أو الانضمام.</span>}</div>
   <div className="collection-grid" data-intake-intent={!mine&&intentText?intent:undefined} id={mine?undefined:'challenge-collection-grid'} tabIndex={mine?undefined:-1} aria-label={mine?undefined:'شبكة التحديات'}>{cards.map(e=>{const state=states[e.status],editable=mine&&e.status!=='published';return <article data-reveal className={'collection-card '+(mine?e.status:e.example?'is-example':'')} key={e.id}>
    <a data-badra-anchor={e.example?"example-open":"challenge-open"} className="collection-cover" href={'/challenge/'+e.id} aria-label={(e.example?'استعرض المثال: ':'عرض تحدي ')+e.challenge.title}><CoverImage entry={e}/><span className="cover-domain">{e.challenge.domain}</span></a>
    <div className="collection-card-top">{winners.has(e.id)&&<StatusBadge state="challenge-published">معتمد للهاكاثون</StatusBadge>}{mine?<StatusBadge anchor="challenge-status" state={`challenge-${e.status}`}>{state.label}</StatusBadge>:<span className="collection-scope">{e.challenge.scope}</span>}{e.example&&<span className="example-label">مثال للاستلهام</span>}{!mine&&e.voted&&<span className="collection-voted"><Check size={14}/> صوّتّ له</span>}</div>
    <h2><a data-badra-anchor={e.example?"example-open":"challenge-open"} href={'/challenge/'+e.id}>{e.challenge.title}</a></h2><p className="collection-summary">{e.challenge.situation}</p>
    {!e.example&&<ChallengeAuthor entry={e}/>}
    {mine&&e.cover?.status==='pending'&&<p className="cover-card-status" role="status">يجري توليد غلاف التحدي…</p>}{mine&&(e.status==='returned'&&e.reviewNote?<div className="collection-note"><b>ملاحظة المراجعة</b><p>{e.reviewNote}</p></div>:<p className="collection-hint">{!taking&&e.status!=='published'?'مسودة خاصة. يمكنك تعديلها وحفظها دون نشر.':state.hint}</p>)}
    {mine&&<ChallengeCompletion entry={e} compact finalized={finalized} onEdit={onEdit} onSaved={onCompleted}/>}
    <div className="collection-card-actions">{editable?<><button className="text-link" onClick={()=>onEdit(e)}><PenLine size={16}/>{e.status==='draft'?'أكمل المسودة':'استكمل التحدي'}</button><a className="collection-secondary" href={'/challenge/'+e.id}>عرض البطاقة</a></>:<><a data-badra-anchor={e.example?"example-open":"challenge-open"} className="text-link" href={'/challenge/'+e.id}>{e.example?'استعرض المثال':'عرض التحدي'} <ArrowUpLeft size={18}/></a>{winners.has(e.id)&&<a className="collection-secondary" href={'/teams?team='+encodeURIComponent(e.id)}>مساحة الفريق ←</a>}</>}</div>
    {!e.example&&(e.mine||manager)&&(e.status!=='published'||!finalized)&&<div className="br-collection-tools"><a href={'/challenge/'+e.id+'?edit=1'}><PenLine size={15}/>تعديل التحدي</a><a href={'/challenge/'+e.id+'?review=1'}>قيّم مع بذرة</a></div>}
    {!afterAnnouncement&&!e.example&&e.status==='published'&&(e.mine?<div className="owner-participation-note"><p>هذا تحدّيك؛ التصويت والانضمام لتحديات الآخرين.</p>{manager&&<span>{(e.votes||0).toLocaleString('ar-SA')} صوتًا · {(e.interestCount||0).toLocaleString('ar-SA')} يرغبون بالانضمام</span>}</div>:<div className="collection-engagement"><MotionAction data-badra-anchor="library-vote" className={e.voted?'selected':''} selected={e.voted} count={manager?e.votes:undefined} disabled={busy||loading||!votingOpen} onClick={()=>onAction(e,'vote')}>{e.voted?<Check size={15}/>:<ThumbsUp size={15}/>} {votingOpen?voteLabel(e):'التصويت مغلق'}</MotionAction><MotionAction data-badra-anchor="library-join" className={e.interested?'interested':''} selected={!!e.interested} count={manager?e.interestCount:undefined} disabled={busy||loading||!joiningOpen} onClick={()=>onAction(e,'interest')}>{e.interested?<Check size={15}/>:<UserPlus size={15}/>} {!joiningOpen?'الانضمام مغلق':e.interested?'سجّلت رغبتي بالانضمام':'أرغب بالانضمام'}</MotionAction></div>)}
   </article>})}</div>
  </>:<div className="collection-empty"><PenLine size={30}/><h2>{mine?'لم تضف تحديًا بعد.':'بانتظار أول تحدٍ.'}</h2><p>{!taking?'تستطيع استعراض تحديات زملائك من المكتبة.':mine?'ابدأ بموقف من واقع عملك، وسنساعدك في صياغته.':'تظهر هنا التحديات فور تسليمها ونشرها.'}</p>{taking?<button data-badra-anchor="participate" className="button dark" onClick={onStart}>شارك بتحدٍ <ArrowUpLeft size={17}/></button>:<a className="button dark" href="/challenges">استعرض التحديات</a>}</div>}
  </div>
 </section>;
}
