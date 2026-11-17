import type {Entry} from '../challenges';
import type {EmployeeReach} from '../employee-reach';
import {reachStatements,reachFromResults} from './employee-reach';

export type ReportChallenge={id:string;title:string;author:string;domain:string;scope:string;issue:string;status:Entry['status'];publishedAt:number|null;votes:number;interests:number};
export type ReportSelection={id:string;title:string;votes:number;rank:number};
export type ReportWorkshop={target:number;state:'open'|'paused'|'final';selection:ReportSelection[]};
export type HackathonReport={
 title:string;generatedAt:number;reach:EmployeeReach;voters:number;joiners:number;published:number;
 challenges:ReportChallenge[];workshop:ReportWorkshop;
};
const eligibleVote="v.user_id LIKE 'employee:%' AND v.user_id<>c.owner";
const eligibleInterest="'employee:'||i.employee_id<>c.owner";

// All source reads share one D1 transaction, independently of the current admin tab or its filters.
// Fetch only fields that appear in the report; never fetch a session token, a photo or a full phone number.
export async function readHackathonReport(db:D1Database,generatedAt=Date.now()):Promise<HackathonReport>{
 const [event, cards, people, roster, unique, frozen]=await db.batch([
  db.prepare('SELECT title,count,open,finalized FROM workshop_settings WHERE id=1'),
  db.prepare(`SELECT
   c.id,c.published_at AS publishedAt,COALESCE(TRIM(json_extract(c.payload,'$.domain')),'') domain,COALESCE(TRIM(json_extract(c.payload,'$.scope')),'') scope,
   COALESCE(NULLIF(TRIM(json_extract(c.payload,'$.situation')),''),TRIM(json_extract(c.payload,'$.question')),'') issue,
   COALESCE(NULLIF(TRIM(json_extract(c.payload,'$.title')),''),'تحدٍّ بلا عنوان') title,
   COALESCE(NULLIF(TRIM(json_extract(c.payload,'$.author')),''),NULLIF(TRIM(e.name),''),'لم يُذكر الاسم') author,c.status,
   (SELECT COUNT(*) FROM challenge_votes v WHERE v.challenge_id=c.id AND ${eligibleVote}) votes,
   (SELECT COUNT(*) FROM challenge_interests i WHERE i.challenge_id=c.id AND ${eligibleInterest}) interests
   FROM challenges c LEFT JOIN employees e ON c.owner='employee:'||e.id
   ORDER BY CASE c.status WHEN 'published' THEN 0 ELSE 1 END,COALESCE(c.published_at,c.created_at) DESC,c.id`),
  ...reachStatements(db),
  db.prepare(`SELECT
   (SELECT COUNT(DISTINCT v.user_id) FROM challenge_votes v JOIN challenges c ON c.id=v.challenge_id WHERE c.status='published' AND ${eligibleVote}) voters,
   (SELECT COUNT(DISTINCT i.employee_id) FROM challenge_interests i JOIN challenges c ON c.id=i.challenge_id WHERE c.status='published' AND ${eligibleInterest}) joiners`),
  db.prepare(`SELECT s.challenge_id id,COALESCE(NULLIF(TRIM(json_extract(s.payload,'$.title')),''),'تحدٍّ بلا عنوان') title,s.votes,s.rank
   FROM workshop_selection s JOIN workshop_settings w ON w.id=1 AND w.finalized=1 ORDER BY s.rank`)
 ]);
 const challenges=cards.results as unknown as ReportChallenge[],reach=reachFromResults(people,roster);
 const config=event.results as {title:string;count:number;open:number;finalized:number}[],headcounts=unique.results as {voters:number;joiners:number}[];
 const row=config[0],rawTitle=String(row?.title||'').trim();
 const workshop:ReportWorkshop={target:Number(row?.count??3),state:row?.finalized?'final':row&&row.open===0?'paused':'open',selection:frozen.results as unknown as ReportSelection[]};
 return {title:!rawTitle||rawTitle==='ورشة ابتكار حلول المؤسسة'?'هاكاثون الابتكار الرقمي':rawTitle,generatedAt,reach,
  published:challenges.filter(x=>x.status==='published').length,
  voters:Number(headcounts[0].voters),joiners:Number(headcounts[0].joiners),challenges,workshop};
}

export function reportDay(timestamp:number){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp);
}
