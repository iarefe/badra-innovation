'use client';
import {ArrowLeft,Check} from 'lucide-react';
import {chatFields,missingFields,type ChatDraft} from '@/lib/ai-challenge';
import {assistantDisplay,fieldOptions} from '@/lib/challenge-chat-view';
type Field=keyof ChatDraft;
export default function ChallengeRemaining({draft,blocked,onFill,onPick,onManual}:{draft:ChatDraft;blocked:boolean;onFill:(k:Field)=>void;onPick:(k:Field,value:string)=>void;onManual:()=>void}){
 const gaps=missingFields(draft) as Field[],copy=assistantDisplay.recovery;
 return <section className="bsa-remaining" aria-labelledby="q-text">
  <h2 id="q-text" tabIndex={-1}>{copy.heading}</h2><span role="status" className="sr-only">عدد الخانات المتبقية: {gaps.length}</span><p>{copy.intro}</p>
  {(['frequency','domain'] as const).some(k=>draft[k]&&!gaps.includes(k))&&<div className="bsa-recorded" aria-label={copy.recorded}>{(['frequency','domain'] as const).filter(k=>draft[k]&&!gaps.includes(k)).map(k=><span key={k}><Check size={13} aria-hidden="true"/>{chatFields[k]}: {draft[k]}</span>)}</div>}
  <ul>{gaps.map(k=>{const choices=gaps.length<=3?fieldOptions(k):[];return <li key={k}>
   {choices.length?<fieldset><legend>{chatFields[k]}</legend><p>{k==='domain'?copy.domainHint:copy.choiceHint}</p><div className="bsa-gap-options">{choices.map(opt=><button type="button" key={opt.value} disabled={blocked} onClick={()=>onPick(k,opt.value)}>{opt.label}</button>)}</div></fieldset>:
   <button type="button" className="bsa-gap-row" disabled={blocked} onClick={()=>onFill(k)} aria-label={'إكمال '+chatFields[k]}><b>{chatFields[k]}</b><span>{copy.answer}<ArrowLeft size={15} aria-hidden="true"/></span></button>}
  </li>})}</ul><button type="button" className="bsa-text-action" disabled={blocked} onClick={onManual}>{copy.manual}</button>
 </section>;
}
