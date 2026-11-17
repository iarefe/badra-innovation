import type {Entry} from './challenges';
import {myChallengesPath} from './routes';
import type {GuideContext} from './companion-guidance';
import {challengeGaps} from './challenge-completion';

// Discovery coach introduced in Site v50, source d4db392 (not the later visual redesign).
export const assistantUpgradeAt=Date.parse('2026-11-03T08:54:24.000Z');
export const reminderDelay=2200,reminderDuration=12000;
export type ChallengeReminder={ids:string[];title:string;text:string;action:string;href:string};
export function reminderEntries({viewer,entries,workshop,loading,route}:GuideContext):Entry[]{
 if(loading||!viewer.signedIn||!viewer.employee||!viewer.employeeId||viewer.needsProfile||!workshop||workshop.finalized)return [];
 if(!['home','wall','mine'].includes(route)&&!route.startsWith('challenge/'))return [];
 return entries.filter(e=>e.mine&&!e.example&&(!workshop.intake||workshop.intake.phase==='open'||e.status==='published')&&['published','draft','returned'].includes(e.status)&&(challengeGaps(e.challenge).length>0||(e.createdAt>0&&e.createdAt<assistantUpgradeAt)))
  .sort((a,b)=>Number(route==='challenge/'+b.id)-Number(route==='challenge/'+a.id)||Number(challengeGaps(b.challenge).length>0)-Number(challengeGaps(a.challenge).length>0)||a.createdAt-b.createdAt||a.id.localeCompare(b.id));
}
export function challengeReminder(entries:Entry[]):ChallengeReminder|null{
 if(!entries.length)return null;
 const ids=entries.map(e=>e.id);
 if(entries.length>1)return {ids,title:'فرصة لتوضيح تحدياتك',text:'بعض تحدياتك كُتبت قبل تطوير مساعد بذرة أو ما زالت فيها تفاصيل ناقصة. راجعها لتوضيح الموقف والأثر لمن يقرأها.',action:'راجع تحدياتي',href:myChallengesPath};
 const e=entries[0],gaps=challengeGaps(e.challenge),title=e.challenge.title.trim();
 const subject=title?'«'+title+'»':'تحدّيك';
 return {ids,title:gaps.length?'تفاصيل تجعل تحدّيك أوضح':'فرصة لمراجعة تحدّيك',
  text:gaps.length?subject+' فيه تفاصيل ناقصة. استكمالها يساعد زملاءك على فهم التحدي وأثره.':subject+' كُتب قبل تطوير مساعد بذرة. راجع وضوح الموقف والأشخاص المتأثرين والأثر المتوقع.',
  action:'قيّم البطاقة مع بذرة',href:'/challenge/'+e.id+'?review=1'};
}

// Only opaque challenge IDs are stored, per signed-in account. No content or contact details.
const prefix='badra-improvement-reminder:v1:',memory=new Map<string,Set<string>>();
export function reminderStorageKey(actor:string){return prefix+actor}
export function readReminded(actor:string,storage:Pick<Storage,'getItem'>|null):Set<string>{
 const known=new Set(memory.get(actor)||[]);
 try{const saved=JSON.parse(storage?.getItem(reminderStorageKey(actor))||'[]');if(Array.isArray(saved))for(const id of saved)if(typeof id==='string')known.add(id)}catch{}
 return known;
}
export function rememberChallenges(actor:string,ids:string[],storage:Pick<Storage,'getItem'|'setItem'>|null){
 const known=readReminded(actor,storage);ids.forEach(id=>known.add(id));memory.set(actor,known);
 try{storage?.setItem(reminderStorageKey(actor),JSON.stringify([...known]))}catch{}
}
