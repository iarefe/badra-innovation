import {withinIntakeSQL} from '@/lib/server/submission-intake';
import {workshopData} from '@/lib/server/site-data';
import {z} from 'zod';
import {database,viewer,sameOrigin,reply,fail,settings,ensureSettings,rankedSQL} from '@/lib/server/access';
import {audit} from '@/lib/server/employee';
import {withParticipant} from '@/lib/server/participant';
export const dynamic='force-dynamic';
export async function GET(r:Request){return withParticipant(r,async v=>{try{return reply(await workshopData(v));}catch{return fail('تعذّر تحميل بيانات الهاكاثون.',500);}});}
export async function POST(r:Request){try{
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);const v=await viewer(r);if(!v.manager)return fail('الإعداد متاح لمدير النظام فقط.',403);
 const p=z.object({action:z.enum(['configure','pause','resume','finalize','reopen','pause-intake','resume-intake','pause-joining','resume-joining']),count:z.number().int().min(1).max(20).optional(),title:z.string().trim().min(5).max(100).optional(),revision:z.number().int()}).parse(await r.json());await ensureSettings();const db=database();const s=await settings();if(p.revision!==s.revision)return fail('تغيّرت الإعدادات. حدّث الصفحة ثم أعد المحاولة.',409);
 if(p.action==='pause-intake'||p.action==='resume-intake'){
  // 0 follows the calendar; 1 closes intake; 2 extends intake outside the calendar.
  const mode=p.action==='pause-intake'?'1':`CASE WHEN ${withinIntakeSQL} THEN 0 ELSE 2 END`;
  const changed=await db.prepare(`UPDATE workshop_settings SET intake_paused=${mode},revision=revision+1 WHERE id=1 AND revision=? AND finalized=0 AND intake_paused<>(${mode}) RETURNING id`).bind(s.revision).first();
  if(!changed)return fail('القائمة معتمدة أو تغيّرت حالة الاستقبال. حدّث الصفحة للاطلاع على الحالة الحالية.',409);
 }else if(p.action==='pause-joining'||p.action==='resume-joining'){
  if(s.finalized)return fail('القائمة معتمدة؛ ألغِ الاعتماد قبل فتح الانضمام.',409);
  const changed=await db.prepare('UPDATE workshop_settings SET joining_open=?,revision=revision+1 WHERE id=1 AND revision=? AND finalized=0 RETURNING id').bind(p.action==='resume-joining'?1:0,p.revision).first();
  if(!changed)return fail('تغيّرت الإعدادات. حدّث الصفحة.',409);
 }else if(p.action==='configure'){
  if(s.finalized)return fail('ألغِ اعتماد القائمة قبل تغيير إعداداتها.',409);
  const changed=await db.prepare('UPDATE workshop_settings SET title=?,count=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING id').bind(p.title||s.title,p.count||s.count,p.revision).first();if(!changed)return fail('تغيّرت الإعدادات. حدّث الصفحة.',409);
 }else if(p.action==='finalize'){
  const n:any=await db.prepare("SELECT COUNT(*) n FROM challenges WHERE status='published'").first();if(!n.n)return fail('انشر تحديًا واحدًا على الأقل قبل اعتماد القائمة.');if(s.finalized)return fail('القائمة معتمدة بالفعل.',409);
  // Batch is atomic. Snapshot statements are gated by the exact post-update revision.
  const results:any=await db.batch([
   db.prepare('UPDATE workshop_settings SET open=0,joining_open=0,finalized=1,revision=revision+1 WHERE id=1 AND revision=? RETURNING id').bind(p.revision),
   db.prepare('DELETE FROM workshop_selection WHERE EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND revision=? AND finalized=1)').bind(p.revision+1),
   db.prepare(`INSERT OR IGNORE INTO workshop_selection(challenge_id,payload,votes,rank) SELECT id,payload,votes,ROW_NUMBER() OVER(ORDER BY votes DESC,published_at ASC,id ASC) FROM (${rankedSQL}) WHERE EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND revision=? AND finalized=1) LIMIT ?`).bind(p.revision+1,s.count)
  ]);if(!results[0].results?.length&&results[0].meta?.changes===0)return fail('تغيّرت الإعدادات. حدّث الصفحة.',409);
 }else{
  if(p.action==='reopen'&&await db.prepare('SELECT 1 FROM team_announcement WHERE id=1').first())return fail('أُعلنت الفرق وبدأت مرحلة بناء الحلول.',409);
  if(s.finalized&&p.action!=='reopen')return fail('القائمة معتمدة. استخدم إعادة فتح التصويت.',409);
  const changed=await db.prepare('UPDATE workshop_settings SET open=?,finalized=0,revision=revision+1 WHERE id=1 AND revision=? RETURNING id').bind(p.action==='pause'?0:1,p.revision).first();if(!changed)return fail('تغيّرت الإعدادات. حدّث الصفحة.',409);
 }
 await audit(v.id,({'pause-joining':'إغلاق الانضمام','resume-joining':'فتح الانضمام','pause-intake':'إيقاف استقبال التحديات الجديدة','resume-intake':'فتح استقبال التحديات',configure:'تحديث إعدادات الهاكاثون',pause:'إيقاف التصويت',resume:'فتح التصويت',finalize:'اعتماد القائمة وإغلاق التصويت',reopen:'إعادة فتح التصويت وإلغاء الاعتماد'})[p.action]);return reply({ok:true});
}catch{return fail('تعذّر حفظ إعدادات الهاكاثون.',400);}}
