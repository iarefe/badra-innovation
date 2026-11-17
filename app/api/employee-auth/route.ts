import {markPortalAccess,keepSessionProof} from '@/lib/server/portal-access';
import {profileDepartment} from '@/lib/profile-department';
import {accountData} from '@/lib/server/site-data';
import {sendOtp,verifyOtp,otpFailureMessage} from '@/lib/server/otp-provider';
import {z} from 'zod';
import {readRoles,rolesSchema} from '@/lib/participant-roles';
import {normalizePhone} from '@/lib/phone';
import {database,reply,fail,sameOrigin} from '@/lib/server/access';
import {ensureProspectiveEmployees,suggestedProfile,confirmProfile,declineProfile} from '@/lib/server/prospective-employees';
import {sessionEmployee,clientIp,hash,token,normalizeNumber,otpReady,policy,rate,sessionHeader,sessionMaxAge,renewEmployeeSession,readCookie} from '@/lib/server/employee';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{
 const e=await sessionEmployee(r);const response=reply(await accountData(e));
 return e?await renewEmployeeSession(r,response):response;
}catch{return fail('تعذّر تحميل حالة الدخول.',503);}}
const departmentField=z.string().max(300).transform(profileDepartment).refine(Boolean);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('request'),phone:z.string().min(1).max(32).transform(normalizePhone).refine(Boolean)}),
 z.object({action:z.literal('verify'),id:z.string().uuid(),code:z.string().regex(/^[0-9٠-٩۰-۹]{6}$/)}),
 z.object({action:z.literal('complete-profile'),name:z.string().trim().min(2).max(100).refine(s=>/[\p{L}]/u.test(s)),department:departmentField,roles:rolesSchema}),
 z.object({action:z.literal('update-department'),department:departmentField}),
 z.object({action:z.literal('confirm-profile'),id:z.string().uuid(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('decline-profile'),id:z.string().uuid(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('update-roles'),roles:rolesSchema}),
 z.object({action:z.literal('logout')})
]);
export async function POST(r:Request){
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 try{
  const raw=await r.text();if(raw.length>1000)return fail('طلب غير صالح.');const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success&&parsed.error.issues.some(issue=>issue.path[0]==='department'))return fail('أدخل اسم إدارتك من حرفين إلى ١٠٠ حرف.');if(!parsed.success)return fail('تحقق من رقم الجوال ورمز التحقق، وأدخل اسمًا من حرفين على الأقل واختر دورًا واحدًا أو أكثر.');const p=parsed.data,db=database();
  if(p.action==='logout'){const secret=readCookie(r);if(secret){const digest=await hash(secret);await db.batch([keepSessionProof(db,'digest',digest),db.prepare('DELETE FROM employee_sessions WHERE digest=?').bind(digest)])}const response=reply({ok:true,account:await accountData(null)});response.headers.append('Set-Cookie',sessionHeader('',0));return response;}
  const now=Date.now();
  if(!await rate('auth:'+await hash(clientIp(r)),300,3600000))return fail('محاولات كثيرة الآن. حاول لاحقًا.',429);
  if(p.action==='confirm-profile'||p.action==='decline-profile'){
   const e=await sessionEmployee(r);if(!e)return fail('تحقق من رقم جوالك أولًا.',401);
   await ensureProspectiveEmployees();
   const error=await (p.action==='confirm-profile'?confirmProfile(e,p.id,p.revision):declineProfile(e,p.id,p.revision));if(error)return error;
   return await renewEmployeeSession(r,reply({ok:true,account:await accountData(await sessionEmployee(r))}));
  }
  if(p.action==='update-department'){
   const e=await sessionEmployee(r);if(!e?.name.trim()||!readRoles(e.roles).length)return fail('أكمل بيانات التسجيل أولًا.',401);
   const saved=await db.prepare('UPDATE employees SET department=? WHERE id=? AND active=1 RETURNING department').bind(p.department,e.id).first<{department:string}>();
   if(!saved)return fail('تعذّر حفظ اسم الإدارة. حدّث الصفحة وحاول مجددًا.',409);
   return await renewEmployeeSession(r,reply({ok:true,account:await accountData({...e,...saved})}));
  }
  if(p.action==='update-roles'){
   const e=await sessionEmployee(r);if(!e?.name.trim()||!readRoles(e.roles).length)return fail('أكمل حسابك أولًا.',401);
   await db.prepare('UPDATE employees SET roles=? WHERE id=? AND active=1').bind(JSON.stringify(p.roles),e.id).run();
   return await renewEmployeeSession(r,reply({ok:true,account:await accountData({...e,roles:JSON.stringify(p.roles)})}));
  }
  if(p.action==='complete-profile'){
   const e=await sessionEmployee(r);if(!e)return fail('تحقق من رقم جوالك أولًا.',401);
   await ensureProspectiveEmployees();
   if(await suggestedProfile(e))return fail('أكد البيانات المقترحة أو اختر «لست أنا» قبل إكمال حسابك.',409);
   // This credential belongs to the verified phone. No caller-supplied account ID is accepted.
   if(e.name.trim()&&readRoles(e.roles).length)return fail('حسابك مكتمل بالفعل. يمكنك تعديل أدوارك من حسابي.',409);
   const updated:any=await db.prepare("UPDATE employees SET name=CASE WHEN TRIM(name)='' THEN ? ELSE name END,department=?,roles=? WHERE id=? AND active=1 AND name=? AND roles=? RETURNING id,name,department,roles").bind(e.name.trim()||p.name,p.department,JSON.stringify(p.roles),e.id,e.name,e.roles).first();
   if(!updated)return fail('تغيّر ملفك الشخصي. حدّث الصفحة للمتابعة.',409);
   return await renewEmployeeSession(r,reply({ok:true,needsName:false,account:await accountData({...e,...updated})}));
  }
  if(p.action==='request'){
   if(!otpReady())return fail('إرسال رموز التحقق لم يُفعّل بعد. تواصل مع مدير النظام.',503);
   const phone=p.phone;
   if(!await rate('otp:'+await hash(phone),5,900000))return fail('انتظر قليلًا قبل طلب رمز جديد.',429);
   const existing:any=await db.prepare('SELECT active FROM employees WHERE phone=?').bind(phone).first();const id=crypto.randomUUID();
   // A blocked account cannot self-register again. Do not disclose account status.
   if(!existing||existing.active){
    const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
    await db.batch([db.prepare('UPDATE phone_otps SET used=1 WHERE phone=?').bind(phone),db.prepare('INSERT INTO phone_otps(id,phone,digest,expires_at) VALUES(?,?,?,?)').bind(id,phone,await hash(id+':'+code),now+600000)]);
    try{const settings=await policy();await sendOtp(phone,code,settings.otp_channel==='whatsapp'?'whatsapp':'sms');}
    catch(error){await db.prepare('UPDATE phone_otps SET used=1 WHERE id=?').bind(id).run();return fail(otpFailureMessage(error,'send'),503);}
   }
   await db.batch([db.prepare('DELETE FROM phone_otps WHERE expires_at<?').bind(now-86400000),keepSessionProof(db,'expired',now),db.prepare('DELETE FROM employee_sessions WHERE expires_at<?').bind(now),db.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(now)]);
   return reply({id,message:'أرسلنا رمز التحقق إذا كان الدخول متاحًا لهذا الرقم. أدخل أحدث رمز وصلك.'},202);
  }
  const otp:any=await db.prepare('UPDATE phone_otps SET attempts=attempts+1 WHERE id=? AND used=0 AND expires_at>? AND attempts<5 RETURNING *').bind(p.id,now).first();
  const invalid=()=>fail('الرمز غير صحيح أو انتهت صلاحيته. يمكنك طلب رمز جديد.',400);
  if(!otp||await hash(p.id+':'+normalizeNumber(p.code))!==otp.digest)return invalid();
  const existing:any=await db.prepare('SELECT active FROM employees WHERE phone=?').bind(otp.phone).first();if(existing&&!existing.active)return invalid();
  try{if(!await verifyOtp(otp.phone,normalizeNumber(p.code)))return invalid();}catch(error){return fail(otpFailureMessage(error,'verify'),503);}
  const claimed=await db.prepare('UPDATE phone_otps SET used=1 WHERE id=? AND used=0 AND expires_at>? RETURNING id').bind(p.id,Date.now()).first();if(!claimed)return invalid();
  // Phone uniqueness makes simultaneous verified sign-ins share one account.
  // No account exists before verification. Empty name grants profile completion only.
  await db.prepare("INSERT INTO employees(id,phone,name,department,active,created_at) VALUES(?,?,'','',1,?) ON CONFLICT(phone) DO NOTHING").bind(crypto.randomUUID(),otp.phone,Date.now()).run();
  const e:any=await db.prepare('SELECT id,number,phone,name,email,department,roles FROM employees WHERE phone=? AND active=1').bind(otp.phone).first();if(!e)return invalid();
  const secret=token();
  // A successful sign-in is durable even when its session expires or is revoked.
  await db.batch([
   db.prepare('INSERT INTO employee_sessions(digest,employee_id,expires_at) VALUES(?,?,?)').bind(await hash(secret),e.id,Date.now()+sessionMaxAge*1000),
   markPortalAccess(db,e.id,Date.now())
  ]);const response=reply({ok:true,needsName:!e.name.trim()||!readRoles(e.roles).length,needsProfile:!e.name.trim()||!readRoles(e.roles).length||!profileDepartment(e.department),account:await accountData(e)});response.headers.append('Set-Cookie',sessionHeader(secret));return response;
 }catch{return fail('تعذّر إكمال الدخول. حاول مجددًا.',500);}
}
