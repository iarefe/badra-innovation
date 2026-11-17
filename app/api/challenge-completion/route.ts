import {z} from 'zod';
import {challengeSchema,type Challenge} from '@/lib/challenges';
import {allowedSupplements,canSupplement,challengeGaps} from '@/lib/challenge-completion';
import {database,reply,fail,settings} from '@/lib/server/access';
import {participationGate} from '@/lib/server/employee';
import {withParticipant} from '@/lib/server/participant';
export const dynamic='force-dynamic';
const supplement=challengeSchema.pick({need:true,ownership:true,coOwners:true,initialSolutionStatus:true,initialSolution:true,initialSolutionOutcome:true}).partial().strict();
const input=z.object({id:z.string().uuid(),fields:supplement}).strict();

export async function POST(r:Request){return withParticipant(r,async v=>{
 try{
  const gate=await participationGate(r,v);if(gate)return gate;
  const raw=await r.text();if(raw.length>12000)return fail('حجم التفاصيل كبير.',413);
  const p=input.safeParse(JSON.parse(raw));if(!p.success)return fail('تحقق من التفاصيل التي تريد استكمالها.');
  const db=database(),old:any=await db.prepare('SELECT * FROM challenges WHERE id=?').bind(p.data.id).first();
  if(!old||old.owner!==v.id)return fail('استكمال هذه التفاصيل متاح لصاحب التحدي فقط.',403);
  if(old.status!=='published')return fail('تغيّرت حالة التحدي. حدّث الصفحة وأكمله من نموذج التعديل.',409);
  if((await settings()).finalized)return fail('اعتمد مدير النظام التحديات. يمكن الاستكمال بعد إعادة فتحها.',409);
  const current=JSON.parse(old.payload),fields=p.data.fields;
  if(!canSupplement(current))return fail('لا توجد تفاصيل ناقصة متاحة للاستكمال المباشر. حدّث الصفحة.',409);
  const allowed=allowedSupplements(current,fields);
  if(!Object.keys(fields).length||Object.keys(fields).some(key=>!allowed.has(key as keyof Challenge)))return fail('يمكن هنا إضافة التفاصيل الناقصة فقط. تبقى البيانات المكتملة كما هي.',409);
  const parsed=challengeSchema.safeParse({...current,...fields});
  if(!parsed.success||challengeGaps(parsed.data).length)return fail('أكمل التفاصيل المطلوبة، وحدد الشركاء ووصف التجربة إذا انطبقا.');
  const next={...current,...fields};
  // Compare the original payload as well as ownership/status: stale tabs cannot
  // overwrite new data. Never touch votes, interests, cover or publication date.
  const saved=await db.prepare(`UPDATE challenges SET payload=?,updated_at=?
   WHERE id=? AND owner=? AND status='published' AND payload=?
    AND NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND finalized=1) RETURNING id`)
   .bind(JSON.stringify(next),Date.now(),old.id,v.id,old.payload).first();
  if(!saved)return fail('تغيّرت بيانات التحدي أثناء الاستكمال. حدّث الصفحة وحاول مجددًا.',409);
  return reply({ok:true,challenge:next});
 }catch{return fail('تعذّر حفظ التفاصيل. احتفظ بما كتبته وحاول مجددًا.',500);}
});}
