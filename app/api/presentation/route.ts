import {publicPresentation} from '@/lib/server/presentation';
import {reply} from '@/lib/server/access';
export const dynamic='force-dynamic';
export async function GET(){
 try{return reply(await publicPresentation());}
 catch{return reply({error:'تعذّر تحديث شاشة العرض.'},503);}
}
