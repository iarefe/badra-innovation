import {publishedResults} from './result-publication';
import {announcedChallenges} from './announced-teams';
import {intakeWindow} from '../hackathon-intake';
import {profileDepartment} from '../profile-department';
import {readAvatar,ownAvatarUrl} from './avatar';
import {coverView} from './challenge-cover';
import {database,settings,rankedSQL} from './access';
import type {Participant} from './participant';
import {readRoles} from '../participant-roles';
import type {AccountState,SiteData} from '../account';
import {policy,otpReady} from './employee';
import {ensureRequestedOwnership} from './ownership-repair';
import {ensureDirectPublication} from './direct-publication';
import {ensureProspectiveEmployees,suggestedProfile} from './prospective-employees';
export async function challengeData(v:Participant){
 await Promise.all([ensureRequestedOwnership(),ensureDirectPublication()]);
 const db=database();
 const listPromise=db.prepare(`SELECT c.*, author.department AS author_department, av.object_key avatar_key,av.updated_at avatar_updated, cv.object_key cover_key,cv.status cover_status,cv.source cover_source,cv.prompt cover_prompt,cv.updated_at cover_updated,cv.started_at cover_started,
  (SELECT COUNT(*) FROM challenge_votes x WHERE x.challenge_id=c.id AND x.user_id LIKE 'employee:%' AND x.user_id<>c.owner) votes,
  EXISTS(SELECT 1 FROM challenge_votes x WHERE x.challenge_id=c.id AND x.user_id=? AND x.user_id<>c.owner) voted,
  (SELECT COUNT(*) FROM challenge_interests x WHERE x.challenge_id=c.id AND 'employee:'||x.employee_id<>c.owner) interest_count,
  EXISTS(SELECT 1 FROM challenge_interests x WHERE x.challenge_id=c.id AND x.employee_id=? AND 'employee:'||x.employee_id<>c.owner) interested
  FROM challenges c LEFT JOIN employees author ON c.owner='employee:'||author.id LEFT JOIN challenge_covers cv ON cv.challenge_id=c.id LEFT JOIN employee_avatars av ON c.owner='employee:'||av.employee_id WHERE c.status='published' OR c.owner=? OR ?=1 ORDER BY c.created_at DESC`).bind(v.id,v.employeeId||'',v.id,v.manager?1:0).all();
 // Counts, participant names and roles are private to the verified manager.
 const membersPromise=v.manager?Promise.all([
  db.prepare(`SELECT x.challenge_id,COALESCE(NULLIF(TRIM(e.name),''),'مشارك سابق') name FROM challenge_votes x
   JOIN challenges c ON c.id=x.challenge_id LEFT JOIN employees e ON x.user_id='employee:'||e.id
   WHERE x.user_id LIKE 'employee:%' AND x.user_id<>c.owner AND (c.status='published' OR c.owner=? OR ?=1) ORDER BY name`).bind(v.id,v.manager?1:0).all(),
  db.prepare(`SELECT x.challenge_id,COALESCE(NULLIF(TRIM(e.name),''),'مشارك سابق') name,e.roles FROM challenge_interests x LEFT JOIN employees e ON e.id=x.employee_id
   JOIN challenges c ON c.id=x.challenge_id WHERE 'employee:'||x.employee_id<>c.owner AND (c.status='published' OR c.owner=? OR ?=1) ORDER BY x.created_at,e.name`).bind(v.id,v.manager?1:0).all()
 ]):Promise.resolve([null,null]);
 const ownEventRoles=v.employee&&v.employeeId?db.prepare(`SELECT
  EXISTS(SELECT 1 FROM event_judges WHERE person=?1) AS judge,
  EXISTS(SELECT 1 FROM team_members WHERE person=?1) AS team_member`).bind(v.employeeId).first<{judge:number;team_member:number}>():null;
 const [list,[votes,interests],eventRoles]=await Promise.all([listPromise,membersPromise,ownEventRoles]);
 // Supply only a display order. Totals, identities and final workshop selection remain manager-only.
 const homeVoteOrder=[...list.results].filter((c:any)=>c.status==='published').sort((a:any,b:any)=>b.votes-a.votes||(a.published_at??a.created_at)-(b.published_at??b.created_at)||String(a.id).localeCompare(String(b.id))).map((c:any)=>String(c.id));
 return {homeVoteOrder,entries:list.results.map((c:any)=>({id:c.id,authorDepartment:profileDepartment(c.author_department)||null,authorAvatar:c.avatar_key?'/api/avatar?challenge='+encodeURIComponent(c.id)+'&v='+c.avatar_updated:null,challenge:JSON.parse(c.payload),cover:coverView(c.id,JSON.parse(c.payload),c.cover_status?{challenge_id:c.id,object_key:c.cover_key,status:c.cover_status,source:c.cover_source,prompt:c.cover_prompt,updated_at:c.cover_updated,started_at:c.cover_started,job_id:""}:null,c.owner===v.id||v.manager),status:c.status,createdAt:c.created_at,publishedAt:c.status==='published'?c.published_at:null,hasVotes:c.votes>0,voted:!!c.voted,mine:c.owner===v.id,interested:!!c.interested,
  ...(v.manager?{votes:c.votes,interestCount:c.interest_count,voters:votes!.results.filter((x:any)=>x.challenge_id===c.id).map((x:any)=>({name:x.name})),interestedMembers:interests!.results.filter((x:any)=>x.challenge_id===c.id).map((x:any)=>({name:x.name,roles:readRoles(x.roles)}))}:{}),
  reviewNote:c.owner===v.id||v.manager?c.review_note:''})),viewer:{judge:!!eventRoles?.judge,teamMember:!!eventRoles?.team_member,signedIn:v.signedIn,employee:v.employee,manager:v.manager,email:v.email,employeeName:v.employeeName,employeeId:v.employeeId,employeeNumber:v.employeeNumber,department:v.department,roles:v.roles,needsProfile:v.needsProfile}};

}
export async function workshopData(v:Pick<Participant,'manager'>){
 await ensureDirectPublication();
 const s=await settings();const rows=v.manager?await database().prepare(s.finalized?'SELECT challenge_id id,payload,votes,rank FROM workshop_selection ORDER BY rank':rankedSQL).all():{results:[]};
 const selected=s.finalized?rows.results:rows.results.slice(0,s.count);
 const [announced,publication]=s.finalized?await Promise.all([announcedChallenges(),publishedResults()]):[[],null];
 return {announced,publishedResults:publication,intake:intakeWindow(s),title:s.title,count:s.count,open:!!s.open&&!s.finalized,joiningOpen:!!s.joining_open&&!s.finalized,finalized:!!s.finalized,revision:s.revision,...(v.manager&&!s.finalized?{rankedIds:rows.results.map((row:any)=>String(row.id))}:{}),selected:selected.map((x:any,i:number)=>({id:x.id,challenge:JSON.parse(x.payload),votes:x.votes,rank:i+1}))};
}
export async function accountData(e:Participant['session']):Promise<AccountState>{
 await ensureProspectiveEmployees();
 const [p,avatar,suggestion]=await Promise.all([policy(),e?readAvatar(e.id):Promise.resolve(null),e?suggestedProfile(e):Promise.resolve(null)]),complete=!!e?.name.trim()&&readRoles(e?.roles).length>0;
 return {employee:complete&&e?{name:e.name,phone:e.phone,number:e.number,department:profileDepartment(e.department),roles:readRoles(e.roles),avatarUrl:ownAvatarUrl(avatar)}:null,pendingProfile:e&&!complete?{phone:e.phone,name:e.name,department:profileDepartment(e.department),roles:readRoles(e.roles),...(ownAvatarUrl(avatar)?{avatarUrl:ownAvatarUrl(avatar)}:{})}:null,...(suggestion?{suggestedProfile:suggestion}:{}),otpReady:otpReady(),channel:p.otp_channel==='whatsapp'?'whatsapp':'sms'};
}
export async function siteData(v:Participant):Promise<SiteData>{const [d,workshop,account]=await Promise.all([challengeData(v),workshopData(v),accountData(v.session)]);return {...d,workshop,account};}
