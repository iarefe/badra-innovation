'use client';
import {useRef,type KeyboardEvent} from 'react';
import {challengeLibraryPath,myChallengesPath} from '@/lib/routes';
const tabs=[{id:'all',label:'كل التحديات',href:challengeLibraryPath},{id:'mine',label:'تحدياتي',href:myChallengesPath}] as const;
export function CollectionTabs({mine}:{mine:boolean}){
 const row=useRef<HTMLDivElement>(null),active=mine?1:0;
 function keys(e:KeyboardEvent<HTMLAnchorElement>,i:number){
  if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
  let next:number;
  // In RTL the following tab sits to the left.
  switch(e.key){case 'ArrowLeft':next=(i+1)%tabs.length;break;case 'ArrowRight':next=(i+tabs.length-1)%tabs.length;break;case 'Home':next=0;break;case 'End':next=tabs.length-1;break;case ' ':e.preventDefault();e.currentTarget.click();return;default:return;}
  e.preventDefault();const link=row.current?.querySelectorAll<HTMLAnchorElement>('[role="tab"]')[next];
  if(link){link.focus({preventScroll:true});if(next!==active)link.click();}
 }
 return <div className="collection-tabs" role="tablist" dir="rtl" aria-label="أقسام التحديات" ref={row}>{tabs.map((tab,i)=>
  <a href={tab.href} id={'collection-tab-'+tab.id} key={tab.id} role="tab" aria-controls={'collection-panel-'+tab.id} aria-selected={i===active} tabIndex={i===active?0:-1} data-badra-anchor={i===1?'my-challenges':undefined} onKeyDown={e=>keys(e,i)}>{tab.label}</a>
 )}</div>;
}
