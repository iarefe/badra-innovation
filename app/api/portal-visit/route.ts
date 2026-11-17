import {database,fail,sameOrigin} from '@/lib/server/access';
import {sessionEmployee} from '@/lib/server/employee';
import {markPortalAccess} from '@/lib/server/portal-access';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!sameOrigin(req)||req.headers.get('sec-fetch-site')==='cross-site'||req.headers.get('x-badra-visit')!=='visible')return fail('طلب غير مسموح.',403);
 try{
  const e=await sessionEmployee(req);if(!e)return fail('يلزم تسجيل الدخول.',401);
  await markPortalAccess(database(),e.id,Date.now()).run();
  return new Response(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
 }catch{return fail('تعذّر تسجيل الدخول إلى المنصة.',503)}
}
