'use client';
import {useEffect,useState,type CSSProperties,type MouseEvent} from 'react';
import {ArrowLeft,CalendarDays,ClipboardCheck,LayoutDashboard,UsersRound,Compass} from 'lucide-react';
import {type AnnouncedChallenge,type Entry} from '@/lib/challenges';
import type {PublishedResults} from '@/lib/published-results';
import {placeLabel} from '@/lib/published-results';
import {HomeWinner,usePublicResults} from './public-result-notice';
import {CoverImage} from './challenge-cover';
import {initialCover} from '@/lib/challenge-cover';


export function useAnnouncedTeams(seed?:AnnouncedChallenge[]){
 const [observed,setObserved]=useState<AnnouncedChallenge[]>([]);
 const result=seed?.length?seed:observed;
 useEffect(()=>{
  if(result.length)return;
  let live=true;
  async function read(){if(document.hidden)return;try{
   const r=await fetch('/api/teams?notice=1',{cache:'no-store'});if(!r.ok)return;
   const {announced}=await r.json() as {announced:AnnouncedChallenge[]};
   if(live&&Array.isArray(announced)&&announced.length)setObserved(announced);
  }catch{/* Keep the last confirmed public state. */}}
  if(seed===undefined)void read();
  const timer=window.setInterval(read,60000);window.addEventListener('focus',read);
  return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',read)};
 },[result.length,seed===undefined]);
 return result;
}

type NoticeProps={
 items:AnnouncedChallenge[];initialPublication?:PublishedResults|null;entries:Entry[];judge?:boolean;manager?:boolean;teamMember?:boolean;
 onExplore:()=>void;onProgram:()=>void;
};
function jump(e:MouseEvent<HTMLAnchorElement>,go:()=>void){
 if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 e.preventDefault();go();
}
export default function TeamNotice({items,initialPublication,entries,judge=false,manager=false,teamMember=false,onExplore,onProgram}:NoticeProps){
 const publication=usePublicResults(initialPublication);
 const places=new Map(publication?.standings.map(t=>[t.id,t.place]));
 const gallery=publication?[...items].sort((a,b)=>(places.get(a.id)??Infinity)-(places.get(b.id)??Infinity)):items;
 const four=items.length===4;
 const details=new Map(entries.filter(e=>e.status==='published'&&!e.example).map(e=>[e.id,e]));
 const action=manager?{href:publication?'/admin?tab=results':'/admin',label:publication?'نتائج التحكيم':'تابع جاهزية الفرق',Icon:LayoutDashboard}
  :judge?{href:'/teams',label:'افتح بطاقات التقييم',Icon:ClipboardCheck}
  :teamMember?{href:'/teams',label:'افتح مساحة فريقك',Icon:UsersRound}
  :{href:'#finalist-challenges',label:four?'استكشف التحديات الأربعة':'استكشف التحديات المتأهلة',Icon:Compass};
 const hasExamples=items.some(t=>t.title.includes('مواقف'))&&items.some(t=>t.title.includes('أثر المشاريع'));
 return <section className="bh-results" aria-labelledby="bh-results-title" id="home-finalists">
  <div className="bh-wrap">
   <header className="bh-results-message">
    <span className="bh-results-label">هاكاثون الابتكار الرقمي <i aria-hidden="true"/> الجهة المنظمة</span>
    {publication?<HomeWinner publication={publication}/>:<><h1 id="bh-results-title">{four?'أربع فرق تبني حلولًا':'حلول رقمية لتحديات'} <em>من واقع عملنا.</em></h1>
    <p>{hasExamples?'من إيجاد موقف قبل بدء الدوام إلى معرفة أثر المشروع بعد انتهائه، ':''}تعمل الفرق على تحويل {four?'أربعة تحديات':'التحديات المتأهلة'} من واقع المؤسسة إلى نماذج رقمية قابلة للتجربة.</p>
    </>}
    <div className="bh-results-actions">
     <a data-badra-anchor="finalist-workspace" href={action.href} className={publication?"bh-link":"bh-button bh-primary"} onClick={action.href.startsWith('#')?e=>jump(e,onExplore):undefined}><action.Icon size={18} aria-hidden="true"/>{action.label}<ArrowLeft size={16} aria-hidden="true"/></a>
     <a href="#home-program" onClick={e=>jump(e,onProgram)} className="bh-link"><CalendarDays size={17} aria-hidden="true"/>{publication?'برنامج الهاكاثون':'برنامج اليوم'}</a>
    </div>
   </header>
   <div id="finalist-challenges" tabIndex={-1} role="region" aria-labelledby="finalist-challenges-label" className="bh-finalist-gallery">
    <h2 id="finalist-challenges-label">{publication?'الفرق المشاركة بحسب ترتيبها النهائي':'التحديات المتأهلة'}</h2>
    <ul className="bh-results-grid">{gallery.map((t,i)=>{
     const entry=details.get(t.id);
     return <li key={t.id} style={{'--arrival':Math.min(i,5)*80+'ms'} as CSSProperties}>
      <a href={'/challenge/'+encodeURIComponent(t.id)} className="bh-result-card" aria-labelledby={'bh-finalist-'+t.id}>
       <span className="bh-finalist-cover" aria-hidden="true">{entry?<CoverImage entry={entry} priority={i===0}/>:<img src={initialCover(t.id,{title:t.title,domain:'مجال آخر',situation:''}).url} alt="" width={1440} height={810}/>}</span>
       <div className="bh-finalist-caption"><div className="bh-finalist-meta"><span className="bh-result-category">{places.has(t.id)?placeLabel(places.get(t.id)!):entry?.challenge.domain||'تحدٍّ متأهل'}</span><ArrowLeft className="bh-finalist-arrow" size={16} aria-hidden="true"/></div>
        <h3 id={'bh-finalist-'+t.id}>{t.title}</h3>
       </div>
      </a></li>;
    })}</ul>
   </div>
  </div>
 </section>;
}
