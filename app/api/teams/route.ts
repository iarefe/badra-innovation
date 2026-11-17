import {announcedChallenges} from '@/lib/server/announced-teams';
import {z} from 'zod';
import {database,viewer,reply,fail,sameOrigin,rankedSQL,ensureSettings,settings} from '@/lib/server/access';
import {audit} from '@/lib/server/employee';
import {weighted} from '@/lib/team-card';
import {managerJudging} from '@/lib/server/team-judging';
export const dynamic='force-dynamic';
const uid=z.string().uuid(),team=uid,person=uid;
const deliveryUrl=z.union([z.literal(''),z.string().max(2000).url().regex(/^https:\/\//i)]);
const commands=z.discriminatedUnion('action',[
 z.object({action:z.literal('announce'),ids:z.array(uid).min(1).max(20),revision:z.number().int()}),
 z.object({action:z.literal('member'),team,person,enabled:z.boolean()}),
 z.object({action:z.literal('judge'),person,enabled:z.boolean()}),
 z.object({action:z.literal('audience'),team,value:z.number().min(0).max(30)}),
 z.object({action:z.literal('solution'),team,url:deliveryUrl}),
 z.object({action:z.literal('instructions'),team,text:z.string().max(6000)}),
 z.object({action:z.literal('slidesLink'),team,url:deliveryUrl}),
 z.object({action:z.literal('score'),team,scores:z.array(z.number().int().min(1).max(5)).length(6),notes:z.array(z.string().max(1000)).length(6),signature:z.string().trim().min(2).max(100)})]);
export async function GET(r:Request){
 const db=database(),v=await viewer(r),me=v.id.replace(/^employee:/,''),list=async(q:string,...args:any[])=>(await db.prepare(q).bind(...args).all<any>()).results;
 const params=new URL(r.url).searchParams;
 if(params.get('view')==='results'){
  if(!v.manager)return fail('نتائج التحكيم متاحة للإدارة فقط.',v.signedIn?403:401);
  const teamId=params.get('team');
  if(teamId!==null&&!uid.safeParse(teamId).success)return fail('معرّف الفريق غير صالح.',400);
  return reply({teams:await managerJudging(v,teamId?{teamId,cards:true}:{})});
 }
 const announced=await announcedChallenges();
 if(new URL(r.url).searchParams.has('notice'))return reply({announced});
 const judge=!!await db.prepare('SELECT 1 FROM event_judges WHERE person=?').bind(me).first();
 const teams=await list(`SELECT t.*,json_extract(c.payload,'$.title') title,s.rank,EXISTS(SELECT 1 FROM team_members m WHERE m.team=t.id AND m.person=?) mine FROM event_teams t JOIN challenges c ON c.id=t.id JOIN workshop_selection s ON s.challenge_id=t.id WHERE ? OR ? OR EXISTS(SELECT 1 FROM team_members m WHERE m.team=t.id AND m.person=?) ORDER BY s.rank`,me,+v.manager,+judge,me);
 const judging=v.manager?new Map((await managerJudging(v,{cards:true})).map(t=>[t.id,t])):null;
 for(const t of teams){
  t.members=await list('SELECT e.id,e.name FROM team_members m JOIN employees e ON e.id=m.person WHERE team=? ORDER BY e.name',t.id);
  // Members can restore a previous slide attachment. Reviewers see only the effective presentation.
  t.files=await list("SELECT kind,name FROM team_files WHERE team=? AND (kind<>'slides' OR ?='' OR ?=1)",t.id,t.slides_url,t.mine);
  if(judging){
   const score=judging.get(t.id)!;
   t.evaluations=score.evaluations;t.result=score.result;
  }else{
   delete t.audience;
   const own=judge&&!t.mine?await list('SELECT s.person,e.name,s.card,s.stamp FROM team_scores s JOIN employees e ON e.id=s.person WHERE team=? AND s.person=?',t.id,me):[];
   t.evaluations=own.map(e=>({...e,card:JSON.parse(e.card)}));
  }
 }
 const extra=v.manager?{people:await list('SELECT id,name FROM employees WHERE active=1 ORDER BY name'),judges:(await list('SELECT person FROM event_judges')).map(e=>e.person),options:(await list(rankedSQL)).map(e=>({id:e.id,title:JSON.parse(e.payload).title,votes:e.votes})),suggested:(await settings()).finalized?(await list('SELECT challenge_id FROM workshop_selection ORDER BY rank')).map(e=>e.challenge_id):null,count:(await settings()).count,revision:(await settings()).revision}:{};
 const identity=me?await db.prepare('SELECT name FROM employees WHERE id=?').bind(me).first<{name:string}>():null;
 return reply({announced,teams,manager:v.manager,judge,me,name:identity?.name||'',...extra});
}
export async function POST(r:Request){try{
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 const v=await viewer(r);if(!v.signedIn)return fail('سجّل الدخول أولًا.',401);
 const p=commands.parse(await r.json()),db=database(),me=v.id.slice(9),stmt=(q:string,...a:any[])=>db.prepare(q).bind(...a);
 if(p.action==='score'){
 const res=await stmt(`INSERT INTO team_scores(team,person,card,stamp) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM event_judges j JOIN employees e ON e.id=j.person WHERE j.person=? AND e.active=1) AND EXISTS(SELECT 1 FROM event_teams WHERE id=?) AND NOT EXISTS(SELECT 1 FROM team_members WHERE team=? AND person=?) ON CONFLICT(team,person) DO UPDATE SET card=excluded.card,stamp=excluded.stamp`,p.team,me,JSON.stringify({scores:p.scores,notes:p.notes,signature:p.signature,total:weighted(p.scores)}),Date.now(),me,p.team,p.team,me).run();
 return res.meta.changes?reply({ok:true}):fail('التقييم للمقيّمين المكلّفين، ولا يمكن تقييم فريقك.',403);}
 if(p.action==='solution'||p.action==='instructions'||p.action==='slidesLink'){
 const column={solution:'solution',instructions:'instructions',slidesLink:'slides_url'}[p.action];
 const value=p.action==='instructions'?p.text.trim():p.url;
 const result=await stmt(`UPDATE event_teams SET ${column}=? WHERE id=? AND EXISTS(SELECT 1 FROM team_members WHERE team=? AND person=?)`,value,p.team,p.team,me).run();
 return result.meta.changes?reply({ok:true}):fail('التسليم لأعضاء الفريق فقط.',403);}
 if(!v.manager)return fail('هذا الإجراء لمدير النظام فقط.',403);
 if(p.action==='announce'){
 await ensureSettings();const ids=[...new Set(p.ids)],marks=ids.map(()=>'?').join(',');
 // Abort the whole batch on a stale revision, duplicate announcement or ineligible selection.
 const guard=`(SELECT revision FROM workshop_settings WHERE id=1)=? AND NOT EXISTS(SELECT 1 FROM event_teams) AND (SELECT COUNT(*) FROM challenges WHERE status='published' AND id IN (${marks}))=?`;
 try{await db.batch([
 stmt(`INSERT INTO team_announcement(id,actor) VALUES(1,CASE WHEN ${guard} THEN ? ELSE NULL END)`,p.revision,...ids,ids.length,v.id),
 stmt('UPDATE workshop_settings SET finalized=1,open=0,joining_open=0,count=?,revision=revision+1 WHERE id=1',ids.length),
 stmt('DELETE FROM workshop_selection'),
 stmt(`INSERT INTO event_teams(id,announced) SELECT id,? FROM challenges WHERE id IN (${marks})`,Date.now(),...ids),
 stmt(`INSERT INTO workshop_selection(challenge_id,payload,votes,rank) SELECT id,payload,votes,ROW_NUMBER() OVER(ORDER BY votes DESC,published_at,id) FROM (${rankedSQL}) WHERE id IN (SELECT id FROM event_teams)`),
 stmt("INSERT INTO team_members(team,person) SELECT c.id,e.id FROM challenges c JOIN employees e ON c.owner='employee:'||e.id JOIN event_teams t ON t.id=c.id")]);
 }catch{return fail('تعذّر الإعلان. حدّث الصفحة وراجع التحديات المحددة قبل المحاولة.',409);}
 }else if(p.action==='audience'){
 if(!(await stmt('UPDATE event_teams SET audience=? WHERE id=?',p.value,p.team).run()).meta.changes)return fail('الفريق غير موجود.',404);
 }else{
 if(!await stmt('SELECT 1 FROM employees WHERE id=? AND active=1',p.person).first())return fail('الحساب غير متاح.');
 if(p.action==='judge')await (p.enabled?stmt('INSERT OR IGNORE INTO event_judges VALUES(?)',p.person):stmt('DELETE FROM event_judges WHERE person=?',p.person)).run();
 else{if(p.enabled&&await stmt('SELECT 1 FROM team_scores WHERE team=? AND person=?',p.team,p.person).first())return fail('سبق لهذا المقيم تقييم الفريق؛ لا يمكن إسناده إليه.',409);
 await (p.enabled?stmt('INSERT OR IGNORE INTO team_members VALUES(?,?)',p.team,p.person):stmt('DELETE FROM team_members WHERE team=? AND person=?',p.team,p.person)).run();}
 }
 await audit(v.id,({announce:'إعلان التحديات المرشحة وتكوين الفرق',member:'تحديث عضوية فريق التحدي',judge:'تحديث تكليف مقيم',audience:'رصد درجة تصويت الموظفين'})[p.action]);
 return reply({ok:true});
}catch{return fail('تعذّر الحفظ. راجع المدخلات وحاول مجددًا.');}}
