import type {Metadata} from 'next';
import {publicPresentation} from '@/lib/server/presentation';
import ChallengePresentation from './challenge-presentation';
import './presentation.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'شاشة عرض التحديات | هاكاثون الابتكار الرقمي',robots:{index:false,follow:false}};
export default async function Page(){
 const initial=await publicPresentation().catch(()=>null);
 return <ChallengePresentation initial={initial}/>;
}
