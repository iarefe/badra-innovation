import {riyadhEventDay} from '@/lib/hackathon-event';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {readParticipant} from '@/lib/server/participant';
import {siteData} from '@/lib/server/site-data';
import {getTeamReadiness} from '@/lib/server/team-readiness';
import type {AdminTab} from '@/lib/admin-dashboard';
import SiteApp from './components/site-app';
export default async function ServerApp({initialRoute,initialTab=null}:{initialRoute:string;initialTab?:AdminTab|null}){
 const r=new Request('https://site.internal/',{headers:await headers()});
 let identity;try{identity=await readParticipant(r)}catch{return <SiteApp initialTab={initialTab} initialDay={riyadhEventDay()} initialRoute={initialRoute}/>}
 if(initialRoute==='admin'&&!identity.v.manager)notFound();
 const [initialData,initialReadiness]=await Promise.all([
  siteData(identity.v).catch(()=>null),
  initialRoute==='admin'&&identity.v.manager?getTeamReadiness(identity.v).catch(()=>null):null
 ]);
 return <SiteApp initialTab={initialTab} initialDay={riyadhEventDay()} initialRoute={initialRoute} initialData={initialData} initialReadiness={initialReadiness}/>;
}
