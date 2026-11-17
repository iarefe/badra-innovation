import {acceptSubmissionSQL,intakeDenied,currentIntake} from '@/lib/server/submission-intake';
import {challengeData} from '@/lib/server/site-data';
import {z} from 'zod';
import {challengeSchema,domains} from '@/lib/challenges';
import {database,sameOrigin,reply,fail,settings,ensureSettings} from '@/lib/server/access';
import {participationGate} from '@/lib/server/employee';
import {withParticipant} from '@/lib/server/participant';
import {coverBucket,readCover} from '@/lib/server/challenge-cover';
export const dynamic='force-dynamic';
export async function GET(r:Request){return withParticipant(r,async v=>{try{const [d,s]=await Promise.all([challengeData(v),settings()]);return reply({...d,votingOpen:!!s.open&&!s.finalized,joiningOpen:!!s.joining_open&&!s.finalized});}catch{return fail('تعذّر تحميل التحديات. حاول مرة أخرى.',500);}});}

export async function POST(r:Request){return withParticipant(r,async v=>{
 try{
  if(!sameOrigin(r))return fail('طلب غير مسموح.',403);
  const gate=await participationGate(r,v);if(gate)return gate;
  const raw=await r.text();if(raw.length>16000)return fail('حجم الوصف كبير.');
  const p=z.object({id:z.string().uuid().optional(),challenge:challengeSchema,submit:z.boolean()}).safeParse(JSON.parse(raw));
  if(!p.success)return fail('أكمل الحقول المطلوبة؛ وصف التحدي ٤٠ حرفًا على الأقل، والأثر ٣٠ حرفًا.');
  const {id,challenge,submit}=p.data;
  if((!id||submit)&&(await currentIntake()).phase!=='open')return intakeDenied();
  if(submit&&(!challenge.ownership||!challenge.initialSolutionStatus||(challenge.ownership==='shared'&&challenge.coOwners.length<2)||(challenge.initialSolutionStatus==='implemented'&&challenge.initialSolution.length<10)))return fail('أكمل ملكية التحدي وبيانات تجربة الحل الأولي.');
  if(challenge.ownership==='individual')challenge.coOwners='';
  if(challenge.initialSolutionStatus==='none'){challenge.initialSolution='';challenge.initialSolutionOutcome='';}
  challenge.author=v.employeeName?.slice(0,60)||challenge.author;
  if(submit&&challenge.need.trim().length<10)return fail('وضّح ما يحاول المتأثرون إنجازه قبل نشر التحدي.');
  const db=database(),now=Date.now(),status=submit?'published':'draft';
  if(id){
   const old:any=await db.prepare('SELECT * FROM challenges WHERE id=?').bind(id).first();
   if(!old||(!v.manager&&old.owner!==v.id))return fail('ليس لديك صلاحية تعديل هذا التحدي.',403);
   if(old.status==='published')return fail('افتح «تعديل التحدي» من بطاقته المنشورة لتحفظ تعديلاتك مع بقاء الأصوات ورغبات الانضمام.',409);
   const saved=await db.prepare(`UPDATE challenges SET payload=?,status=?,review_note='',published_at=?,updated_at=? WHERE id=? AND status!='published' AND (?=0 OR ${acceptSubmissionSQL}) RETURNING id`)
    .bind(JSON.stringify(challenge),status,submit?now:null,now,id,submit?1:0).first();
   if(!saved&&submit&&await db.prepare('SELECT 1 WHERE NOT '+acceptSubmissionSQL).first())return intakeDenied();
   if(!saved)return fail('تغيّرت حالة التحدي. حدّث الصفحة وحاول مجددًا.',409);
   return reply({id,status});
  }
  const n:any=await db.prepare('SELECT COUNT(*) n FROM challenges WHERE owner=? AND created_at>?').bind(v.id,now-3600000).first();
  if(n.n>=15)return fail('وصلت إلى حد الإضافات خلال الساعة. حاول لاحقًا.',429);
  const newId=crypto.randomUUID();
  const created=await db.prepare(`INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE ${acceptSubmissionSQL} RETURNING id`)
   .bind(newId,v.id,JSON.stringify(challenge),status,now,submit?now:null,now).first();
  if(!created)return intakeDenied();
  return reply({id:newId,status});
 }catch{return fail('تعذّر حفظ التحدي. احتفظ بالنص وحاول مجددًا.',500);}
});}

export async function PATCH(r:Request){return withParticipant(r,async v=>{
 try{
  if(!sameOrigin(r))return fail('طلب غير مسموح.',403);
  const p=z.union([
   z.object({id:z.string().uuid(),action:z.literal('category'),domain:z.enum(domains),previousDomain:z.string().max(60)}).strict(),
   z.object({id:z.string().uuid(),action:z.enum(['withdraw','vote','interest']),active:z.boolean().optional()})
  ]).parse(await r.json());
  const db=database(),c:any=await db.prepare('SELECT * FROM challenges WHERE id=?').bind(p.id).first();
  if(!c)return fail('التحدي غير موجود.',404);
  if(p.action==='category'){
   if(!v.manager){const gate=await participationGate(r,v);if(gate)return gate;}
   if(!v.manager&&c.owner!==v.id)return fail('تعديل الفئة متاح لصاحب التحدي أو مدير النظام فقط.',403);
   if((await settings()).finalized)return fail('القائمة معتمدة. يمكن تعديل الفئة بعد أن يعيد المدير فتحها.',409);
   const previous=JSON.parse(c.payload).domain;
   if(previous!==p.previousDomain)return reply({error:'تغيّرت الفئة من نافذة أخرى. راجع الفئة الحالية ثم أعد اختيارك.',currentDomain:previous},409);
   if(previous===p.domain)return reply({ok:true,domain:previous});
   // Change only category metadata. The payload, publication time, votes and interests
   // remain intact. Recheck access, the final-list lock and the prior value atomically.
   const eligible="id=? AND (?=1 OR owner=?) AND json_extract(payload,'$.domain')=? AND NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND finalized=1)";
   const args=[p.id,v.manager?1:0,v.id,p.previousDomain],now=Date.now();
   const result=await db.batch([
    db.prepare('INSERT INTO security_audit(id,actor,action,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM challenges WHERE '+eligible+')').bind(crypto.randomUUID(),v.id,'تعديل فئة تحدي: '+p.id+' · من '+previous+' إلى '+p.domain,now,...args),
    db.prepare("UPDATE challenges SET payload=json_set(payload,'$.domain',?),updated_at=? WHERE "+eligible+' RETURNING id').bind(p.domain,now,...args)
   ]);
   if(!result[1].results?.length)return fail('تغيّرت الفئة أو حالة القائمة. حدّث الصفحة وحاول مجددًا.',409);
   return reply({ok:true,domain:p.domain});
  }
  if(p.action==='interest'){
   const gate=await participationGate(r,v);if(gate)return gate;
   if(typeof p.active!=='boolean')return fail('حدد رغبتك بالانضمام.');
   if(c.owner===v.id)return fail('هذا تحدّيك؛ يمكنك تسجيل رغبتك بالانضمام إلى تحديات الآخرين.',403);
   if(c.status!=='published')return fail('التحدي غير متاح لتسجيل رغبات الانضمام.',404);
   const engagement=await settings();if(!engagement.joining_open||engagement.finalized)return fail('الانضمام مغلق حاليًا.',409);
   if(p.active)await db.prepare("INSERT OR IGNORE INTO challenge_interests(challenge_id,employee_id,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND joining_open=1 AND finalized=0 AND engagement_controls_initialized=1) AND EXISTS(SELECT 1 FROM challenges WHERE id=? AND status='published' AND owner<>?)").bind(p.id,v.employeeId!,Date.now(),p.id,v.id).run();
   else await db.prepare('DELETE FROM challenge_interests WHERE challenge_id=? AND employee_id=? AND EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND joining_open=1 AND finalized=0 AND engagement_controls_initialized=1)').bind(p.id,v.employeeId!).run();
   return reply({ok:true});
  }
  if(p.action==='vote'){
   if(typeof p.active!=='boolean')return fail('حدد حالة التصويت.');
   const gate=await participationGate(r,v);if(gate)return gate;
   if(c.owner===v.id)return fail('لا يمكنك التصويت على تحدّيك. صوّت للتحديات التي طرحها الآخرون.',403);
   if(c.status!=='published')return fail('التحدي غير متاح للتصويت.',404);
   await ensureSettings();const voting=await settings();if(!voting.open||voting.finalized)return fail('التصويت مغلق حاليًا.',409);
   if(p.active)await db.prepare("INSERT OR IGNORE INTO challenge_votes(challenge_id,user_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND open=1 AND finalized=0 AND engagement_controls_initialized=1) AND EXISTS(SELECT 1 FROM challenges WHERE id=? AND status='published' AND owner<>?)").bind(p.id,v.id,p.id,v.id).run();
   else await db.prepare('DELETE FROM challenge_votes WHERE challenge_id=? AND user_id=? AND EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND open=1 AND finalized=0 AND engagement_controls_initialized=1)').bind(p.id,v.id).run();
   if(!v.manager)return reply({ok:true});
   const count:any=await db.prepare("SELECT COUNT(*) n FROM challenge_votes x JOIN challenges c ON c.id=x.challenge_id WHERE x.challenge_id=? AND x.user_id LIKE 'employee:%' AND x.user_id<>c.owner").bind(p.id).first();
   return reply({ok:true,votes:count.n});
  }
  if(!v.manager){const gate=await participationGate(r,v);if(gate)return gate;}
  if(!v.manager&&c.owner!==v.id)return fail('هذه العملية لصاحب التحدي أو مدير النظام.',403);
  if((await settings()).finalized)return fail('أعد فتح التصويت من إدارة الهاكاثون قبل تغيير التحديات المعتمدة.',409);
  const results=await db.batch([
   db.prepare("UPDATE challenges SET status='draft',review_note='',published_at=NULL,updated_at=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND finalized=1) RETURNING id").bind(Date.now(),p.id),
   db.prepare("DELETE FROM challenge_votes WHERE challenge_id=? AND EXISTS(SELECT 1 FROM challenges WHERE id=? AND status='draft')").bind(p.id,p.id),
   db.prepare("DELETE FROM challenge_interests WHERE challenge_id=? AND EXISTS(SELECT 1 FROM challenges WHERE id=? AND status='draft')").bind(p.id,p.id)
  ]);
  if(!results[0].results?.length)return fail('تغيّرت حالة التحدي أو أُغلقت القائمة. حدّث الصفحة.',409);
  return reply({ok:true});
 }catch{return fail('تعذّر تنفيذ الإجراء. حاول مجددًا.',400);}
});}

export async function DELETE(r:Request){return withParticipant(r,async v=>{
 try{
  if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
  if(!v.manager&&!v.employeeId)return fail('حذف التحدي لصاحبه أو لمدير النظام.',403);
  const input=z.object({id:z.string().uuid()}).safeParse(await r.json());
  if(!input.success)return fail('حدد التحدي المطلوب حذفه.');
  const id=input.data.id,db=database();
  const row=await db.prepare('SELECT owner,status FROM challenges WHERE id=?').bind(id).first<{owner:string;status:string}>();
  if(!row)return fail('التحدي غير موجود.',404);
  if(!v.manager&&row.owner!==v.id)return fail('لا يمكنك حذف تحدي شخص آخر.',403);
  if(!v.manager&&row.status==='published'&&(await settings()).finalized)return fail('القائمة معتمدة. لا يمكن حذف التحدي المنشور حتى يعيد المدير فتحها.',409);
  const cover=await readCover(id);
  // Recheck the verified owner and the workshop lock *inside* the transaction.
  const allowed="id=? AND (?=1 OR (owner=? AND (status<>'published' OR NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND finalized=1))))";
  const eligible='EXISTS(SELECT 1 FROM challenges WHERE '+allowed+')',args=[id,v.manager?1:0,v.id];
  const result=await db.batch([
   db.prepare('DELETE FROM workshop_selection WHERE challenge_id=? AND '+eligible).bind(id,...args),
   db.prepare('UPDATE workshop_settings SET revision=revision+1 WHERE id=1 AND '+eligible).bind(...args),
   db.prepare('INSERT INTO security_audit(id,actor,action,created_at) SELECT ?,?,?,? WHERE '+eligible).bind(crypto.randomUUID(),v.id,'حذف تحدي: '+id,Date.now(),...args),
   db.prepare('DELETE FROM challenges WHERE '+allowed+' RETURNING id').bind(...args)
  ]);
  if(!result[3].results?.length)return fail('تغيّرت حالة التحدي. حدّث الصفحة وحاول مجددًا.',409);
  if(cover?.object_key)try{await coverBucket()?.delete(cover.object_key)}catch{console.warn('challenge_cover_cleanup_failed',{challengeId:id})}
  return reply({ok:true});
 }catch{return fail('تعذّر حذف التحدي. حاول مجددًا.',500);}
});}
