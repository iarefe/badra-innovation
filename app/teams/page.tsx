import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {GET as teamsData} from '../api/teams/route';
import EventHeader from '../components/event-header';
import TeamDesk,{type DeskData} from './team-desk';
import {DeliverySummary} from './team-deliverables';
import './teams.css';

export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{team?:string|string[];view?:string|string[]}>}){
 const params=await searchParams,id=typeof params.team==='string'?params.team:'';
 let seed:DeskData|null=null;
 try{const response=await teamsData(new Request('https://site.internal/api/teams',{headers:await headers()}));if(response.ok)seed=await response.json() as DeskData;}catch{/* The desk offers a client-side retry if the read was interrupted. */}
 if(params.view==='preview'){
  if(!seed)return <main id="bz-main" tabIndex={-1} className="team-page"><div className="team-wrap"><h1>تعذّر تحميل المعاينة</h1><p>أعد تحميل الصفحة للمحاولة مرة أخرى.</p><a href="/teams">العودة إلى الفرق</a></div></main>;
  const team=seed.teams.find(t=>t.id===id);
  if(!team)notFound();
  // A direct preview has no editor/score data, even for a member who owns both versions of a presentation.
  const saved={id:team.id,solution:team.solution,instructions:team.instructions,slides_url:team.slides_url,files:team.files.filter(f=>f.kind==='solution'||!team.slides_url&&f.kind==='slides')};
  return <><EventHeader route="teams" manager={seed.manager} judge={seed.judge} employee={!!seed.me}/><main id="bz-main" tabIndex={-1} className="team-page"><div className="team-wrap td-preview-page">
   <nav className="td-breadcrumb" aria-label="مسار الصفحة"><a href={seed.manager?'/admin':'/teams'}>{seed.manager?'الإدارة':'تحديات الفريق'}</a><span aria-hidden="true">/</span>معاينة التسليم</nav>
   <div className="td-heading"><span className="td-eyebrow">معاينة تسليم الفريق · للقراءة فقط</span><h1>{team.title}</h1><p>هذه هي النسخة المحفوظة التي يراها المقيّم.</p></div>
   <DeliverySummary team={saved}/><a className="td-preview-back" href={'/teams?team='+encodeURIComponent(team.id)+'#deliverables'}>العودة إلى مساحة الفريق ←</a>
  </div></main></>;
 }
 return <TeamDesk initialData={seed} initialTeam={id}/>;
}
