'use client';
import type {PublishedResults} from '@/lib/published-results';
import TeamNotice,{useAnnouncedTeams} from './team-notice';
import {useEffect,useState,type MouseEvent} from 'react';
import {ArrowLeft,ArrowUpLeft} from 'lucide-react';
import {type AnnouncedChallenge,type Entry} from '@/lib/challenges';
import {useIntake} from './intake-state';
import {engagementFocus,intakeWindow,participationLinks} from '@/lib/hackathon-intake';
import {daysRemaining,eventCalendar,eventProgram,riyadhEventDay,homeFaqs,eventPrize,programSpan,programSpokenDates,deadlineLabel,participationDeadlineLabel} from '@/lib/hackathon-event';
import HomeChallenges from './home-challenges';
import HomeRoleGuide from './home-role-guide';
import FaqInquiry from './faq-inquiry';
import type {SetParticipation} from './home-participation';
import EventDate from './event-date';
import HomeJourney from './home-journey';
import {EventProgram,EventEvaluation} from './hackathon-event-info';
import {useHomeMotion} from './use-home-motion';
type Props={teamMember?:boolean;judge?:boolean;manager?:boolean;publication?:PublishedResults|null;announced?:AnnouncedChallenge[];onStart:()=>void;entries:Entry[];initialDay?:string;loading:boolean;failed:boolean;signedIn:boolean;votingOpen:boolean;joiningOpen:boolean;busy:boolean;onAction:SetParticipation};
function scrollToBlock(id:string){const section=document.getElementById(id);if(!section)return;section.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}
export default function HackathonHome({teamMember=false,judge=false,manager=false,announced,publication,onStart,entries,initialDay,loading,failed,signedIn,votingOpen,joiningOpen,busy,onAction}:Props){
 const finalists=useAnnouncedTeams(announced),announcedPhase=finalists.length>0;
 const [today,setToday]=useState(()=>initialDay||riyadhEventDay()),[program,setProgram]=useState(()=>({day:today>=eventProgram[1].dateTime?1:0,switched:false}));
 const [feedChoice,setFeedChoice]=useState<number|null>(null);
 const sharedIntake=useIntake(),w=sharedIntake??intakeWindow({open:votingOpen,joining_open:joiningOpen},Date.parse(today+'T12:00:00+03:00')),taking=w.phase==='open',focus=engagementFocus(w);
 const motion=useHomeMotion(announcedPhase),calendar=eventCalendar(sharedIntake?riyadhEventDay(new Date(w.serverNow)):today);
 useEffect(()=>{const sync=()=>setToday(riyadhEventDay());sync();const id=setInterval(sync,60000);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);return()=>{clearInterval(id);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync)}},[]);
 function selectDay(index:number){setProgram(value=>value.day===index?value:{day:index,switched:true})}
 function goDay(index:number){selectDay(index);requestAnimationFrame(()=>scrollToBlock('home-program'))}
 function goChallenges(e:MouseEvent<HTMLAnchorElement>,to='challenges'){if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();setFeedChoice(null);requestAnimationFrame(()=>scrollToBlock(to))}
 const votingPaused=!loading&&!failed&&!votingOpen,focused=!taking&&focus!=='browse';
 const status=!votingOpen&&!joiningOpen?'التصويت والانضمام مغلقان، والمشاركات السابقة محفوظة':taking&&w.manualOpen?'استقبال التحديات مفتوح الآن':taking?(votingPaused?'طرح التحديات متاح حتى '+deadlineLabel+'، ويستمر الانضمام حتى '+participationDeadlineLabel+' · التصويت موقوف':calendar.status)
  :focus==='vote-join'?'انتهى طرح التحديات، ويستمر التصويت والانضمام حتى '+participationDeadlineLabel
  :focus==='vote'?'التصويت متاح الآن · الانضمام مغلق':focus==='join'?'انتهى طرح التحديات، ويستمر الانضمام حتى '+participationDeadlineLabel+' · التصويت موقوف'
  :w.finalized?'اعتُمدت قائمة الهاكاثون وأُغلق استقبال التحديات الجديدة.':calendar.status;
 const badge=taking&&w.manualOpen?'متاح للمشاركة':focused?daysRemaining(Math.max(0,Math.ceil((w.engagementEndsAt-w.serverNow)/86400000)-1)):w.finalized?'القائمة معتمدة':calendar.badge;
 const invite=status+' · '+badge;
 const challenges=<HomeChallenges entries={entries} signedIn={signedIn} onGrid={e=>goChallenges(e,'home-challenge-grid')} loading={loading} failed={failed} votingOpen={votingOpen} joiningOpen={joiningOpen} busy={busy} onAction={onAction} choice={feedChoice} choose={setFeedChoice} start={onStart} accepting={taking} focus={focus} attrs={motion.block('challenges')}/>;
 const closedTitle=(focus==='vote-join'||focus==='vote')?'أيّ تحدٍّ يستحق الأولوية؟':focus==='join'?'أيّ تحدٍّ تحب أن تعمل على حلّه؟':w.phase==='before'?'تعرّف على الهاكاثون':'اكتشف تحديات الهاكاثون';
 const closedIntro=focus==='vote'?'صوّت للتحديات التي ترى أن حلّها سيُحدث فرقًا في المؤسسة. الانضمام مغلق حاليًا.':focus==='vote-join'?'صوّت للتحديات التي ترى أن حلّها سيُحدث فرقًا في المؤسسة، وسجّل رغبتك في الانضمام إلى الفريق الذي تودّ العمل معه. يمكنك الجمع بينهما.':focus==='join'?'تصفّح تحديات زملائك وسجّل رغبتك في الفريق الذي يناسب مهاراتك. التصويت موقوف حاليًا.':'استعرض بطاقات التحديات، وتعرّف على المشكلة وأثرها والحلول الأولية التي شاركها أصحابها.';
 function faqAnswer(f:(typeof homeFaqs)[number]){
  if(announcedPhase||w.finalized){
   if(f===homeFaqs[0])return 'المشاركة لمنسوبي الجهة المنظمة. انتهى طرح التحديات والتصويت لترشيحها وتسجيل رغبات الانضمام. أما تصويت الختام فعلى الحلول المعروضة، ويُتاح لمن سجّل المنظّم حضوره عند فتح التصويت.';
   if(f===homeFaqs[1])return 'أسهم التصويت في ترشيح التحديات، وساعدت رغبات الانضمام المنظّمين على توزيع الأعضاء. انتهت هذه المرحلة وتبقى المشاركات السابقة محفوظة.';
   if(f===homeFaqs[6])return 'نعم. يعمل أعضاء الفريق معًا على التحدي المعتمد، ويجد كل عضو مساحة الفريق بعد إسناده إليها من المنظّمين.';
   if(f===homeFaqs[8])return 'راجع المنظّمون ترتيب الأصوات، ثم حدّد مدير الهاكاثون التحديات وأعلنها. تجد الأسماء المعتمدة في أول هذه الصفحة.';
   if(f===homeFaqs[2])return 'تسجيل الرغبة لا يثبت العضوية. عندما يُسندك المنظّمون إلى فريق، يظهر تحدّيه لك في «تحديات الفريق».';
  }
  if(!taking&&f===homeFaqs[0])return focused?'جميع منسوبي الجهة المنظمة. انتهت مرحلة طرح التحديات؛ '+(focus==='vote'?'يمكنك الآن التصويت لتحديات زملائك. الانضمام مغلق.':focus==='join'?'يمكنك الآن تسجيل رغبتك في الانضمام إلى فريق تحدٍّ.':'يمكنك الآن التصويت لتحديات زملائك وتسجيل رغبتك في الانضمام إلى فرقها.'):'المشاركة لمنسوبي الجهة المنظمة. استعرض بطاقات التحديات لمعرفة إجراءات المشاركة المتاحة حاليًا.';
  return f.answer;
 }
 const engageActions=(hero=false)=><>{(focus==='vote-join'||focus==='vote')&&<a data-badra-anchor={hero?'focus-vote':undefined} className={'bh-button '+(hero?'bh-orange':'')} href={participationLinks.vote}>استعرض التحديات وصوّت <ArrowLeft size={17} aria-hidden="true"/></a>}
   {joiningOpen&&focus!=='browse'?<a data-badra-anchor={hero?'focus-join':undefined} className={'bh-button '+(hero?(focus==='join'?'bh-orange':'bh-outline'):'bh-invite-browse')} href={participationLinks.join}>اختر تحديًا للانضمام <ArrowLeft size={17} aria-hidden="true"/></a>:<a data-badra-anchor={hero?'browse-challenges':undefined} className="bh-button bh-orange" href="/challenges">استعرض التحديات <ArrowLeft size={17} aria-hidden="true"/></a>}</>;
 return <div className="bh-home" ref={motion.root} data-home-motion={motion.mode} dir="rtl">
  {announcedPhase?<TeamNotice items={finalists} initialPublication={publication} entries={entries} judge={judge} manager={manager} teamMember={teamMember} onExplore={()=>scrollToBlock('finalist-challenges')} onProgram={()=>goDay(today>=eventProgram[1].dateTime?1:0)}/>:<><div className="bh-status"><div className="bh-wrap"><span className="bh-status-dot" aria-hidden="true"/><span>{status}</span><b>{badge}</b></div></div>
  <section className="bh-hero" aria-labelledby="bh-hero-title"><div className="bh-wrap bh-hero-grid">
   <div className="bh-art"><h1 className="sr-only" id="bh-hero-title">هاكاثون الابتكار الرقمي — من التحدي إلى الحل</h1><span className="bh-art-water-shadow" aria-hidden="true"/><div className="bh-art-drift"><div className="bh-art-float"><div className="bh-art-rock"><img src="/placeholder.svg" width={1010} height={500} alt={'هاكاثون الابتكار الرقمي، من التحدي إلى الحل، '+programSpokenDates} fetchPriority="high"/></div></div></div></div>
   <div className="bh-hero-copy"><span className="bh-eyebrow bh-hero-enter" style={{animationDelay:'.25s'}}>مبادرة لمنسوبي الجهة المنظمة</span>
    <p className="bh-hero-enter" style={{animationDelay:'.4s'}}>{taking?<><strong>عندك تحدٍّ من واقع عملك؟ اطرحه هنا.</strong><br/>وحتى لو لم تطرح تحدّيًا، استكشف تحديات زملائك والأفكار المطروحة.</>:<><strong>{closedTitle}</strong><br/>{closedIntro}</>}</p>
    <div className="bh-actions bh-hero-enter" style={{animationDelay:'.55s'}}>{taking?<><button className="bh-button bh-orange" data-badra-anchor="participate" type="button" onClick={onStart}>اطرح تحدّيك <ArrowUpLeft size={17} aria-hidden="true"/></button><a className="bh-button bh-outline" data-badra-anchor="browse-challenges" href="#challenges" onClick={goChallenges}>استكشف تحديات زملائك <ArrowLeft size={17} aria-hidden="true"/></a></>:engageActions(true)}</div>
    <dl className="bh-hero-stats bh-hero-enter" style={{animationDelay:'.7s'}}><div><dt>يومان</dt><dd><EventDate label={programSpan} compact/></dd></div><div><dt><bdi>{eventPrize.toLocaleString('en-US')}</bdi></dt><dd>ريال إجمالي الجوائز</dd></div></dl>
   </div>
  </div></section></>}
  {!announcedPhase&&focused&&challenges}
  {!announcedPhase&&<HomeRoleGuide attrs={motion.block('roles')}/>}
  <div className="bh-dark"><div className="bh-wrap bh-journey-wrap"><HomeJourney calendar={calendar} onDay={goDay} attrs={motion.block('journey')}/><EventProgram day={program.day} switched={program.switched} selectDay={selectDay} attrs={motion.block('program')}/></div></div>
  <EventEvaluation announced={announcedPhase} attrs={motion.block('evaluation')} skip={motion.mode==='final'}/>
  {announcedPhase?<HomeRoleGuide attrs={motion.block('roles')} teamPhase/>:!focused&&challenges}
  <section className="bh-faq bh-reveal" id="home-faq" aria-labelledby="bh-faq-title" {...motion.block('faq')}><div className="bh-wrap bh-faq-layout">
   <div className="bh-faq-intro"><span className="bh-eyebrow">{announcedPhase?'دليل المشاركة':'قبل أن تبدأ'}</span><h2 id="bh-faq-title">الأسئلة الشائعة</h2><a className="bh-link" href="/" target="_blank" rel="noopener noreferrer">لديك سؤال آخر؟ تواصل مع الفريق <ArrowLeft size={16}/></a></div>
   <div className="bh-faq-grid">{homeFaqs.map(f=><details key={f.question}><summary>{f.question}<span aria-hidden="true"/></summary><p>{faqAnswer(f)}</p></details>)}<FaqInquiry/></div>
  </div></section>
  {!announcedPhase&&<section className="bh-wrap bh-invite-wrap bh-reveal" aria-labelledby="bh-invite-title" {...motion.block('invite')}><div className="bh-invite"><div className="bh-invite-copy"><span>مشاركتك في الهاكاثون</span><h2 id="bh-invite-title">{taking?'كيف تحب أن تشارك؟':focus==='browse'?'استعرض تحديات زملائك':'اختر التحدي الذي يهمّك'}</h2><p>{invite}</p></div>
   <div className="bh-invite-actions">{taking?<><button type="button" className="bh-button" onClick={onStart}>اطرح تحدّيك <ArrowUpLeft size={17} aria-hidden="true"/></button><a href="#home-challenge-grid" onClick={e=>goChallenges(e,'home-challenge-grid')} className="bh-button bh-invite-browse">اختر تحديًا تودّ العمل عليه <ArrowLeft size={17} aria-hidden="true"/></a></>:engageActions()}</div>
  </div></section>}
 </div>;
}
