import {headers} from 'next/headers';
import type {Metadata} from 'next';
import type {FinalBallotView} from '@/lib/final-ballot';
import {GET as getBallot} from '../api/final-vote/route';
import Ballot from './ballot';
import './ballot.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'تصويت الختام | هاكاثون الابتكار الرقمي',robots:{index:false,follow:false}};

export default async function FinalVotePage(){
 let initial:FinalBallotView|null=null;
 try{
  const result=await getBallot(new Request('https://site.internal/api/final-vote',{headers:await headers()}));
  if(result.ok)initial=await result.json() as FinalBallotView;
 }catch{/* The page can recover from a transient read failure without losing the ballot link. */}
 return <Ballot initial={initial}/>;
}
