const seeds: {id:string;name:string;phone:string|null;photo:string}[] = []; // No bundled employee records.
import {database,fail} from './access';
import {avatarBucket,readAvatar} from './avatar';
import type {sessionEmployee} from './employee';
import type {SuggestedProfile} from '../prospective-employees';
type Session=NonNullable<Awaited<ReturnType<typeof sessionEmployee>>>;
export type ProspectiveRow={id:string;name:string;phone:string|null;avatar_key:string;linked_employee_id:string|null;revision:number;link_token:string;created_at:number;updated_at:number};
let importing:Promise<void>|undefined;
/** Private, idempotent import. Never creates accounts or replaces an administrator's edits. */
export async function ensureProspectiveEmployees(){
 const bucket=avatarBucket();if(!bucket)return;
 if(!importing)importing=(async()=>{
  const db=database(),existing=await db.prepare('SELECT id FROM prospective_employees').all();
  const ids=new Set(existing.results.map((row:any)=>row.id)),missing=seeds.filter(row=>!ids.has(row.id));
  if(!missing.length)return;
  const now=Date.now();
  for(let i=0;i<missing.length;i+=5)await Promise.all(missing.slice(i,i+5).map(row=>bucket.put(`prospective-avatars/${row.id}.webp`,Uint8Array.from(atob(row.photo),c=>c.charCodeAt(0)),{httpMetadata:{contentType:'image/webp'}})));
  await db.batch(missing.map(row=>db.prepare('INSERT OR IGNORE INTO prospective_employees(id,name,phone,avatar_key,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(row.id,row.name,row.phone,`prospective-avatars/${row.id}.webp`,now,now)));
 })().catch(error=>{importing=undefined;throw error});
 await importing;
}
export function prospectiveAvatarUrl(row:Pick<ProspectiveRow,'id'|'avatar_key'|'revision'>){return row.avatar_key?`/api/prospective-employees?avatar=${row.id}&v=${row.revision}`:null;}
export async function suggestedProfile(e:Session):Promise<SuggestedProfile|null>{
 const row=await database().prepare(`SELECT p.* FROM prospective_employees p WHERE p.phone=? AND p.linked_employee_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM prospective_employees linked WHERE linked.linked_employee_id=?)
  AND NOT EXISTS(SELECT 1 FROM prospective_declines d WHERE d.employee_id=? AND d.prospective_id=p.id AND d.revision=p.revision)`).bind(e.phone,e.id,e.id).first<ProspectiveRow>();
 return row?{id:row.id,name:row.name,revision:row.revision,avatarUrl:prospectiveAvatarUrl(row)}:null;
}
export async function declineProfile(e:Session,id:string,revision:number){
 const candidate=await suggestedProfile(e);if(!candidate||candidate.id!==id||candidate.revision!==revision)return fail('تغيّرت البيانات المقترحة. حدّث الصفحة ثم حاول مجددًا.',409);
 const saved=await database().prepare(`INSERT INTO prospective_declines(employee_id,prospective_id,revision)
  SELECT ?,id,revision FROM prospective_employees WHERE id=? AND phone=? AND linked_employee_id IS NULL AND revision=?
  ON CONFLICT(employee_id,prospective_id) DO UPDATE SET revision=excluded.revision RETURNING prospective_id`).bind(e.id,id,e.phone,revision).first();
 return saved?null:fail('تغيّرت البيانات المقترحة. حدّث الصفحة ثم حاول مجددًا.',409);
}
export async function confirmProfile(e:Session,id:string,revision:number){
 const db=database(),candidate=await suggestedProfile(e);
 if(!candidate||candidate.id!==id||candidate.revision!==revision)return fail('تغيّرت البيانات المقترحة. حدّث الصفحة ثم حاول مجددًا.',409);
 const row=await db.prepare('SELECT * FROM prospective_employees WHERE id=?').bind(id).first<ProspectiveRow>();
 const bucket=avatarBucket();if(!row||!bucket)return fail('تعذّر تجهيز الصورة الآن. حاول مجددًا.',503);
 const photo=await bucket.get(row.avatar_key);if(!photo)return fail('تعذّر تحميل الصورة. حاول مجددًا.',503);
 const old=await readAvatar(e.id),now=Date.now(),nonce=crypto.randomUUID(),key=`avatars/${e.id}/${nonce}.webp`;
 let committed=false;
 try{
  await bucket.put(key,photo.body,{httpMetadata:{contentType:'image/webp'}});
  const guard='EXISTS(SELECT 1 FROM prospective_employees p WHERE p.id=? AND p.linked_employee_id=? AND p.link_token=?)';
  const result=await db.batch([
   db.prepare(`UPDATE prospective_employees SET linked_employee_id=?,link_token=?,revision=revision+1,updated_at=?
    WHERE id=? AND phone=? AND revision=? AND linked_employee_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM prospective_employees other WHERE other.linked_employee_id=?)
    AND EXISTS(SELECT 1 FROM employees WHERE id=? AND phone=? AND active=1)
    AND COALESCE((SELECT object_key FROM employee_avatars WHERE employee_id=?),'')=? RETURNING id`).bind(e.id,nonce,now,id,e.phone,revision,e.id,e.id,e.phone,e.id,old?.object_key||''),
   db.prepare(`UPDATE employees SET name=? WHERE id=? AND ${guard}`).bind(row.name,e.id,id,e.id,nonce),
   db.prepare(`INSERT INTO employee_avatars(employee_id,object_key,updated_at) SELECT ?,?,? WHERE ${guard}
    ON CONFLICT(employee_id) DO UPDATE SET object_key=excluded.object_key,updated_at=excluded.updated_at`).bind(e.id,key,now,id,e.id,nonce),
   db.prepare(`INSERT INTO security_audit(id,actor,action,created_at) SELECT ?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),'employee:'+e.id,'تأكيد بيانات موظف محتمل',now,id,e.id,nonce)
  ]);
  if(!result[0].results?.length){await bucket.delete(key);return fail('تغيّرت البيانات من جلسة أخرى. حدّث الصفحة ثم حاول مجددًا.',409)}
  committed=true;
  if(old?.object_key)try{await bucket.delete(old.object_key)}catch{}
  return null;
 }catch{
  if(!committed)try{await bucket.delete(key)}catch{}
  return fail('تعذّر حفظ البيانات. حاول مجددًا.',503);
 }
}
