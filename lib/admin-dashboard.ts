import type {Entry,Workshop,Challenge} from './challenges';
import type {ParticipantRole} from './participant-roles';
import type {ProspectiveEmployee} from './prospective-employees';

export type AdminTab='review'|'workshop'|'participation'|'operations'|'judging'|'readiness'|'ballot';
export function adminRouteTab(value:string|null|undefined):AdminTab|null{
 return value==='challenges'?'review':value==='results'?'judging':value==='attendance'?'ballot':value==='readiness'?'readiness':null;
}
export type WorkshopAction='configure'|'pause'|'resume'|'finalize'|'reopen'|'pause-intake'|'resume-intake'|'pause-joining'|'resume-joining';
export type Channel='sms'|'whatsapp';
export type RegisteredEmployee={id:string;name:string;phone:string|null;email:string|null;department:string;active:number|boolean;roles:ParticipantRole[]};
export type ParticipationData={employees:RegisteredEmployee[];revision:number;otpReady:boolean;channel:Channel;channels:Channel[];logs:{action:string;created_at:number}[];logTotal:number;legacyVotes:number};
export type AdminNotify=(message:string,tone?:'success'|'error')=>void;
export const channelLabels:Record<Channel,string>={sms:'رسالة نصية SMS',whatsapp:'واتساب'};
export const statusLabels:Record<Entry['status'],string>={published:'منشور',draft:'مسودة خاصة',pending:'لم يُنشر بعد',returned:'يحتاج استكمالًا'};
export const num=(v:number)=>v.toLocaleString('ar-SA');
export const challengeQuantity=(n:number)=>n===1?'تحدٍّ واحد':n===2?'تحدّيين':num(n)+(n<=10?' تحديات':' تحدّيًا');
export function phase(w:Workshop){return w.finalized?'final':w.open?'open':'paused'}
export const phaseText={final:'القائمة معتمدة',open:'التصويت مفتوح',paused:'التصويت موقوف'};
export function adminTotals(entries:Entry[]){
 const all=entries.filter(e=>!e.example),published=all.filter(e=>e.status==='published');
 return {all,published,drafts:all.filter(e=>e.status==='draft').length,votes:published.reduce((n,e)=>n+(e.votes??0),0),interests:published.reduce((n,e)=>n+(e.interestCount??0),0),interestedChallenges:published.filter(e=>Number(e.interestCount)>0).length};
}
export type RankRow={id:string;challenge:Challenge;votes:number;rank:number;inside:boolean};
export function adminRanking(entries:Entry[],order:string[],workshop:Workshop,limit:number):RankRow[]{
 const published=entries.filter(e=>e.status==='published'&&!e.example),byId=new Map(published.map(e=>[e.id,e]));
 // Live order comes from the same server query used to finalize. The saved list remains authoritative once frozen.
 const saved=workshop.selected as Omit<RankRow,'inside'>[];
 const ids=[...new Set([...(workshop.rankedIds||saved.map(e=>e.id)),...order,...published.map(e=>e.id)])];
 const ranked=ids.flatMap(id=>{const entry=byId.get(id);return entry?[{id,challenge:entry.challenge,votes:entry.votes??0}]:[]});
 if(!workshop.finalized)return ranked.map((e,i)=>({...e,rank:i+1,inside:i<limit}));
 const included=new Set(saved.map(s=>s.id));
 return [...saved.map(e=>({...e,inside:true})),...ranked.filter(e=>!included.has(e.id)).map((e,i)=>({...e,rank:saved.length+i+1,inside:false}))];
}
export const normalizeSearch=(value:string)=>(value||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).trim();
export function personMatches(name:string,phone:string|null,query:string){
 const q=normalizeSearch(query);if(!q||normalizeSearch(name).includes(q))return true;
 const digits=q.replace(/[\s()+-]/g,'');if(!/^\d+$/.test(digits))return false;
 const p=normalizeSearch(phone||'').replace(/\D/g,''),local=p.startsWith('9665')?'0'+p.slice(3):p;
 return [p,local,'00'+p].some(x=>x.includes(digits))&&!!p;
}
export type ProspectFilter='all'|'unregistered'|'confirmed';
export function prospectMatches(p:ProspectiveEmployee,filter:ProspectFilter){return filter==='all'||(filter==='confirmed'?!!p.linkedEmployeeId:!p.linkedEmployeeId&&!p.registeredEmployeeId&&!p.declined)}
