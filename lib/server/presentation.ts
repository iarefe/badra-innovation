import {intakeWindow} from '../hackathon-intake';
import {initialCover} from '../challenge-cover';
import type {Challenge} from '../challenges';
import {profileDepartment} from '../profile-department';
import {excerpt,type DisplayFeed} from '../presentation';
import {database,settings} from './access';

type Row={id:string;title:string;situation:string;impact:string;author:string;department:string|null;team:string|null;domain:Challenge['domain'];scope:string;avatar_v:number|null;cover_v:number|null};
// This projection is identical for a logged-out display and a manager. It never reads
// votes, joining requests, unpublished payloads, employee directories or contact details.
export async function publicPresentation():Promise<DisplayFeed>{
 const [cards,workshop]=await Promise.all([database().prepare(`SELECT c.id,
  json_extract(c.payload,'$.title') AS title, json_extract(c.payload,'$.situation') AS situation,
  json_extract(c.payload,'$.impact') AS impact, json_extract(c.payload,'$.author') AS author,
  json_extract(c.payload,'$.domain') AS domain, json_extract(c.payload,'$.scope') AS scope,
  CASE WHEN json_extract(c.payload,'$.ownership')='shared' THEN json_extract(c.payload,'$.coOwners') END AS team,
  e.department, CASE WHEN length(av.object_key)>0 THEN av.updated_at END AS avatar_v,
  CASE WHEN length(cv.object_key)>0 THEN cv.updated_at END AS cover_v
  FROM challenges c LEFT JOIN employees e ON c.owner='employee:'||e.id
  LEFT JOIN employee_avatars av ON av.employee_id=e.id LEFT JOIN challenge_covers cv ON cv.challenge_id=c.id
  WHERE c.status='published' AND c.id NOT LIKE 'example-%'
  ORDER BY COALESCE(c.published_at,c.created_at),c.id`).all<Row>(),settings()]);
 return {intake:intakeWindow(workshop),title:workshop.title,votingOpen:!!workshop.open&&!workshop.finalized,slides:cards.results.map(row=>{
  const key=encodeURIComponent(row.id);
  return {id:row.id,title:row.title,summary:excerpt(row.situation?.trim()||row.impact||''),author:row.author?.trim()||'',
   department:profileDepartment(row.department),team:row.team?.trim()||'',domain:row.domain||'',scope:row.scope||'',
   avatarUrl:row.avatar_v!=null?'/api/avatar?challenge='+key+'&v='+row.avatar_v:null,
   coverUrl:row.cover_v!=null?'/api/challenge-cover?id='+key+'&v='+row.cover_v:initialCover(row.id,{title:row.title,domain:row.domain,situation:row.situation||''}).url};
 })};
}
