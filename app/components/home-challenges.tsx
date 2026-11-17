'use client';
import {type CSSProperties,type MouseEventHandler} from 'react';
import {ArrowLeft,Plus} from 'lucide-react';
import {exampleChallenges,type Entry} from '@/lib/challenges';
import {ProfileAvatar} from './profile-avatar';
import {CoverImage} from './challenge-cover';
import HomeTabs from './home-tabs';
import {HomeCardActions,MyParticipation,ParticipationToast,useHomeParticipation,type SetParticipation} from './home-participation';

type Props={accepting?:boolean;focus?:'vote-join'|'vote'|'join'|'browse';entries:Entry[];signedIn:boolean;votingOpen:boolean;joiningOpen:boolean;busy:boolean;onAction:SetParticipation;loading:boolean;failed:boolean;start:()=>void;choice:number|null;choose:(index:number)=>void;onGrid:MouseEventHandler<HTMLAnchorElement>;attrs:{'data-home-block':string;'data-entered':boolean}};
export default function HomeChallenges({accepting=true,focus='vote-join',entries,signedIn,votingOpen,joiningOpen,busy,onAction,loading,failed,start,choice,choose,onGrid,attrs}:Props){
 const real=entries.filter(e=>e.status==='published'&&!e.example),selected=choice??(!loading&&!failed&&!real.length?1:0);
 const rows=selected===1?exampleChallenges:real.sort((a,b)=>(b.publishedAt??b.createdAt)-(a.publishedAt??a.createdAt)||a.id.localeCompare(b.id));
 const {toggle,undo,receipt}=useHomeParticipation(real,onAction);
 const ids=['bh-tab-real','bh-tab-examples'];
 return <section className="bh-wrap bh-area bh-challenges bh-reveal" id="challenges" tabIndex={-1} aria-labelledby="bh-challenges-title" {...attrs}>
  <div className="bh-section-head"><div><span className="bh-eyebrow">من واقع عملك</span><h2 id="bh-challenges-title">التحديات</h2>
   <p>{!votingOpen&&!joiningOpen?'تصفّح بطاقات التحديات التي طرحها زملاؤك.':!joiningOpen?'صوّت للتحدي الذي تراه أولوية. الانضمام مغلق حاليًا.':!votingOpen?'سجّل رغبتك في التحدي الذي تودّ العمل على حلّه.':'صوّت للتحدي الذي تراه أولوية، وسجّل رغبتك في التحدي الذي تودّ العمل على حلّه. ويمكنك الجمع بينهما.'}</p></div>
   <a className="bh-link" href="/challenges">كل التحديات <ArrowLeft size={16} aria-hidden="true"/></a>
  </div>
  {signedIn&&!loading&&!failed&&<MyParticipation votingOpen={votingOpen} joiningOpen={joiningOpen} real={real} onGrid={onGrid}/>}
  <div className="bh-feed-toolbar"><HomeTabs name="نوع التحديات" group="bh-feed-tabs" panelId="bh-challenge-panel" selected={selected} choose={choose} options={['تحديات مطروحة','أمثلة للاستلهام'].map((label,i)=>({id:ids[i],label:<>{label}<span className="bh-count">{i===0?(loading||failed?'—':real.length):exampleChallenges.length}</span></>}))}/>
   {selected===0&&<small className="bh-newest">الأحدث أولًا</small>}
  </div>
  <div id="bh-challenge-panel" role="tabpanel" aria-labelledby={ids[selected]} aria-busy={loading}>
   <div id="home-challenge-grid" tabIndex={-1} aria-label={selected===0?'شبكة التحديات المطروحة':'شبكة أمثلة الاستلهام'}>
    {loading?<p className="bh-empty" role="status">نحمّل التحديات…</p>:failed?<p className="bh-empty" role="alert">تعذّر تحميل التحديات. أعد المحاولة من التنبيه أعلى الصفحة.</p>:<>
     {!real.length?<p className="bh-empty">{accepting?'لم يُطرح تحدٍّ بعد. يمكنك طرح أول تحدٍّ أو تصفّح الأمثلة للاستلهام. يُتاح التصويت وتسجيل الرغبات عند نشر تحديات زملائك.':'لا توجد تحديات منشورة. الأمثلة أدناه للقراءة فقط.'}</p>:selected===1&&<p className="bh-example-notice">هذه أمثلة للاستلهام فقط. للتصويت أو تسجيل رغبتك بالانضمام، اختر «تحديات مطروحة».</p>}
     <div className="bh-feed-grid" key={selected}>{rows.map((entry,i)=>{const c=entry.challenge,url='/challenge/'+entry.id;return <article className="bh-challenge-card bh-card-in" key={entry.id} style={{'--delay':i*.12+'s'} as CSSProperties}>
      <a className="bh-thumbnail" href={url} aria-label={(entry.example?'استعرض المثال: ':'عرض تحدي ')+c.title}><CoverImage entry={entry}/>
       {(entry.example||entry.mine)&&<span className="bh-cover-tag" data-kind={entry.example?'example':'own'}>{entry.example?'مثال للاستلهام':'تحدّيك'}</span>}
      </a>
      <div className="bh-card-body"><div className="bh-tags"><span>{c.scope}</span><span>{c.domain}</span></div>
       <h3><a data-badra-anchor={entry.example?'latest-example':'latest-challenge'} href={url}>{c.title}</a></h3><p className="bh-excerpt">{c.situation}</p>
       <div className="bh-owner-row">{!entry.example&&<span className="bh-author"><ProfileAvatar name={c.author} url={entry.authorAvatar} size="small" singleInitial/><b>{c.author}{c.ownership==='shared'?' وفريقه':''}</b></span>}
        <a className="bh-link" href={url}>{entry.example?'استعرض المثال':'التفاصيل'} <ArrowLeft size={15} aria-hidden="true"/></a></div>
      </div>
      {!entry.example&&<div className="bh-card-foot">{entry.mine?<div className="bh-owner-actions"><a href={url}>استعرض البطاقة</a><a href={url+'?edit=1'}>تعديل</a></div>:<HomeCardActions entry={entry} busy={busy} votingOpen={votingOpen} joiningOpen={joiningOpen} toggle={toggle}/>}</div>}
     </article>})}</div>
    </>}
   </div>
  </div>
  {accepting&&<div className="bh-add-strip"><div><span className="bh-plus" aria-hidden="true"><Plus size={23}/></span><div><h3>أضف تحديك</h3><p>ما الذي يتكرر في عملك وتتمنى تغييره؟ ابدأ بوصفه مع بذرة.</p></div></div><button type="button" className="bh-button bh-orange" onClick={start}>اطرح تحدّيك</button></div>}
  <ParticipationToast receipt={receipt} undo={undo} disabled={busy||(receipt?.kind==='vote'?!votingOpen:!joiningOpen)}/>
 </section>;
}
