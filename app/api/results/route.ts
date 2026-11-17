import {reply,fail,sameOrigin,viewer} from '@/lib/server/access';
import {publishedResults,publicationPreview,publishReviewed} from '@/lib/server/result-publication';
import {z} from 'zod';
export const dynamic='force-dynamic';
const approval=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().nonnegative()}).strict();
export async function GET(r:Request){
 if(new URL(r.url).searchParams.get('preview')==='1'){
  const v=await viewer(r);if(!v.manager)return fail('معاينة التعميم متاحة لمدير النظام فقط.',v.signedIn?403:401);
  return reply(await publicationPreview());
 }
 return reply({publication:await publishedResults()});
}
export async function POST(r:Request){
 if(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site')return fail('طلب غير مسموح.',403);
 const v=await viewer(r);if(!v.manager)return fail('تعميم النتائج متاح لمدير النظام فقط.',v.signedIn?403:401);
 const data=approval.safeParse(await r.json().catch(()=>null));
 if(!data.success)return fail('يلزم مراجعة النتيجة قبل التعميم.');
 const result=await publishReviewed(data.data.fingerprint,data.data.revision,v.id);
 return 'error' in result?fail(result.error!,409):reply(result);
}
