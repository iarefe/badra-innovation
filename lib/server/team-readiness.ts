import {database} from './access';
import {eligibleTeamJudgesSQL} from './team-judging';
import type {TeamReadinessRow} from '../team-readiness';

type DBRow=Omit<TeamReadinessRow,'solution'|'instructions'|'slides'>&{solution:number;instructions:number;slides:number};

export async function getTeamReadiness(v:{manager:boolean}):Promise<TeamReadinessRow[]>{
  if(!v.manager)throw Error('جاهزية الفرق متاحة للإدارة فقط.');
  // Project readiness flags only, using the same eligible jury as the scoring card:
  // currently assigned active employees, excluding members of the particular team.
  const {results}=await database().prepare(`
    WITH eligible AS (${eligibleTeamJudgesSQL}), judging AS (
      SELECT a.team, COUNT(*) AS required, COUNT(s.person) AS submitted
      FROM eligible a LEFT JOIN team_scores s ON s.team=a.team AND s.person=a.person
      GROUP BY a.team
    )
    SELECT t.id,json_extract(c.payload,'$.title') AS title,w.rank,
      trim(t.solution)<>'' AS solution,
      trim(t.instructions,char(32)||char(9)||char(10)||char(13))<>'' AS instructions,
      (trim(t.slides_url)<>'' OR EXISTS(
        SELECT 1 FROM team_files f WHERE f.team=t.id AND f.kind='slides'
      )) AS slides,
      COALESCE(j.submitted,0) AS submitted,COALESCE(j.required,0) AS required
    FROM event_teams t JOIN challenges c ON c.id=t.id JOIN workshop_selection w ON w.challenge_id=t.id
    LEFT JOIN judging j ON j.team=t.id ORDER BY w.rank,t.id
  `).all<DBRow>();
  return results.map(({solution,instructions,slides,...r})=>({...r,solution:!!solution,instructions:!!instructions,slides:!!slides}));
}
