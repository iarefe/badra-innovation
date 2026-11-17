import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {database,reply,fail} from '@/lib/server/access';
import {withParticipant} from '@/lib/server/participant';
import {participationGate} from '@/lib/server/employee';
import {seededCovers} from '@/lib/challenge-cover';
import {readCover,coverView,coverBucket,limitedBody,imageType,generateCover} from '@/lib/server/challenge-cover';
export const dynamic='force-dynamic';
const idSchema=z.string().uuid();
export async function GET(r:Request){return withParticipant(r,async v=>{
 const id=idSchema.safeParse(new URL(r.url).searchParams.get('id'));if(!id.success)return fail('الغلاف غير متاح.',404);
 const c:any=await database().prepare('SELECT * FROM challenges WHERE id=?').bind(id.data).first();if(!c||(c.status!=='published'&&c.owner!==v.id&&!v.manager))return fail('الغلاف غير متاح.',404);
 const row=await readCover(id.data);if(!row?.object_key)return fail('الغلاف غير متاح.',404);
 const object=await coverBucket()?.get(row.object_key);if(!object)return fail('الغلاف غير متاح.',404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});}
export async function POST(r:Request){return withParticipant(r,async v=>{
 const gate=await participationGate(r,v);if(gate)return gate;
 const upload=r.headers.get('content-type')?.startsWith('image/');let p:{id:string;action:'auto'|'generate'|'upload';prompt:string};
 try{if(upload){p={id:idSchema.parse(new URL(r.url).searchParams.get('id')),action:'upload',prompt:''}}else{p=z.object({id:idSchema,action:z.enum(['auto','generate']),prompt:z.string().trim().max(600).default('')}).parse(JSON.parse(new TextDecoder().decode(await limitedBody(r,4000))))}}catch{return fail('أرسل وصفًا لا يتجاوز ٦٠٠ حرف أو صورة صالحة.',400)}
 const db=database(),c:any=await db.prepare('SELECT * FROM challenges WHERE id=?').bind(p.id).first();if(!c||(c.owner!==v.id&&!v.manager))return fail('تعديل الغلاف متاح لصاحب التحدي فقط.',403);
 const challenge=JSON.parse(c.payload),old=await readCover(p.id),now=Date.now();
 if(p.action==='auto'&&(old||seededCovers[p.id]))return reply({cover:coverView(p.id,challenge,old,true)});
 if(!coverBucket())return fail('تخزين الأغلفة غير متاح الآن. احتفظنا بالغلاف الحالي.',503);
 if(!upload&&!(env as any).OPENAI_API_KEY)return fail('توليد الأغلفة غير متاح الآن. يمكنك رفع صورة بدلًا منه.',503);
 let bytes:Uint8Array|undefined;if(upload){try{bytes=await limitedBody(r,3*1024*1024)}catch{return fail('الصورة كبيرة. الحد الأقصى بعد التجهيز ٣ ميجابايت.',413)}if(!imageType(bytes))return fail('ارفع صورة JPEG أو PNG أو WebP صالحة.',415);}
 if(old?.status==='pending'&&old.started_at>now-240000)return fail('يجري توليد غلاف لهذا التحدي الآن. انتظر قليلًا.',409);
 if(!upload){for(const [key,limit] of [[`cover:person:${v.id}:${Math.floor(now/86400000)}`,10],[`cover:global:${Math.floor(now/86400000)}`,60]] as const){const taken=await db.prepare('INSERT INTO ai_usage(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key,now+172800000,limit).first();if(!taken)return fail('بلغ توليد الأغلفة حدّه اليومي. يمكنك رفع صورة أو المحاولة غدًا.',429);}}
 const job=crypto.randomUUID();
 const locked=p.action==='auto'?await db.prepare("INSERT OR IGNORE INTO challenge_covers(challenge_id,status,job_id,started_at,prompt) VALUES(?,'pending',?,?,?) RETURNING challenge_id").bind(p.id,job,now,p.prompt).first():await db.prepare(`INSERT INTO challenge_covers(challenge_id,status,job_id,started_at,prompt) VALUES(?,'pending',?,?,?) ON CONFLICT(challenge_id) DO UPDATE SET status='pending',job_id=excluded.job_id,started_at=excluded.started_at,prompt=excluded.prompt WHERE challenge_covers.status!='pending' OR challenge_covers.started_at<? RETURNING challenge_id`).bind(p.id,job,now,p.prompt,now-240000).first();
 if(!locked)return fail('يجري تحديث الغلاف الآن. انتظر قليلًا.',409);
 let key='',committed=false;try{
  bytes=bytes||await generateCover(challenge,p.prompt);const type=imageType(bytes)!;key=`challenge-covers/${p.id}/${job}.${type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp'}`;
  await coverBucket()!.put(key,bytes,{httpMetadata:{contentType:type}});
  const saved=await db.prepare("UPDATE challenge_covers SET object_key=?,source=?,status='ready',updated_at=? WHERE challenge_id=? AND job_id=? RETURNING challenge_id").bind(key,upload?'upload':'generated',Date.now(),p.id,job).first();
  if(!saved){await coverBucket()!.delete(key);return fail('تغيّر الغلاف أثناء الحفظ. حدّث الصفحة.',409)}
  committed=true;
  // Delete only the replaced object after the new image and database pointer are durable.
  if(old?.object_key&&old.object_key!==key)try{await coverBucket()!.delete(old.object_key)}catch{}
  return reply({cover:coverView(p.id,challenge,await readCover(p.id),true)});
 }catch{
  if(key&&!committed)try{await coverBucket()!.delete(key)}catch{}
  await db.prepare("UPDATE challenge_covers SET status='failed' WHERE challenge_id=? AND job_id=?").bind(p.id,job).run();
  return reply({error:'تعذّر تجهيز الغلاف الآن. احتفظنا بالغلاف السابق؛ يمكنك إعادة المحاولة أو رفع صورة.',cover:coverView(p.id,challenge,await readCover(p.id),true)},502);
 }
});}
