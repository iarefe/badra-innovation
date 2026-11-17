import display from './challenge-chat-display.json';
import {chatFields,coreChatKeys,missingFields,optionalChatKeys,type ChatDraft} from './ai-challenge';
import {challengeGaps,nextCompletionQuestion} from './challenge-completion';
import {domains,frequencies,scopes,type Challenge} from './challenges';
import type {Topic} from './interview-state';
import type {ChatMessage} from './client-chat-session';

type Field=keyof ChatDraft;
export {display as assistantDisplay};
const defined=Object.prototype.hasOwnProperty;
const isField=(key:string):key is Field=>defined.call(chatFields,key);
const groups=display.sections.map(section=>({...section,keys:section.keys.filter(isField)}));
const grouped=new Set<Field>(groups.flatMap(g=>g.keys));
const extras=optionalChatKeys.filter(k=>!grouped.has(k));
// Presentation bindings only. The UI consumes the actual topic returned for the last reply;
// it does not select a question, infer answers from message text, or update the interview.
export const focusFields:Record<Topic,Field[]>={
 scene:['situation'],friction:['situation'],people:['stakeholders','need'],impact:['impact'],success:['success'],verify:['evidence'],evidence:['evidence'],
 workaround:['workaround'],frequency:['frequency'],scope:['scope'],domain:['domain'],department:['department'],ownership:['ownership'],coOwners:['coOwners'],
 trialStatus:['initialSolutionStatus'],trialDetail:['initialSolution'],trialOutcome:['initialSolutionOutcome'],review:[],pause:[]
};
function visible(field:Field,draft:ChatDraft){
 if(field==='coOwners')return draft.ownership==='shared';
 if(field==='initialSolution'||field==='initialSolutionOutcome')return draft.initialSolutionStatus==='implemented';
 return true;
}
export function displayValue(key:Field,value:string){
 if(!value)return '';
 if(key==='ownership'&&(value==='shared'||value==='individual'))return display.choices.ownership[value];
 if(key==='initialSolutionStatus'&&(value==='implemented'||value==='none'))return display.choices.initialSolutionStatus[value];
 return value;
}

export function challengeChatView(draft:ChatDraft,ready:boolean,focus:Topic|undefined,messages:ChatMessage[],completion:boolean){
 const missing=new Set(missingFields(draft));
 // The same required fields, conditionals and rounding as the original live card.
 const required:Field[]=coreChatKeys.filter(k=>k!=='author');
 if(draft.ownership==='shared')required.push('coOwners');
 if(draft.initialSolutionStatus==='implemented')required.push('initialSolution');
 const complete=(k:Field)=>!!draft[k].trim()&&!missing.has(k);
 const completed=required.filter(complete).length,total=required.length;
 const canReview=ready&&!missing.size,started=messages.some(m=>m.role==='user');
 let current:Field|undefined;
 if(!canReview){
  if(focus){
   const candidates=focusFields[focus].filter(k=>visible(k,draft));
   current=candidates.find(k=>!complete(k))||candidates.at(-1);
  }else if(!started){
   current=completion?challengeGaps(draft)[0]?.key:'situation';
  }else if(messages.at(-1)?.role==='assistant'&&messages.at(-1)?.content.endsWith(nextCompletionQuestion(draft as Challenge))){
   current=challengeGaps(draft)[0]?.key;
  }
 }
 const sections=groups.map(g=>{
  const keys=g.keys.filter(k=>visible(k,draft)),counted=keys.filter(k=>required.includes(k));
  return {id:g.id,title:g.title,keys,total:counted.length,done:counted.filter(complete).length,optional:false};
 });
 const additional=extras.filter(k=>draft[k].trim());
 if(additional.length)sections.push({id:'extras',title:display.additionalTitle,keys:additional,total:additional.length,done:additional.filter(complete).length,optional:true});
 return {current,sections,activeGroup:sections.find(s=>current&&s.keys.includes(current))?.id,completed,total,remaining:total-completed,percent:Math.round(completed/total*100),canReview,complete,required,started};
}
export type ChatView=ReturnType<typeof challengeChatView>;

export const latinDigits=(s:string)=>s.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
// Server messages already separate the reflection/greeting from the question.
// Preserve their wording; this is only a typographic split.
export function questionParts(content:string){const parts=content.split(/\n\n+/);return {question:parts.at(-1)||'',context:parts.slice(0,-1).join('\n\n')}}
export function conversationAnswers(messages:ChatMessage[]){
 return messages.flatMap((m,index)=>{
  if(m.role!=='user')return [];
  const previous=messages.slice(0,index).findLast(x=>x.role==='assistant');
  return [{index,answer:m.content,field:m.field,question:m.question||questionParts(previous?.content||'').question}];
 });
}
export function fieldOptions(key:Field|undefined):Array<{value:string;label:string}>{
 if(key==='ownership'||key==='initialSolutionStatus')return Object.entries(display.choices[key]).map(([value,label])=>({value,label}));
 const options=key==='scope'?scopes:key==='domain'?domains:key==='frequency'?frequencies:[];
 return options.map(value=>({value,label:value}));
}
export function sectionProgress(view:ChatView){const sections=view.sections.filter(s=>!s.optional);return {total:sections.length,done:sections.filter(s=>s.done===s.total).length}}
