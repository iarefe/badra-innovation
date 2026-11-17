import { env } from 'cloudflare:workers';
import { saveSchema } from '@/lib/ideas';
export const dynamic='force-dynamic';
function actor(r:Request){return r.headers.get('oai-authenticated-user-id');}
function fail(message:string,status=400){return Response.json({error:message},{status});}
export async function GET(r:Request){try {const user=actor(r);const rows=await env.DB!.prepare(`SELECT i.*, (SELECT COUNT(*) FROM votes v WHERE v.idea_id=i.id) AS votes, EXISTS(SELECT 1 FROM votes v WHERE v.idea_id=i.id AND v.user_id=?) AS voted FROM ideas i WHERE i.owner=? ORDER BY i.created_at DESC LIMIT 500`).bind(user||'',user||'').all();return Response.json({ideas:rows.results.map((x:any)=>({id:x.id,card:JSON.parse(x.payload),nickname:x.nickname,experience:x.experience,published:!!x.published,createdAt:x.created_at,votes:x.votes,voted:!!x.voted,mine:x.owner===user})),signedIn:!!user},{headers:{'Cache-Control':'private, no-store'}});}catch {return fail('تعذّر تحميل الأفكار. أعد المحاولة بعد قليل.',500);}}
export async function POST(){return fail('تم إيقاف إنشاء البطاقات القديمة. استخدم نموذج التحديات الجديد.',410);}
