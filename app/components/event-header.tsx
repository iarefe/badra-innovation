'use client';
import {LogIn,ShieldCheck} from 'lucide-react';
import EventLogo,{EventWordmark} from './event-logo';
import {isCollectionRoute} from '@/lib/routes';

type Props={route:string;manager?:boolean;employee?:boolean;studioHeader?:boolean;showTeams?:boolean;judge?:boolean};
export default function EventHeader({route,manager=false,employee=false,studioHeader=false,showTeams=false,judge=false}:Props){
 const home=route==='home',library=isCollectionRoute(route)||route.startsWith('challenge/')||studioHeader;
 const accountHref=employee||home?'/account':route==='teams'?'/login?next=%2Fteams':'/login';
 const links=[{href:'/',text:'الرئيسية',on:home},{href:'/challenges',text:'التحديات',on:library},
  ...(showTeams||route==='teams'?[{href:'/teams',text:judge?'بطاقات التحكيم':'تحديات الفريق',on:route==='teams'}]:[]),
  ...(manager?[{href:'/admin',text:'الإدارة',on:route==='admin'}]:[])];
 return <>{!studioHeader&&<a className="event-skip" href="#bz-main" onClick={e=>{const main=document.getElementById('bz-main');if(main){e.preventDefault();main.focus({preventScroll:true});main.scrollIntoView({block:'start',behavior:'instant'})}}}>انتقل إلى المحتوى الرئيسي</a>}<header role="banner" className={'site-header event-header cd-header'+(home?' bh-header':'')}><div className="header-inner">
  <a href="/" className="brand" aria-label="هاكاثون الابتكار الرقمي — الرئيسية"><img className="organization-logo" src="/placeholder.svg" width={223} height={76} alt="الجهة المنظمة"/>{home?<EventLogo placement="masthead"/>:<EventWordmark/>}</a>
  <nav aria-label={studioHeader?'القائمة الرئيسية':'التنقل الرئيسي'}>{links.map(link=><a key={link.href} href={link.href} className={link.on?'active':''} aria-current={link.on?((route.startsWith('challenge/')||studioHeader||route==='mine')?'location':'page'):undefined}>{link.text}</a>)}</nav>
  <a className="button dark small" href={accountHref} aria-current={accountHref.split('?')[0]==='/'+route?'page':undefined}>{home||route==='admin'&&manager?'حسابي':employee?<><ShieldCheck size={16} aria-hidden="true"/>حسابي</>:<><LogIn size={16} aria-hidden="true"/>دخول الموظفين</>}</a>
 </div></header></>
}
