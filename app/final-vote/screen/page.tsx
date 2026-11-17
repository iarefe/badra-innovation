import type {Metadata} from 'next';
import {headers} from 'next/headers';
import {GET as readBallot} from '@/app/api/final-vote/route';
import type {BallotPhase} from '@/lib/final-ballot';
import {ballotLink} from '@/lib/final-vote-link';
import FinalVoteProjector from './projector';
import './screen.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'شاشة تصويت الجمهور | هاكاثون الابتكار الرقمي',robots:{index:false,follow:false}};
export default async function Page(){
 let phase:BallotPhase|null=null;
 try{const r=await readBallot(new Request('https://site.internal/api/final-vote'));if(r.ok)phase=((await r.json()) as {phase:BallotPhase}).phase;}catch{/* The screen will retry without exposing private account data. */}
 const host=(await headers()).get('host')||'';
 return <FinalVoteProjector initialPhase={phase} initialLink={ballotLink('https://'+host)}/>;
}
