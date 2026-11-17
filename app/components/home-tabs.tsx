'use client';
import {useRef,type ReactNode} from 'react';
type Option={id:string;label:ReactNode;name?:string};
export default function HomeTabs({name,options,selected,choose,group,panelId}:{name:string;options:Option[];selected:number;choose:(i:number)=>void;group:string;panelId:string}){
 const tabs=useRef<(HTMLButtonElement|null)[]>([]);
 return <div className={'bh-tabs '+group} role="tablist" aria-label={name}>
  {options.map((o,i)=><button type="button" role="tab" key={o.id} id={o.id} aria-label={o.name} ref={el=>{tabs.current[i]=el}} tabIndex={selected===i?0:-1} aria-selected={selected===i} aria-controls={panelId} onClick={()=>choose(i)} onKeyDown={e=>{let to=i;if(e.key==='ArrowLeft')to=(i+1)%options.length;else if(e.key==='ArrowRight')to=(i+options.length-1)%options.length;else if(e.key==='Home')to=0;else if(e.key==='End')to=options.length-1;else return;e.preventDefault();choose(to);tabs.current[to]?.focus({preventScroll:true})}}>{o.label}</button>)}
 </div>;
}
