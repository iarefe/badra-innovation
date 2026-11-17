import {z} from 'zod';
import {challengeExtras,challengeSchema,domains,frequencies,scopes,type Challenge,type Entry,type Viewer} from './challenges';
import {chatFields,chatFieldLimits} from './ai-challenge';
import display from './challenge-chat-display.json';

export type RevisionField=Exclude<keyof Challenge,'author'>;
export type RevisionMode='edit'|'assess';
export const revisionFields=(Object.keys(chatFields) as (keyof Challenge)[]).filter((k):k is RevisionField=>k!=='author');
export const reviewFields=['title','situation','stakeholders','need','impact','evidence','success','workaround','question','assumptions','inScope','outOfScope','criteria','initialSolution','initialSolutionOutcome'] as const;
export type ReviewField=typeof reviewFields[number];
export type ReviewFinding={field:ReviewField;reason:string;proposal:string;question:string};
export type CardReview={summary:string;strengths:string[];findings:ReviewFinding[];source:'ai'|'guide';notice?:string};
export const revisionOptions:Partial<Record<RevisionField,readonly (readonly [string,string])[]>>={
 scope:scopes.map(v=>[v,v]),domain:domains.map(v=>[v,v]),frequency:frequencies.map(v=>[v,v]),
 ownership:[['individual','أتبناه بمفردي'],['shared','معي زملاء أو فريق']],
 initialSolutionStatus:[['none','لم أنفّذ حلًا أوليًا'],['implemented','نفّذت تجربة أو حلًا أوليًا']],
};
const mainKeys=display.sections.flatMap(s=>s.keys);
export const revisionGroups=[...display.sections.map(s=>({title:s.title,keys:s.keys.filter(k=>revisionFields.includes(k as RevisionField)) as RevisionField[]})),{title:display.additionalTitle,keys:revisionFields.filter(k=>!mainKeys.includes(k))}];
export function fieldVisible(field:RevisionField,card:Partial<Challenge>){return field==='coOwners'?card.ownership==='shared':field==='initialSolution'||field==='initialSolutionOutcome'?card.initialSolutionStatus==='implemented':true}
export function canRevise(entry:Entry,viewer:Viewer,finalized:boolean){return !entry.example&&!!viewer.employee&&!viewer.needsProfile&&(!!entry.mine||viewer.manager)&&!(entry.status==='published'&&finalized)}
export function readCard(raw:Partial<Challenge>):Challenge{
 const fields=Object.fromEntries((Object.keys(chatFields) as (keyof Challenge)[]).map(k=>[k,typeof raw[k]==='string'?raw[k]:'']));
 return {...challengeExtras,...fields} as Challenge;
}
export function displayValue(k:RevisionField,value:string){return revisionOptions[k]?.find(([v])=>v===value)?.[1]||value;}
export function revisedCard(base:Challenge,working:Challenge):Challenge{
 const card={...working};
 if(base.ownership!==card.ownership&&card.ownership==='individual')card.coOwners='';
 if(base.initialSolutionStatus!==card.initialSolutionStatus&&card.initialSolutionStatus==='none'){card.initialSolution='';card.initialSolutionOutcome=''}
 return card;
}
export function changesBetween(base:Challenge,next:Challenge){return Object.fromEntries(revisionFields.filter(k=>(base[k]||'').trim()!==(next[k]||'').trim()).map(k=>[k,(next[k]||'').trim()])) as Partial<Record<RevisionField,string>>}
export type RevisionPatch=ReturnType<typeof changesBetween>;
export function issueForChanges(base:Challenge,patch:RevisionPatch,strict=true):string{
 const c=revisedCard(base,{...base,...patch} as Challenge);
 for(const k of Object.keys(patch) as RevisionField[]){
  if(!revisionFields.includes(k))return 'لا يمكن تعديل هذه الخانة.';
  if(!fieldVisible(k,c)&&patch[k]?.trim())return 'الخانة «'+chatFields[k]+'» لا تنطبق على اختيارات البطاقة الحالية.';
  if(!challengeSchema.shape[k].safeParse(c[k]).success||((k==='need'&&c.need.length<10)||(k==='ownership'&&!c.ownership)||(k==='initialSolutionStatus'&&!c.initialSolutionStatus)))return 'راجع خانة «'+chatFields[k]+'»؛ تأكّد من اكتمال النص أو اختيار قيمة صالحة.';
 }
 if(strict&&c.ownership==='shared'&&('ownership' in patch||'coOwners' in patch)&&c.coOwners.trim().length<2)return 'اكتب أسماء الشركاء أو اسم الفريق.';
 if(strict&&c.initialSolutionStatus==='implemented'&&('initialSolutionStatus' in patch||'initialSolution' in patch)&&c.initialSolution.trim().length<10)return 'صِف التجربة التي نُفّذت في عشرة أحرف على الأقل.';
 return '';
}
// Never accept arbitrary keys such as author, owner, status, engagement data, or timestamps.
export const payloadPatch=z.object(Object.fromEntries(revisionFields.map(k=>[k,z.string().trim().max(chatFieldLimits[k]).optional()])) as Record<RevisionField,z.ZodOptional<z.ZodString>>).strict();
