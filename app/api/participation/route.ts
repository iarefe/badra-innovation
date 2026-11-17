import {keepSessionProof} from '@/lib/server/portal-access';
import {z} from 'zod';
import {readRoles} from '@/lib/participant-roles';
import {normalizePhone} from '@/lib/phone';
import {checkOtpConnection,OtpProviderError} from '@/lib/server/otp-provider';
import {database,viewer,reply,fail,sameOrigin} from '@/lib/server/access';
import {policy,otpReady,normalizeNumber,audit,rate} from '@/lib/server/employee';
export const dynamic='force-dynamic';
const staff=z.object({number:z.string().trim().min(1).max(32).transform(normalizeNumber).refine(n=>/^[A-Za-z0-9_-]+$/.test(n)),phone:z.string().min(1).max(32).transform(normalizePhone).refine(Boolean),name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(200).transform(s=>s.toLowerCase()),department:z.string().trim().min(2).max(100)});
const otpChannels=z.enum(['sms','whatsapp']);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('check-otp')}),
 z.object({action:z.literal('otp-channel'),channel:otpChannels,revision:z.number().int()}),
 z.object({action:z.literal('import'),employees:z.array(staff).min(1).max(250)}),
 z.object({action:z.literal('update'),id:z.string().uuid(),phone:staff.shape.phone,name:staff.shape.name,email:staff.shape.email.nullish().or(z.literal('')),department:z.string().trim().max(100).optional()}),
 z.object({action:z.literal('active'),id:z.string().uuid(),active:z.boolean()})
]);
export async function GET(r:Request){try{if(!(await viewer(r)).manager)return fail('هذه الصفحة لمدير النظام.',403);const db=database();const [p,employees,logs]=await Promise.all([policy(),db.prepare('SELECT id,number,phone,name,email,department,active,roles FROM employees ORDER BY name').all(),db.prepare('SELECT action,created_at,COUNT(*) OVER() AS log_total FROM security_audit ORDER BY created_at DESC LIMIT 12').all()]);const legacy:any=await db.prepare("SELECT COUNT(*) n FROM challenge_votes WHERE user_id NOT LIKE 'employee:%'").first();return reply({employees:employees.results.map((e:any)=>({...e,roles:readRoles(e.roles)})),revision:p.revision,otpReady:otpReady(),channel:p.otp_channel==='whatsapp'?'whatsapp':'sms',channels:otpChannels.options,logs:logs.results.map((x:any)=>({action:x.action,created_at:x.created_at})),logTotal:Number((logs.results[0] as any)?.log_total??0),legacyVotes:legacy.n});}catch{return fail('تعذّر تحميل إعدادات المشاركة.',500);}}
export async function POST(r:Request){try{if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);const v=await viewer(r);if(!v.manager)return fail('هذه الصفحة لمدير النظام.',403);const raw=await r.text();if(raw.length>100000)return fail('قسّم قائمة الموظفين إلى دفعات أصغر.',413);const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return fail('تحقق من البيانات: الرقم الوظيفي والاسم والجوال والبريد والإدارة.');const p=parsed.data,db=database();
 if(p.action==='check-otp'){
  if(!await rate('otp-check:'+v.id,3,60000))return fail('انتظر دقيقة قبل إعادة فحص الاتصال.',429);
  try{return reply({ok:true,message:await checkOtpConnection()});}catch(e){return fail(e instanceof OtpProviderError?e.message:'تعذّر فحص اتصال الخدمة.',503);}
 }
 if(p.action==='otp-channel'){
  await db.prepare('INSERT OR IGNORE INTO participation_settings(id) VALUES(1)').run();
  const updated=await db.prepare('UPDATE participation_settings SET otp_channel=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING id').bind(p.channel,p.revision).first();if(!updated)return fail('تغيّرت الإعدادات. حدّث الصفحة وأعد المحاولة.',409);
  await audit(v.id,'تحديث قناة رموز التحقق');return reply({ok:true});
 }
 if(p.action==='import'){
  const numbers=new Set<string>(),emails=new Set<string>(),phones=new Set<string>();for(const e of p.employees){if(numbers.has(e.number)||emails.has(e.email)||phones.has(e.phone))return fail('توجد أرقام وظيفية أو جوالات أو عناوين بريد مكررة في الدفعة.');numbers.add(e.number);emails.add(e.email);phones.add(e.phone);}
  // Imports add new employees only. Identity changes must not transfer an existing voting identity.
  const current=await db.prepare('SELECT number,email,phone FROM employees').all();const conflicts=(current.results as any[]).some(e=>numbers.has(e.number)||emails.has(e.email)||phones.has(e.phone));if(conflicts)return fail('رقم وظيفي أو جوال أو بريد موجود مسبقًا. أزل الصف المكرر من الدفعة. لن تتغير السجلات الحالية.',409);
  const statements=p.employees.map(e=>db.prepare('INSERT INTO employees(id,number,name,email,department,phone,active,created_at,signed_in) VALUES(?,?,?,?,?,?,1,?,0)').bind(crypto.randomUUID(),e.number,e.name,e.email,e.department,e.phone,Date.now()));await db.batch(statements);await audit(v.id,`إضافة ${p.employees.length} موظفًا`);
 }else if(p.action==='update'){
  const e:any=await db.prepare('SELECT id,phone FROM employees WHERE id=?').bind(p.id).first();if(!e)return fail('الموظف غير موجود.',404);
  const duplicate=await db.prepare('SELECT id FROM employees WHERE (email=? OR phone=?) AND id<>?').bind(p.email||null,p.phone,p.id).first();if(duplicate)return fail('البريد أو الجوال مرتبط بموظف آخر.',409);
  await db.batch([db.prepare('UPDATE employees SET name=?,email=?,department=COALESCE(?,department),phone=? WHERE id=?').bind(p.name,p.email||null,p.department??null,p.phone,p.id),db.prepare('UPDATE prospective_employees SET phone=?,revision=revision+1,updated_at=? WHERE linked_employee_id=?').bind(p.phone,Date.now(),p.id),db.prepare('UPDATE phone_otps SET used=1 WHERE phone=?').bind(p.phone),keepSessionProof(db,'employee',p.id),db.prepare('DELETE FROM employee_sessions WHERE employee_id=?').bind(p.id),db.prepare('UPDATE employee_otps SET used=1 WHERE employee_id=?').bind(p.id),db.prepare('UPDATE phone_otps SET used=1 WHERE phone=?').bind(e.phone)]);await audit(v.id,'تحديث بيانات موظف وإلغاء جلساته');
 }else{
  const e:any=await db.prepare('SELECT id,phone FROM employees WHERE id=?').bind(p.id).first();if(!e)return fail('الموظف غير موجود.',404);
  await db.batch([db.prepare('UPDATE employees SET active=? WHERE id=?').bind(p.active?1:0,p.id),keepSessionProof(db,'employee',p.id),db.prepare('DELETE FROM employee_sessions WHERE employee_id=?').bind(p.id),db.prepare('UPDATE employee_otps SET used=1 WHERE employee_id=?').bind(p.id),db.prepare('UPDATE phone_otps SET used=1 WHERE phone=?').bind(e.phone)]);await audit(v.id,p.active?'تفعيل موظف':'إيقاف موظف وإلغاء جلساته');
 }
 return reply({ok:true});
}catch{return fail('تعذّر حفظ البيانات. تحقق من عدم تكرار الأرقام الوظيفية أو الجوالات أو عناوين البريد.',400);}}
