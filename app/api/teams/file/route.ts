import {env} from 'cloudflare:workers';
import {database,viewer,reply,fail,sameOrigin} from '@/lib/server/access';
import {limitedBody} from '@/lib/server/challenge-cover';
export const dynamic='force-dynamic';
async function access(r:Request){
 const q=new URL(r.url).searchParams,team=q.get('team')||'',kind=q.get('kind')||'',v=await viewer(r),me=v.id.slice(9),db=database();
 const row=await db.prepare('SELECT t.slides_url, EXISTS(SELECT 1 FROM team_members WHERE team=t.id AND person=?) mine, EXISTS(SELECT 1 FROM event_judges WHERE person=?) judge FROM event_teams t WHERE id=?').bind(me,me,team).first<any>();
 const active=kind!=='slides'||!row?.slides_url||!!row.mine;
 return {team,kind,me,db,mine:!!row?.mine,read:!!row&&active&&(v.manager||!!row.mine||!!row.judge),valid:['solution','slides'].includes(kind)};
}
export async function GET(r:Request){const a=await access(r);if(!a.read||!a.valid)return fail('المرفق غير متاح.',404);
 const f=await a.db.prepare('SELECT object_key,name FROM team_files WHERE team=? AND kind=?').bind(a.team,a.kind).first<any>();
 if(!env.BUCKET)return fail('تخزين الملفات غير متاح حاليًا.',503);const o=f&&await env.BUCKET.get(f.object_key);if(!o)return fail('لا يوجد مرفق.',404);
 return new Response(o.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.name)}});
}
export async function POST(r:Request){if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 const a=await access(r);if(!a.mine||!a.valid)return fail('رفع الملفات لأعضاء الفريق فقط.',403);
 if(a.kind!=='slides')return fail('يُسلّم الحل برابط، ويُرفع الملف للعرض التقديمي فقط.');
 const name=(new URL(r.url).searchParams.get('name')||'').replace(/[\x00-\x1f\/\\]/g,'').slice(-160),ext=name.split('.').pop()?.toLowerCase();
 let bytes;try{bytes=await limitedBody(r,10*1024*1024)}catch{return fail('الحد الأعلى للملف 10 ميغابايت.',413)}
 const pdf=ext==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-',archive=bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4&&ext==='pptx';
 if(!pdf&&!archive)return fail('اختر عرضًا بصيغة PPTX أو PDF.');
 const key='team-deliverables/'+a.team+'/'+crypto.randomUUID(),old=await a.db.prepare('SELECT object_key FROM team_files WHERE team=? AND kind=?').bind(a.team,a.kind).first<any>();
 if(!env.BUCKET)return fail('تخزين الملفات غير متاح حاليًا.',503);
 try{await env.BUCKET.put(key,bytes);}catch{return fail('تعذّر تخزين العرض، حاول مجددًا.',503);}
 try{
  // The uploaded file becomes active only after storage succeeds; both metadata changes commit together.
  const [saved]=await a.db.batch([
   a.db.prepare('INSERT INTO team_files(team,kind,object_key,name) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM team_members WHERE team=? AND person=?) ON CONFLICT(team,kind) DO UPDATE SET object_key=excluded.object_key,name=excluded.name').bind(a.team,a.kind,key,name,a.team,a.me),
   a.db.prepare("UPDATE event_teams SET slides_url='' WHERE id=? AND EXISTS(SELECT 1 FROM team_files WHERE team=? AND kind='slides' AND object_key=?)").bind(a.team,a.team,key)
  ]);
  if(!saved.meta.changes)throw Error();
 }catch{await env.BUCKET.delete(key);return fail('لم يتم حفظ المرفق.',409);}
 if(old){try{await env.BUCKET.delete(old.object_key)}catch{/* The replacement is already saved. */}}
 return reply({ok:true});
}
