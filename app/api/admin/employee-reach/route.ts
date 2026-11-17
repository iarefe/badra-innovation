import {database,fail,reply,viewer} from '@/lib/server/access';
import {ensureProspectiveEmployees} from '@/lib/server/prospective-employees';
import {readEmployeeReach} from '@/lib/server/employee-reach';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const v=await viewer(req);if(!v.manager)return fail('سجل الدخول متاح لمدير النظام فقط.',v.signedIn?403:401);
 await ensureProspectiveEmployees();return reply(await readEmployeeReach(database()));
}catch{return fail('تعذّر تحميل سجل دخول الموظفين. حاول مرة أخرى.',503)}}
