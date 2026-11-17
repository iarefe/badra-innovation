import type {Entry} from './challenges';
import {normalizeSearch} from './admin-dashboard';
import type {ParticipantRole} from './participant-roles';
export type ChallengeListSort='newest'|'votes'|'interests';
export type JoinRoleFilter='all'|'unspecified'|ParticipantRole;
export function filterAdminChallenges(entries:Entry[],status:'all'|Entry['status'],query:string,role:JoinRoleFilter,sort:ChallengeListSort,withInterests=false){
 const q=normalizeSearch(query);
 return entries.filter(e=>!e.example&&(!withInterests||Number(e.interestCount)>0)&&(status==='all'||e.status===status)&&(!q||normalizeSearch(e.challenge.title).includes(q)||normalizeSearch(e.challenge.author).includes(q))&&(role==='all'||e.interestedMembers?.some(m=>role==='unspecified'?m.roles.length===0:m.roles.includes(role)))).sort((a,b)=>{
  const difference=sort==='votes'?(b.votes??0)-(a.votes??0):sort==='interests'?(b.interestCount??0)-(a.interestCount??0):0;
  return difference||b.createdAt-a.createdAt||a.id.localeCompare(b.id);
 });
}
