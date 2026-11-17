import {adminRouteTab} from '@/lib/admin-dashboard';
import ServerApp from '../server-app';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string|string[]}>}){const {tab}=await searchParams;return <ServerApp initialRoute="admin" initialTab={adminRouteTab(typeof tab==='string'?tab:null)}/>}
