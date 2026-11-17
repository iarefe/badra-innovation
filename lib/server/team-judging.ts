import {database} from './access';
import {teamResult,type JudgingReview,type JudgingRow} from '../team-card';

// A judge's own team, inactive accounts and withdrawn assignments do not count.
export const eligibleTeamJudgesSQL=`
  SELECT t.id AS team,j.person FROM event_teams t CROSS JOIN event_judges j
  JOIN employees e ON e.id=j.person AND e.active=1
  WHERE NOT EXISTS(SELECT 1 FROM team_members m WHERE m.team=t.id AND m.person=j.person)
`;

type Row={id:string;title:string;rank:number;audience:number|null;required:number;eligible:number;scores?:string|null;card?:string|null;person?:string;name?:string;stamp?:number};

// The live overview reads marks only. A manager opening a team can also see its signed cards.
export async function managerJudging(v:{manager:boolean},{cards=false,teamId}:{cards?:boolean;teamId?:string}={}):Promise<JudgingRow[]>{
 if(!v.manager)throw Error('نتائج التحكيم متاحة للإدارة فقط.');
 const stmt=database().prepare(`WITH eligible AS (${eligibleTeamJudgesSQL}),
   counts AS (SELECT team,COUNT(*) AS required FROM eligible GROUP BY team)
  SELECT t.id,json_extract(c.payload,'$.title') title,w.rank,t.audience,COALESCE(n.required,0) required,
     a.person IS NOT NULL eligible,
     ${cards?'s.person,e.name,s.stamp,s.card':"json_extract(s.card,'$.scores') scores"}
  FROM event_teams t JOIN challenges c ON c.id=t.id JOIN workshop_selection w ON w.challenge_id=t.id
  LEFT JOIN counts n ON n.team=t.id LEFT JOIN team_scores s ON s.team=t.id
  LEFT JOIN eligible a ON a.team=t.id AND a.person=s.person
  ${cards?'LEFT JOIN employees e ON e.id=s.person':''}
  ${teamId?'WHERE t.id=?':''} ORDER BY w.rank,t.id,s.stamp,s.person`);
 const rows=(await (teamId?stmt.bind(teamId):stmt).all<Row>()).results;
 const teams=new Map<string,{id:string;title:string;rank:number;required:number;audience:number|null;scores:number[][];reviews:JudgingReview[]}>();
 for(const row of rows){
  let t=teams.get(row.id);
  if(!t){t={id:row.id,title:row.title,rank:row.rank,required:row.required,audience:row.audience,scores:[],reviews:[]};teams.set(row.id,t)}
  if(cards&&row.card){
   const card:JudgingReview['card']=JSON.parse(row.card);
   t.reviews.push({person:row.person!,name:row.name||'',stamp:row.stamp!,eligible:!!row.eligible,card});
   if(row.eligible)t.scores.push(card.scores);
  }else if(row.eligible&&row.scores){t.scores.push(JSON.parse(row.scores))}
 }
 return [...teams.values()].map(t=>({id:t.id,title:t.title,rank:t.rank,result:teamResult(t.required,t.scores,t.audience),...(cards?{evaluations:t.reviews}:{})}));
}
