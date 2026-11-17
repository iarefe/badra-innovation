import type {RegisteredEmployee} from './admin-dashboard';
import type {ProspectiveEmployee} from './prospective-employees';
import type {EmployeeReach,EmployeePresence,EntryState} from './employee-reach';
export type PersonRow={key:string;name:string;prospect:ProspectiveEmployee|null;account:RegisteredEmployee|null;match:'confirmed'|'candidate'|'unlinked'|'conflict'|'account';presence:EmployeePresence|null;entry:EntryState|'unavailable';note:string};
export function unifiedPeople(prospects:ProspectiveEmployee[]|null,accounts:RegisteredEmployee[]|null,reach:EmployeeReach|null):PersonRow[]{
 const byId=new Map((accounts||[]).map(a=>[a.id,a])),used=new Set<string>(),counts=new Map<string,number>();
 for(const p of prospects||[])if(p.linkedEmployeeId)counts.set(p.linkedEmployeeId,(counts.get(p.linkedEmployeeId)||0)+1);
 const accountPresence=new Map((reach?.accounts||[]).filter(p=>p.accountId).map(p=>[p.accountId!,p]));
 // Only an explicit, unique confirmed ID joins two records. Names and phone candidates never establish identity.
 const result:PersonRow[]=(prospects||[]).map(p=>{
  const conflict=!!p.linkedEmployeeId&&(counts.get(p.linkedEmployeeId)||0)>1;
  const account=!conflict&&p.linkedEmployeeId?byId.get(p.linkedEmployeeId)||null:null;
  if(account)used.add(account.id);
  const presence=account?accountPresence.get(account.id)||null:null;
  const match=conflict?'conflict':p.linkedEmployeeId?'confirmed':p.registeredEmployeeId?'candidate':'unlinked';
  const note=conflict?'أكثر من سجل يؤكد الحساب نفسه؛ لم ندمج السجلات.':p.linkedEmployeeId&&!account?'حساب مؤكد الارتباط، لكن بياناته غير متاحة.':p.declined?'لم يقبل الحساب المقترح بيانات هذا السجل؛ لا نعدّه تطابق هوية.':match==='candidate'?'يوجد حساب على الجوال المقترح'+(p.registeredName?' باسم «'+p.registeredName+'»':'')+'، ولم تتأكد هوية صاحبه مع هذا السجل.':match==='unlinked'?'سجل من الدليل بلا حساب مؤكد الارتباط.':'';
  return {key:'prospect:'+p.id,name:p.name,prospect:p,account,match,presence,entry:presence?.status||'unavailable',note};
 });
 for(const a of accounts||[])if(!used.has(a.id)){const presence=accountPresence.get(a.id)||null;result.push({key:'account:'+a.id,name:a.name||'بانتظار إدخال الاسم',prospect:null,account:a,match:'account',presence,entry:presence?.status||'unavailable',note:prospects===null?'لم تتوفر بيانات الدليل للتحقق من الارتباط.':'حساب مستقل لم يُدمج مع سجل مؤكد من الدليل.'});}
 if(prospects===null)for(const p of reach?.rows||[])if(p.prospectId)result.push({key:'directory-presence:'+p.prospectId,name:p.name,prospect:null,account:null,match:'unlinked',presence:p,entry:p.identityConfirmed?p.status:'unavailable',note:'تفاصيل سجل الدليل غير متاحة؛ لا نفترض تطابقًا مع الحسابات.'});
 // Reach remains useful if another source failed; retain evidence by stable IDs, never by names.
 const shownAccountIds=new Set(result.flatMap(r=>r.account?[r.account.id]:[]));
 for(const p of reach?.accounts||[])if(p.accountId&&!shownAccountIds.has(p.accountId)&&!byId.has(p.accountId)){result.push({key:'presence:'+p.accountId,name:p.name,prospect:null,account:null,match:'account',presence:p,entry:p.status,note:'سجل دخول لحساب لم تتوفر تفاصيله. أعد تحميل الحسابات لإظهار إجراءاته.'});}
 return result.sort((a,b)=>a.name.localeCompare(b.name,'ar')||a.key.localeCompare(b.key));
}
