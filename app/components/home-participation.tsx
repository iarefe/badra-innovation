'use client';
import {useState,useRef,useEffect,type MouseEventHandler} from 'react';
import {createPortal} from 'react-dom';
import type {Entry} from '@/lib/challenges';

export type ParticipationKind='vote'|'interest';
export type SetParticipation=(entry:Entry,kind:ParticipationKind,active:boolean)=>Promise<boolean|undefined>;
type Receipt={id:string;kind:ParticipationKind;was:boolean};
const currentValue=(e:Entry,kind:ParticipationKind)=>Boolean(kind==='vote'?e.voted:e.interested);
const notices={vote:['سُحب صوتك','سُجّل صوتك'],interest:['سُحبت رغبتك','سُجّلت رغبتك في الانضمام']} as const;

export function useHomeParticipation(entries:Entry[],commit:SetParticipation){
 const [receipt,setReceipt]=useState<Receipt|null>(null),pending=useRef(false);
 useEffect(()=>{if(!receipt)return;const t=window.setTimeout(()=>setReceipt(null),4000);return()=>window.clearTimeout(t)},[receipt]);
 async function toggle(entry:Entry,kind:ParticipationKind){
  if(pending.current)return;
  pending.current=true;setReceipt(null);
  const was=currentValue(entry,kind);
  try{if(await commit(entry,kind,!was))setReceipt({id:entry.id,kind,was})}finally{pending.current=false}
 }
 async function undo(){
  if(!receipt||pending.current)return;
  const {id,kind,was}=receipt,entry=entries.find(e=>e.id===id);
  setReceipt(null);
  if(!entry||entry.example||entry.mine||entry.status!=='published'||currentValue(entry,kind)===was)return;
  pending.current=true;
  try{await commit(entry,kind,was)}finally{pending.current=false}
 }
 return {toggle,undo,receipt};
}

export function ParticipationToast({receipt,undo,disabled}:{receipt:Receipt|null;undo:()=>void;disabled:boolean}){
 return receipt?createPortal(<div className="bh-action-toast" dir="rtl"><span role="status">{notices[receipt.kind][receipt.was?0:1]}</span><button type="button" onClick={undo} disabled={disabled}>تراجع</button></div>,document.body):null;
}

export function HomeCardActions({entry,busy,votingOpen,joiningOpen,toggle}:{entry:Entry;busy:boolean;votingOpen:boolean;joiningOpen:boolean;toggle:(e:Entry,k:ParticipationKind)=>void}){
 return <div className="bh-participate-actions" role="group" aria-label={'المشاركة في تحدي: '+entry.challenge.title}>
  {(['vote','interest'] as const).map(kind=>{
   const vote=kind==='vote',selected=currentValue(entry,kind),closed=vote?!votingOpen:!joiningOpen;
   const label=closed?(vote?'التصويت مغلق':'الانضمام مغلق'):selected?(vote?'صوّتّ':'سجّلت رغبتي'):(vote?'أصوّت لهذا التحدي':'أرغب بالانضمام');
   const withdraw=vote?'سحب صوتي':'سحب رغبتي';
   return <button type="button" key={kind} className={vote?'bh-vote':'bh-join'} data-badra-anchor={vote?'home-vote':'home-join'} aria-pressed={selected} disabled={busy||closed}
    aria-label={label+'، '+(selected&&!closed?withdraw+'، ':'')+entry.challenge.title} onClick={()=>toggle(entry,kind)}>
    <span className="bh-action-label">{selected&&!closed&&<span aria-hidden="true">✓ </span>}{label}</span>
    {selected&&!closed&&<span className="bh-withdraw-label" aria-hidden="true">{withdraw}</span>}
   </button>
  })}
 </div>;
}

export function MyParticipation({real,onGrid,gridId='home-challenge-grid',votingOpen,joiningOpen}:{real:Entry[];onGrid:MouseEventHandler<HTMLAnchorElement>;gridId?:string;votingOpen:boolean;joiningOpen:boolean}){
 const X=real.filter(e=>!e.mine&&e.voted).length,Y=real.filter(e=>!e.mine&&e.interested).length,Z=real.filter(e=>e.mine).length;
 const fmt=(n:number)=>n.toLocaleString('ar-SA');
 return <aside className="bh-my-participation" aria-label="مشاركتي">
  <div><strong>مشاركتي</strong><span>صوّتّ لـ <b>{fmt(X)}</b></span><i aria-hidden="true">·</i><span>سجّلت رغبتك في <b>{fmt(Y)}</b></span><i aria-hidden="true">·</i><span>طرحت <b>{fmt(Z)}</b></span></div>
  <a href={'#'+gridId} data-complete={X>0&&Y>0} onClick={onGrid}>{!votingOpen&&!joiningOpen?'استعرض التحديات ←':joiningOpen&&Y===0?'لم تسجّل رغبتك في أي فريق بعد، اختر تحديًا ←':votingOpen&&X===0?'صوّت لما تراه أولوية ←':'شكرًا لمشاركتك ✓'}</a>
 </aside>;
}
