import ServerApp from '../../server-app';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ServerApp initialRoute={'challenge/'+id}/>;}
