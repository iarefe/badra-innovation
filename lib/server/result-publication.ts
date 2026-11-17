import {database} from './access';
import {eligibleTeamJudgesSQL} from './team-judging';
import {rubric} from '../team-card';
import type {PublishedResults,PublicationPreview,Standing} from '../published-results';

// The same rubric and judge-eligibility rule as the live judging desk. Only the final
// score is in the public projection. Equal hundredth-rounded totals share the same place.
const weightedSQL=rubric.map((r,i)=>`json_extract(s.card,'$.scores[${i}]') * ${r[2]} / 5.0`).join('+');
const projection=`WITH eligible AS (${eligibleTeamJudgesSQL}),
 means AS (SELECT s.team,AVG(${weightedSQL}) AS committee FROM team_scores s
 JOIN eligible e ON e.team=s.team AND e.person=s.person GROUP BY s.team),
 totals AS (SELECT t.id,json_extract(c.payload,'$.title') AS title,w.rank AS teamNumber,
 ROUND(m.committee+t.audience,2) AS score FROM event_teams t
 LEFT JOIN challenges c ON c.id=t.id AND c.status='published'
 LEFT JOIN workshop_selection w ON w.challenge_id=t.id LEFT JOIN means m ON m.team=t.id),
 ranked AS (SELECT *,RANK() OVER(ORDER BY score DESC) AS place FROM totals)
 SELECT json_group_array(json_object('id',id,'title',title,'teamNumber',teamNumber,'place',place,'score',score)) AS snapshot,
 COUNT(*) AS teams,COUNT(CASE WHEN score IS NOT NULL AND title IS NOT NULL AND teamNumber IS NOT NULL THEN 1 END) AS ready,
 COALESCE((SELECT phase FROM final_ballot_settings WHERE id=1),'not_open') AS phase
 FROM (SELECT * FROM ranked ORDER BY place,id)`;
type Projection={snapshot:string;teams:number;ready:number;phase:string};
const latest=async():Promise<PublishedResults|null>=>{
 const r=await database().prepare('SELECT revision,published_at,snapshot FROM result_publications ORDER BY revision DESC LIMIT 1').first<{revision:number;published_at:number;snapshot:string}>();
 return r?{revision:r.revision,publishedAt:r.published_at,standings:JSON.parse(r.snapshot)}:null;
};
const project=async()=>{const row=await database().prepare(projection).first<Projection>();if(!row)throw Error('projection');return row;};
function reason(p:Projection){return !p.teams?'لا توجد فرق معلنة بعد.':p.phase==='open'?'أغلق تصويت الحضور قبل تعميم النتيجة.':p.teams!==p.ready?'يلزم لكل فريق بطاقة لجنة واحدة على الأقل ودرجة جمهور مرصودة قبل التعميم.':null;}
async function hash(standings:Standing[]){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(standings))))).map(n=>n.toString(16).padStart(2,'0')).join('');}
const rows=(p:Projection):Standing[]=>reason(p)?[]:JSON.parse(p.snapshot);
async function append(p:Projection,revision:number,actor:string,approvedRelease=false){
 // Recheck the projection in the write itself. A mark or a competing publication
 // changing after the preview must never silently publish a different edition.
 const gate=approvedRelease?" AND phase='closed' AND NOT EXISTS(SELECT 1 FROM event_teams WHERE announced<>1794756395912)":"";
 const res=await database().prepare(`INSERT INTO result_publications(revision,published_at,actor,snapshot)
 SELECT ?+1,?,?,snapshot FROM (${projection}) WHERE teams>0 AND ready=teams AND phase<>'open'
 AND snapshot=? AND (SELECT COALESCE(MAX(revision),0) FROM result_publications)=? ${gate}
 ON CONFLICT(revision) DO NOTHING`).bind(revision,Date.now(),actor,p.snapshot,revision).run();
 return res.meta.changes>0;
}
// A single editorial release explicitly approved by the event owner on 17 November.
// The fingerprint pins the exact four live IDs, titles, team numbers, places and scores.
// This is not a general auto-publish rule. No request supplies release data or credentials.
const launch={event:1794756395912,fingerprint:'738b64757f83035e04f4dfec61e7acbe59727067e329ab0088b78be1ded7ba49'};
export async function publishedResults():Promise<PublishedResults|null>{
 const saved=await latest();if(saved)return saved;
 const target=await database().prepare("SELECT 1 FROM event_teams WHERE announced=? AND (SELECT phase FROM final_ballot_settings WHERE id=1)='closed' LIMIT 1").bind(launch.event).first();
 if(!target)return null;
 const p=await project();if(reason(p)||await hash(rows(p))!==launch.fingerprint)return null;
 await append(p,0,'owner-approved-release:2026-11-17',true);
 return latest();
}
export async function publicationPreview():Promise<PublicationPreview>{
 const current=await publishedResults(),p=await project(),standings=rows(p);
 return {standings,fingerprint:await hash(standings),revision:current?.revision??0,reason:reason(p),
  unchanged:!!current&&JSON.stringify(current.standings)===JSON.stringify(standings)};
}
export async function publishReviewed(fingerprint:string,revision:number,actor:string){
 const current=await publishedResults(),p=await project(),problem=reason(p);
 if(problem)return {error:problem};
 const standings=rows(p);
 if(await hash(standings)!==fingerprint)return {error:'تغيّرت النتائج منذ المعاينة. راجع الترتيب المحدّث قبل التعميم.'};
 if(current&&JSON.stringify(current.standings)===JSON.stringify(standings))return {publication:current};
 if((current?.revision??0)!==revision||!await append(p,revision,actor))return {error:'تغيّرت النتائج أو نُشر تعميم آخر. حدّث المعاينة أولًا.'};
 return {publication:await latest()};
}
