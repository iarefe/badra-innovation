import {z} from 'zod';
import {inquiryMinLength,inquiryMaxLength} from '@/lib/faq-inquiries';
import {database,viewer,reply,fail,sameOrigin} from '@/lib/server/access';
import {withParticipant} from '@/lib/server/participant';
import {clientIp,hash,rate} from '@/lib/server/employee';

export const dynamic='force-dynamic';
const submission=z.object({id:z.string().uuid(),question:z.string().trim().min(inquiryMinLength).max(inquiryMaxLength)}).strict();
const acknowledgement=z.object({id:z.string().uuid()}).strict();

// This endpoint intentionally accepts visitor questions. Only managers can read them.
export async function POST(r:Request){return withParticipant(r,async v=>{
 const raw=await r.text();
 if(raw.length>8000)return fail('السؤال أطول من الحد المسموح.',413);
 let body:unknown;try{body=JSON.parse(raw)}catch{return fail('تعذّر قراءة السؤال. أعد المحاولة.')}
 const parsed=submission.safeParse(body);
 if(!parsed.success)return fail(`اكتب سؤالًا من ${inquiryMinLength} إلى ${inquiryMaxLength} حرف.`);
 const {id,question}=parsed.data,db=database();
 const retry=async()=>{
  const existing=await db.prepare('SELECT question FROM faq_inquiries WHERE id=?').bind(id).first<{question:string}>();
  return existing?existing.question===question?reply({ok:true}):fail('تغيّر السؤال أثناء الإرسال. أعد المحاولة.',409):null;
 };
 const previous=await retry();if(previous)return previous;
 const actor=v.session?'employee:'+v.session.id:v.id,ip=clientIp(r);
 if(!await rate('faq:sender:'+actor,3,600000)||!await rate('faq:network:'+await hash(ip||'unknown'),30,600000))return fail('وصلتنا عدة أسئلة مؤخرًا. انتظر قليلًا ثم أعد المحاولة.',429);
 const saved=await db.prepare('INSERT INTO faq_inquiries(id,question,sender_id,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(id,question,v.session?.id??null,Date.now()).first();
 return saved?reply({ok:true},201):(await retry()||fail('تعذّر حفظ السؤال. أعد المحاولة.',500));
})}

export async function GET(r:Request){try{
 if(!(await viewer(r)).manager)return fail('الاستفسارات متاحة لمدير النظام فقط.',403);
 const value=new URL(r.url).searchParams.get('page')||'1';
 if(!/^\d{1,6}$/.test(value)||Number(value)<1)return fail('رقم الصفحة غير صحيح.');
 const db=database(),counts=await db.prepare('SELECT COUNT(*) total,COALESCE(SUM(read_at IS NULL),0) unread FROM faq_inquiries').first<{total:number;unread:number}>();
 const total=Number(counts?.total||0),unread=Number(counts?.unread||0),pages=Math.max(1,Math.ceil(total/20)),page=Math.min(Number(value),pages);
 const result=await db.prepare('SELECT q.id,q.question,e.name AS senderName,q.created_at AS createdAt,q.read_at AS readAt FROM faq_inquiries q LEFT JOIN employees e ON e.id=q.sender_id ORDER BY q.created_at DESC,q.id DESC LIMIT 20 OFFSET ?').bind((page-1)*20).all();
 return reply({inquiries:result.results,total,unread,page,pages});
 }catch{return fail('تعذّر تحميل الاستفسارات. حاول مجددًا.',500)}
}

export async function PATCH(r:Request){try{
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 if(!(await viewer(r)).manager)return fail('الاستفسارات متاحة لمدير النظام فقط.',403);
 const raw=await r.text();if(raw.length>200)return fail('طلب غير صالح.');
 let body:unknown;try{body=JSON.parse(raw)}catch{return fail('طلب غير صالح.')}
 const parsed=acknowledgement.safeParse(body);if(!parsed.success)return fail('طلب غير صالح.');
 const row=await database().prepare('UPDATE faq_inquiries SET read_at=COALESCE(read_at,?) WHERE id=? RETURNING read_at AS readAt').bind(Date.now(),parsed.data.id).first();
 return row?reply({ok:true,...row}):fail('الاستفسار غير موجود.',404);
 }catch{return fail('تعذّر تحديث حالة الاستفسار.',500)}
}
