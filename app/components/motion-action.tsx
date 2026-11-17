'use client';
import {useEffect,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';

/** Feedback follows confirmed props; a click or a failed request cannot trigger it. */
export default function MotionAction({selected,count,children,className='',...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'> & {selected:boolean;count?:number;children:ReactNode}){
 const previous=useRef(selected);
 const [feedback,setFeedback]=useState<'added'|'removed'|null>(null);
 useEffect(()=>{
  if(previous.current===selected)return;
  previous.current=selected;setFeedback(selected?'added':'removed');
  const timer=setTimeout(()=>setFeedback(null),850);
  return()=>clearTimeout(timer);
 },[selected]);
 return <button {...props} type="button" aria-pressed={selected} className={'motion-action '+className} data-feedback={feedback||undefined}>
  {children}{typeof count==='number'&&<b><span key={count}>{count.toLocaleString('ar-SA')}</span></b>}
 </button>;
}
