import {z} from 'zod';
import {normalizePhone} from '@/lib/phone';
import {database,reply,fail,sameOrigin,isManagerPhone} from '@/lib/server/access';
import {sessionEmployee} from '@/lib/server/employee';
import {readRoles} from '@/lib/participant-roles';
import {avatarBucket} from '@/lib/server/avatar';
import {ensureProspectiveEmployees,prospectiveAvatarUrl,type ProspectiveRow} from '@/lib/server/prospective-employees';
export const dynamic='force-dynamic';
const isManager=(e:Awaited<ReturnType<typeof sessionEmployee>>)=>!!e?.name.trim()&&readRoles(e?.roles).length>0&&isManagerPhone(e?.phone);
export async function GET(r:Request){try{
 const e=await sessionEmployee(r),manager=isManager(e),params=new URL(r.url).searchParams;
 if(params.has('avatar')){
  const id=z.string().uuid().safeParse(params.get('avatar'));if(!e||!id.success)return fail('الصورة غير متاحة.',404);
  const row=await database().prepare('SELECT * FROM prospective_employees WHERE id=?').bind(id.data).first<ProspectiveRow>();
  if(!row||(!manager&&(row.linked_employee_id?row.linked_employee_id!==e.id:row.phone!==e.phone)))return fail('الصورة غير متاحة.',404);
  const object=await avatarBucket()?.get(row.avatar_key);if(!object)return fail('الصورة غير متاحة.',404);
  return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(!manager)return fail('هذه الصفحة لمدير النظام.',403);
 await ensureProspectiveEmployees();
 const rows=await database().prepare(`SELECT p.*,linked.name linked_name,registered.id registered_id,registered.name registered_name,
  EXISTS(SELECT 1 FROM prospective_declines d WHERE d.employee_id=registered.id AND d.prospective_id=p.id AND d.revision=p.revision) declined
  FROM prospective_employees p LEFT JOIN employees linked ON p.linked_employee_id=linked.id LEFT JOIN employees registered ON p.phone=registered.phone ORDER BY p.name`).all();
 return reply({prospects:rows.results.map((p:any)=>({id:p.id,name:p.name,phone:p.phone,avatarUrl:prospectiveAvatarUrl(p),revision:p.revision,linkedEmployeeId:p.linked_employee_id,linkedName:p.linked_name,registeredEmployeeId:p.registered_id,registeredName:p.registered_name,declined:!!p.declined}))});
 }catch{return fail('تعذّر تحميل الموظفين المحتملين. حاول مجددًا.',503);}}
const schema=z.object({action:z.literal('assign-phone'),id:z.string().uuid(),revision:z.number().int().min(0),phone:z.string().max(32).transform(normalizePhone).refine(Boolean)});
export async function POST(r:Request){try{
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 const e=await sessionEmployee(r);if(!isManager(e))return fail('هذه الصفحة لمدير النظام.',403);
 const text=await r.text();if(text.length>1000)return fail('طلب غير صالح.',413);
 const parsed=schema.safeParse(JSON.parse(text));if(!parsed.success)return fail('تحقق من رقم الجوال والبيانات.');
 const p=parsed.data,db=database();
 const row=await db.prepare('SELECT * FROM prospective_employees WHERE id=?').bind(p.id).first<ProspectiveRow>();
 if(!row)return fail('السجل غير موجود.',404);
 if(row.linked_employee_id)return fail('سبق تأكيد هذا السجل. لتغيير الجوال، عدّل بيانات حساب المشارك المرتبط به.',409);
 if(row.revision!==p.revision)return fail('عدّل مدير آخر هذا السجل. حدّث القائمة ثم حاول مجددًا.',409);
 if(row.phone===p.phone)return reply({ok:true,message:'هذا الرقم مرتبط بالسجل بالفعل.'});
 const conflict=await db.prepare(`SELECT id FROM prospective_employees WHERE (phone=? AND id<>?) OR linked_employee_id=(SELECT id FROM employees WHERE phone=?)`).bind(p.phone,p.id,p.phone).first();
 if(conflict)return fail('الجوال مرتبط بسجل موظف محتمل آخر. راجع الربط الحالي أولًا.',409);
 const assigned=await db.prepare(`UPDATE prospective_employees SET phone=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND linked_employee_id IS NULL RETURNING id`).bind(p.phone,Date.now(),p.id,p.revision).first();
 if(!assigned)return fail('تغيّر السجل. حدّث القائمة ثم حاول مجددًا.',409);
 await db.prepare('INSERT INTO security_audit(id,actor,action,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),'employee:'+e!.id,'تحديث جوال موظف محتمل لطلب تأكيد بياناته',Date.now()).run();
 return reply({ok:true,message:'حُفظ الربط. سيظهر طلب تأكيد الاسم والصورة للمشارك عند دخوله أو فتح حسابي.'});
 }catch{return fail('تعذّر حفظ الربط. قد يكون الجوال مرتبطًا بسجل آخر.',409);}}
