import {withParticipant} from '@/lib/server/participant';
import {siteData} from '@/lib/server/site-data';
import {reply} from '@/lib/server/access';
export const dynamic='force-dynamic';
export async function GET(r:Request){return withParticipant(r,async v=>reply(await siteData(v)));}
