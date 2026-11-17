'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Search} from 'lucide-react';
export const stagger=(i:number)=>({'--ba-delay':(Math.min(i,5)*.04)+'s'} as CSSProperties);
export function SearchBox({value,onChange,label}:{value:string;onChange:(s:string)=>void;label:string}){
 return <label className="ba-search"><Search size={16} aria-hidden="true"/><span className="sr-only">{label}</span><input type="search" value={value} onChange={e=>onChange(e.target.value)} placeholder={label} autoComplete="off"/></label>;
}
export function Empty({children}:{children:ReactNode}){return <p className="ba-empty" role="status">{children}</p>}

export function AdminBar({value,max,label}:{value:number;max:number;label?:string}){
 const ref=useRef<HTMLDivElement>(null),[state,setState]=useState<'static'|'waiting'|'seen'>('static');
 useEffect(()=>{const el=ref.current;if(!el)return;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce.matches||typeof IntersectionObserver==='undefined'){setState('static');return}
  setState('waiting');const observer=new IntersectionObserver(rows=>{if(rows.some(r=>r.isIntersecting)){setState('seen');observer.disconnect()}},{threshold:.05});
  observer.observe(el);return()=>observer.disconnect();
 },[]);
 return <div className="ba-track" ref={ref} data-view={state} role={label?'progressbar':undefined} aria-hidden={label?undefined:true} aria-label={label} aria-valuemin={label?0:undefined} aria-valuemax={label?Math.max(1,max):undefined} aria-valuenow={label?value:undefined}><i style={{width:Math.max(0,Math.min(100,value/Math.max(1,max)*100))+'%'}}/></div>;
}
