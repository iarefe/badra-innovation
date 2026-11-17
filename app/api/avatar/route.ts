import {z} from 'zod';
import {database,reply,fail} from '@/lib/server/access';
import {withParticipant} from '@/lib/server/participant';
import {participationGate,rate} from '@/lib/server/employee';
import {limitedBody,imageType} from '@/lib/server/challenge-cover';
import {avatarBucket,readAvatar,ownAvatarUrl,type AvatarRow} from '@/lib/server/avatar';
export const dynamic='force-dynamic';

export async function GET(r:Request){return withParticipant(r,async v=>{
 const params=new URL(r.url).searchParams;let avatar:AvatarRow|null=null;
 if(params.get('self')==='1'){
  if(!v.session?.id)return fail('الصورة غير متاحة.',404);
  avatar=await readAvatar(v.session.id);
 }else{
  const id=z.string().uuid().safeParse(params.get('challenge'));if(!id.success)return fail('الصورة غير متاحة.',404);
  const row:any=await database().prepare(`SELECT a.*,c.owner,c.status FROM challenges c
   JOIN employee_avatars a ON c.owner='employee:'||a.employee_id WHERE c.id=?`).bind(id.data).first();
  if(!row||(row.status!=='published'&&row.owner!==v.id&&!v.manager))return fail('الصورة غير متاحة.',404);
  avatar=row;
 }
 if(!avatar?.object_key)return fail('الصورة غير متاحة.',404);
 const object=await avatarBucket()?.get(avatar.object_key);if(!object)return fail('الصورة غير متاحة.',404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});}

export async function POST(r:Request){return withParticipant(r,async v=>{
 const gate=await participationGate(r,v);if(gate)return gate;
 // Identity comes exclusively from the verified session, never an input ID.
 if(!avatarBucket())return fail('تخزين الصور غير متاح الآن. حاول لاحقًا.',503);
 if(!await rate('avatar:'+v.employeeId,20,3600000))return fail('تم تغيير الصورة مرات كثيرة. حاول لاحقًا.',429);
 let bytes:Uint8Array;try{bytes=await limitedBody(r,512*1024)}catch{return fail('الصورة كبيرة. اخترها من جديد لضغطها قبل الرفع.',413)}
 const type=imageType(bytes);if(!type)return fail('اختر صورة JPEG أو PNG أو WebP صالحة.',415);
 const old=await readAvatar(v.employeeId!),now=Date.now();
 const key=`avatars/${v.employeeId}/${crypto.randomUUID()}.${type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp'}`;
 let committed=false;
 try{
  await avatarBucket()!.put(key,bytes,{httpMetadata:{contentType:type}});
  const saved=await database().prepare(`INSERT INTO employee_avatars(employee_id,object_key,updated_at) VALUES(?,?,?)
   ON CONFLICT(employee_id) DO UPDATE SET object_key=excluded.object_key,updated_at=excluded.updated_at
   WHERE employee_avatars.object_key=? RETURNING employee_id`)
   .bind(v.employeeId!,key,now,old?.object_key||'').first();
  if(!saved){await avatarBucket()!.delete(key);return fail('تغيّرت صورتك من جهاز آخر. حدّث الصفحة ثم حاول مجددًا.',409)}
  committed=true;
  if(old?.object_key)try{await avatarBucket()!.delete(old.object_key)}catch{}
  return reply({avatarUrl:ownAvatarUrl({employee_id:v.employeeId!,object_key:key,updated_at:now})});
 }catch{
  if(!committed)try{await avatarBucket()!.delete(key)}catch{}
  return fail('تعذّر حفظ الصورة. صورتك السابقة محفوظة؛ حاول مجددًا.',503);
 }
});}

export async function DELETE(r:Request){return withParticipant(r,async v=>{
 const gate=await participationGate(r,v);if(gate)return gate;
 const old=await readAvatar(v.employeeId!);if(!old?.object_key)return reply({avatarUrl:null});
 const removed=await database().prepare('UPDATE employee_avatars SET object_key=?,updated_at=? WHERE employee_id=? AND object_key=? RETURNING employee_id').bind('',Date.now(),v.employeeId!,old.object_key).first();
 if(!removed)return fail('تغيّرت صورتك من جهاز آخر. حدّث الصفحة ثم حاول مجددًا.',409);
 try{await avatarBucket()?.delete(old.object_key)}catch{}
 return reply({avatarUrl:null});
});}
