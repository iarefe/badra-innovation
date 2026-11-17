import {Fragment} from 'react';
/** Spell out intervals so their meaning is unambiguous in Arabic. */
export default function EventDate({label,compact=false}:{label:string;compact?:boolean}){
 return <>{label.split(/([0-9٠-٩۰-۹]+\s*[–—-]\s*[0-9٠-٩۰-۹]+)/g).map((part,i)=>{
  if(i%2===0)return <Fragment key={i}>{part}</Fragment>;
  const [start,end]=part.split(/[–—-]/).map(value=>value.trim());
  if(compact)return <span key={i} dir="ltr" style={{unicodeBidi:'isolate',whiteSpace:'nowrap'}}>{start}–{end}</span>;
  return <span key={i} className="event-date-range" dir="rtl" style={{display:'inline-block',unicodeBidi:'isolate',whiteSpace:'nowrap'}}>من <bdi dir="ltr">{start}</bdi> إلى <bdi dir="ltr">{end}</bdi></span>;
 })}</>;
}
