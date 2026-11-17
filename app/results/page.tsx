import {headers} from 'next/headers';
import type {Metadata} from 'next';
import {viewer} from '@/lib/server/access';
import {publishedResults} from '@/lib/server/result-publication';
import EventHeader from '../components/event-header';
import ResultsView from './results-view';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'نتائج الهاكاثون | الجهة المنظمة',description:'الترتيب النهائي للفرق وتهنئة المركز الأول في هاكاثون الابتكار الرقمي.'};
export default async function ResultsPage(){
 const h=await headers();
 const [initial,v]=await Promise.all([publishedResults(),viewer(new Request('https://site.internal/results',{headers:h}))]);
 return <><EventHeader route="results" employee={v.employee} manager={v.manager} showTeams={!!initial}/><ResultsView initial={initial}/></>;
}
