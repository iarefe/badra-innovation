import ServerApp from '../server-app';
import {collectionRoute} from '@/lib/routes';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string|string[]}>}){
 const {tab}=await searchParams;return <ServerApp initialRoute={collectionRoute(tab)}/>;
}
