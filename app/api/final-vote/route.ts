import {z} from 'zod';
import {database,viewer,reply,fail,sameOrigin} from '@/lib/server/access';
import {audit} from '@/lib/server/employee';
import type {BallotPhase,FinalBallotTeam,FinalBallotView,FinalBallotAdmin} from '@/lib/final-ballot';

export const dynamic='force-dynamic';
const id=z.string().uuid();
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('open')}),z.object({action:z.literal('close')}),
 z.object({action:z.literal('attendance'),person:id,attending:z.boolean()}),
 z.object({action:z.literal('vote'),team:id}),
]);
const finalists="FROM event_teams t JOIN challenges c ON c.id=t.id JOIN workshop_selection s ON s.challenge_id=t.id WHERE c.status='published'";
const teamProjection="t.id,json_extract(c.payload,'$.title') title,s.rank";
const dbPhase=async()=>((await database().prepare('SELECT phase FROM final_ballot_settings WHERE id=1').first<{phase:BallotPhase}>())?.phase??'not_open');

export async function GET(r:Request){
 const v=await viewer(r),admin=new URL(r.url).searchParams.get('admin')==='1',db=database();
 if(admin&&!v.manager)return fail('سجل الحضور والحصيلة مخصّصان للإدارة.',v.signedIn?403:401);
 if(admin){
  const [phase,roster,counts]=await Promise.all([
   dbPhase(),
   db.prepare('SELECT e.id,e.name,a.person IS NOT NULL attending FROM employees e LEFT JOIN final_session_attendance a ON a.person=e.id WHERE e.active=1 OR a.person IS NOT NULL ORDER BY e.name,e.id').all<{id:string;name:string;attending:number}>(),
   db.prepare(`SELECT ${teamProjection},(SELECT COUNT(*) FROM final_solution_ballots b WHERE b.team=t.id) votes ${finalists} ORDER BY s.rank`).all<FinalBallotTeam&{votes:number}>(),
  ]);
  const teams=counts.results;
  const data:FinalBallotAdmin={phase,teams,people:roster.results.map(p=>({...p,attending:!!p.attending})),cast:teams.reduce((sum,t)=>sum+t.votes,0)};
  return reply(data);
 }
 const me=v.employee?v.id.slice('employee:'.length):null;
 const [phase,entries,attendance,vote]=await Promise.all([
  dbPhase(),
  db.prepare(`SELECT ${teamProjection} ${finalists} ORDER BY s.rank`).all<FinalBallotTeam>(),
  me?db.prepare('SELECT 1 FROM final_session_attendance WHERE person=?').bind(me).first():null,
  me?db.prepare("SELECT b.team,json_extract(c.payload,'$.title') title FROM final_solution_ballots b JOIN challenges c ON c.id=b.team WHERE b.person=?").bind(me).first<{team:string;title:string}>():null,
 ]);
 const data:FinalBallotView={phase,signedIn:!!me,attending:!!attendance,teams:entries.results,vote};
 return reply(data);
}

export async function POST(r:Request){
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 const v=await viewer(r);
 if(!v.employee)return fail('سجّل الدخول بحساب الموظف أولًا.',401);
 const p=command.safeParse(await r.json().catch(()=>null));
 if(!p.success)return fail('تعذّر فهم الطلب. حدّث الصفحة وحاول مجددًا.');
 const db=database(),c=p.data,me=v.id.slice('employee:'.length),ok=()=>reply({ok:true});
 if(c.action==='vote'){
  // Check the open phase, finalist, attendance, account and the one-person constraint in a single write.
  const stored=await db.prepare(`INSERT INTO final_solution_ballots(person,team,cast_at)
   SELECT e.id,?,? FROM employees e JOIN final_session_attendance a ON a.person=e.id
   WHERE e.id=? AND e.active=1 AND (SELECT phase FROM final_ballot_settings WHERE id=1)='open'
   AND EXISTS(SELECT 1 ${finalists} AND t.id=?) ON CONFLICT(person) DO NOTHING`).bind(c.team,Date.now(),me,c.team).run();
  if(stored.meta.changes)return ok();
  const previous=await db.prepare('SELECT team FROM final_solution_ballots WHERE person=?').bind(me).first<{team:string}>();
  if(previous)return previous.team===c.team?ok():fail('سبق أن سجّلت صوتك لفريق آخر. لا يمكن تغيير الصوت المؤكّد.',409);
  if(await dbPhase()!=='open')return fail('تصويت الحضور غير مفتوح الآن.',409);
  if(!await db.prepare('SELECT 1 FROM final_session_attendance WHERE person=?').bind(me).first())return fail('اطلب من المنظّم تسجيل حضورك في جلسة العروض أولًا.',403);
  return fail('هذا الفريق غير متاح للتصويت.',404);
 }
 if(!v.manager)return fail('هذا الإجراء لمدير النظام فقط.',403);
 if(c.action==='attendance'){
  if(c.attending){
   const saved=await db.prepare('INSERT INTO final_session_attendance(person,checked_at) SELECT id,? FROM employees WHERE id=? AND active=1 ON CONFLICT(person) DO NOTHING').bind(Date.now(),c.person).run();
   if(saved.meta.changes)await audit(v.id,'تسجيل حضور موظف في جلسة العروض');
   else if(!await db.prepare('SELECT 1 FROM final_session_attendance WHERE person=?').bind(c.person).first())return fail('حساب الموظف غير متاح.',404);
  }else{
   const removed=await db.prepare('DELETE FROM final_session_attendance WHERE person=? AND NOT EXISTS(SELECT 1 FROM final_solution_ballots WHERE person=?)').bind(c.person,c.person).run();
   if(removed.meta.changes)await audit(v.id,'تصحيح حضور موظف في جلسة العروض');
   else if(await db.prepare('SELECT 1 FROM final_solution_ballots WHERE person=?').bind(c.person).first())return fail('لا يمكن إلغاء حضور موظف سجّل صوته.',409);
  }
  return ok();
 }
 if(c.action==='open'){
  const opened=await db.prepare(`INSERT INTO final_ballot_settings(id,phase) SELECT 1,'open'
   WHERE EXISTS(SELECT 1 ${finalists}) ON CONFLICT(id) DO UPDATE SET phase='open' WHERE phase<>'open'`).run();
  if(opened.meta.changes)await audit(v.id,'فتح تصويت الحضور على الحلول النهائية');
  else if(await dbPhase()!=='open')return fail('أعلن فرق التحديات قبل فتح تصويت الحضور.',409);
 }else{
  const closed=await db.prepare("UPDATE final_ballot_settings SET phase='closed' WHERE id=1 AND phase='open'").run();
  if(closed.meta.changes)await audit(v.id,'إغلاق تصويت الحضور على الحلول النهائية');
  else if(await dbPhase()!=='closed')return fail('لم يُفتح تصويت الحضور بعد.',409);
 }
 return ok();
}

