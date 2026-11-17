'use client';
import {Trophy,ArrowLeft} from 'lucide-react';
import {numberLabel,placeLabel,type PublishedResults} from '@/lib/published-results';
import {Congratulations,usePublicResults} from '../components/public-result-notice';
export default function ResultsView({initial}:{initial?:PublishedResults|null}){
 const pub=usePublicResults(initial);
 return <main id="bz-main" tabIndex={-1} className="bp-page"><a className="bp-back" href="/">الرئيسية <ArrowLeft size={15} aria-hidden="true"/></a>
  <header className="bp-hero"><span className="bp-kicker"><Trophy size={18} aria-hidden="true"/> هاكاثون الابتكار الرقمي · الجهة المنظمة</span>
  <h1>نتائج الهاكاثون</h1>{pub?<><p><Congratulations publication={pub}/></p><small>شكرًا لجميع الفرق على ما قدّمته من حلول، وللمحكّمين والحضور على مشاركتهم.</small></>:<p role="status">{initial===undefined?'جارٍ تحميل التعميم…':'ستظهر النتائج هنا عند تعميمها من إدارة الهاكاثون.'}</p>}</header>
  {pub&&<section className="bp-rank" aria-labelledby="bp-rank-title"><h2 id="bp-rank-title">الترتيب النهائي</h2><p>الدرجة من {numberLabel(100)}: حتى {numberLabel(70)} نقطة من اللجنة و{numberLabel(30)} من الجمهور.</p>
   <ol>{pub.standings.map(team=><li key={team.id} className={team.place===1?'bp-champion':''}><span className="bp-place">{team.place===1&&<Trophy size={16} aria-hidden="true"/>}{placeLabel(team.place)}</span>
    <div><small>فريق التحدي {numberLabel(team.teamNumber)}</small><h3><a href={'/challenge/'+encodeURIComponent(team.id)}>{team.title}</a></h3></div>
    <span className="bp-points"><bdi>{numberLabel(team.score)}</bdi><small>من {numberLabel(100)}</small></span></li>)}</ol></section>}
 </main>;
}
