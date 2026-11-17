import {z} from 'zod';
import {challengeSchema} from './challenges';
import {interviewStateSchema} from './interview-state';
export const chatFields={ownership:'ملكية التحدي',coOwners:'الشركاء في التحدي',initialSolutionStatus:'هل جُرّب حل أولي؟',initialSolution:'الحل الأولي الذي جُرّب',initialSolutionOutcome:'نتيجة التجربة وما بقي من التحدي',title:'عنوان التحدي',scope:'نطاق المشروع وجمهوره',domain:'المجال',department:'الجهات أو الفرق المتأثرة',situation:'الموقف',stakeholders:'المتأثرون',need:'ما يحاولون إنجازه',frequency:'التكرار',impact:'الأثر',evidence:'الشاهد',workaround:'التعامل الحالي',success:'علامة التحسن',author:'اسم العرض',assumptions:'فرضيات تحتاج تحققًا',inScope:'حدود العمل: يشمل',outOfScope:'حدود العمل: لا يشمل',criteria:'معايير قبول الحلول',question:'سؤال التحدي'};
export const optionalChatKeys=['coOwners','initialSolution','initialSolutionOutcome','assumptions','inScope','outOfScope','criteria','question'] as const;
export const coreChatKeys=Object.keys(chatFields).filter(k=>!optionalChatKeys.includes(k as any)) as (keyof typeof chatFields)[];
export type ChatDraft=Record<keyof typeof chatFields,string>;
export const emptyChatDraft=Object.fromEntries(Object.keys(chatFields).map(k=>[k,''])) as ChatDraft;
export const chatFieldLimits={ownership:20,coOwners:500,initialSolutionStatus:20,initialSolution:1200,initialSolutionOutcome:700,title:110,scope:20,domain:60,department:100,situation:1200,stakeholders:500,need:500,frequency:50,impact:1000,evidence:700,workaround:700,success:500,author:60,assumptions:700,inScope:700,outOfScope:700,criteria:700,question:500};
const limits=chatFieldLimits;
export const chatDraftSchema=z.object(Object.fromEntries(Object.entries(limits).map(([k,max])=>[k,z.string().max(max).default('')])) as Record<keyof ChatDraft,z.ZodDefault<z.ZodString>>);
export const chatResultSchema=z.object({message:z.string().min(1).max(1800),draft:chatDraftSchema,ready:z.boolean(),reviewRequested:z.boolean().optional(),interview:interviewStateSchema.optional()});
export const interviewFieldMinimums={need:10,coOwners:2,initialSolution:10} as const;
export function missingFields(draft:ChatDraft){const result=challengeSchema.safeParse(draft);const fields=result.success?[]:[...new Set(result.error.issues.map(x=>String(x.path[0])))];if(draft.need.trim().length<interviewFieldMinimums.need)fields.push('need');if(!['individual','shared'].includes(draft.ownership))fields.push('ownership');
if(draft.ownership==='shared'&&draft.coOwners.trim().length<interviewFieldMinimums.coOwners)fields.push('coOwners');
if(!['none','implemented'].includes(draft.initialSolutionStatus))fields.push('initialSolutionStatus');
if(draft.initialSolutionStatus==='implemented'&&draft.initialSolution.trim().length<interviewFieldMinimums.initialSolution)fields.push('initialSolution');
return [...new Set(fields)];}
