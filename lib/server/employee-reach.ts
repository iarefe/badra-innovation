import type {EmployeePresence,EmployeeReach,EntryState} from '../employee-reach';

type Account={id:string;name:string;tail:string|null;last_access_at:number|null;has_login:number;historical:number};
type DirectoryRow={id:string;name:string;linked:string|null;phone_match:string|null;declined:number};
const byName=new Intl.Collator('ar',{sensitivity:'base',numeric:true});
// A roster confirmation identifies the employee; it is deliberately not login evidence.
// For the time before visit tracking, accept an issued session or an actual authenticated action.
// Never infer an entry or a date from creating an account, a matching phone, roles, or a requested OTP.
export const reachStatements=(db:D1Database)=>[
 db.prepare(`SELECT e.id,e.name,substr(e.phone,-4) tail,e.last_access_at,(e.signed_in IS NULL) historical,
  (e.signed_in IS 1 OR e.last_access_at IS NOT NULL OR EXISTS(SELECT 1 FROM employee_sessions s WHERE s.employee_id=e.id)
  OR EXISTS(SELECT 1 FROM challenge_votes v WHERE v.user_id='employee:'||e.id)
  OR EXISTS(SELECT 1 FROM challenge_interests i WHERE i.employee_id=e.id)
  OR EXISTS(SELECT 1 FROM security_audit a WHERE a.actor='employee:'||e.id)
  OR EXISTS(SELECT 1 FROM prospective_declines d WHERE d.employee_id=e.id)) has_login FROM employees e`),
 db.prepare(`SELECT p.id,p.name,p.linked_employee_id linked,em.id phone_match,
  EXISTS(SELECT 1 FROM prospective_declines d WHERE d.employee_id=em.id AND d.prospective_id=p.id AND d.revision=p.revision) declined
  FROM prospective_employees p LEFT JOIN employees em ON em.phone=p.phone`)
];
export function collectEmployeeReach(accounts:Account[],directory:DirectoryRow[]):EmployeeReach{
 const all=new Map(accounts.map(a=>[a.id,a])),linked=new Set(directory.flatMap(p=>p.linked?[p.linked]:[])),used=new Set<string>();
 const rows=directory.map((p):EmployeePresence=>{
  const disputed=!p.linked&&!!p.phone_match&&(!!p.declined||linked.has(p.phone_match));
  const id=p.linked||(!disputed?p.phone_match:null),a=id?all.get(id):undefined;
  if(a)used.add(a.id);
  const status:EntryState=disputed?'unknown':a?.has_login?'entered':a?.historical||p.linked&&!a?'unknown':'waiting';
  // The manager needs the name OF THE EMPLOYEE from the official directory, not the display name of the account.
  return {prospectId:p.id,...(a?{accountId:a.id}:{}),identityConfirmed:!!p.linked&&!disputed,name:p.name,status,lastAccessAt:a?.last_access_at??null,note:disputed?'يحتاج الجوال إلى مطابقة مع الموظف':status==='unknown'?'لا يتوفر سجل دخول سابق يمكن التحقق منه':''};
 });
 const outside:EmployeePresence[]=accounts.filter(a=>a.has_login&&!used.has(a.id)).map(a=>({accountId:a.id,name:a.name.trim()||(a.tail?'حساب ينتهي بـ '+a.tail:'حساب بلا اسم'),status:'entered',lastAccessAt:a.last_access_at,note:''}));
 rows.sort((a,b)=>byName.compare(a.name,b.name));outside.sort((a,b)=>byName.compare(a.name,b.name));
 const accountRows:EmployeePresence[]=accounts.map(a=>({accountId:a.id,name:a.name.trim()||(a.tail?'حساب ينتهي بـ '+a.tail:'حساب بلا اسم'),status:a.has_login?'entered':a.historical?'unknown':'waiting',lastAccessAt:a.last_access_at,note:a.historical&&!a.has_login?'سجل قديم بلا دليل دخول موثّق':''}));
 return {accounts:accountRows,total:directory.length,entered:rows.filter(r=>r.status==='entered').length,waiting:rows.filter(r=>r.status==='waiting').length,unknown:rows.filter(r=>r.status==='unknown').length,confirmed:directory.filter(r=>r.linked).length,rows,outside};
}
export function reachFromResults(people:D1Result<unknown>,roster:D1Result<unknown>){
 return collectEmployeeReach(people.results as Account[],roster.results as DirectoryRow[]);
}
export async function readEmployeeReach(db:D1Database){
 const [people,roster]=await db.batch(reachStatements(db));return reachFromResults(people,roster);
}
