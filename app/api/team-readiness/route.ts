import {viewer,reply,fail} from '@/lib/server/access';
import {getTeamReadiness} from '@/lib/server/team-readiness';
export const dynamic='force-dynamic';

export async function GET(r:Request){
  const v=await viewer(r);
  if(!v.manager)return fail('جاهزية الفرق متاحة للإدارة فقط.',v.signedIn?403:401);
  try{return reply({rows:await getTeamReadiness(v)})}
  catch{return fail('تعذّر تحميل جاهزية الفرق.',503)}
}
