import {env} from 'cloudflare:workers';
import {database,fail} from './access';
async function take(key:string,limit:number,expires:number){return !!await database().prepare('INSERT INTO ai_usage(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key,expires,limit).first();}
export async function checkAssistantBudget(r:Request,actor:string):Promise<Response|null>{
  const now=Date.now(),hour=Math.floor(now/3600000),day=Math.floor(now/86400000);
  if(!await take(`visitor:${actor}:${hour}`,40,now+7200000))return fail('وصلت إلى حد المحادثة لهذه الساعة. يمكنك إكمال التحدي بالنموذج.',429);
  const ip=r.headers.get('cf-connecting-ip');
  if(ip){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+ip));const hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');if(!await take(`network:${hash}:${hour}`,80,now+7200000))return fail('طلبات كثيرة الآن. انتظر قليلًا أو أكمل بالنموذج.',429);}
  const configured=Number((env as any).AI_DAILY_LIMIT);const limit=Number.isFinite(configured)&&configured>0?Math.min(Math.floor(configured),5000):400;
  if(!await take(`global:${day}`,limit,now+172800000))return fail('بلغ المساعد حد الاستخدام اليومي. النموذج اليدوي متاح لإكمال مشاركتك.',429);
  await database().prepare('DELETE FROM ai_usage WHERE expires_at<?').bind(now).run();
 return null;
}
