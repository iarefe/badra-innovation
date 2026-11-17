import {domains,scopes,frequencies,type Challenge} from './challenges';

export type ChallengeGap={key:keyof Challenge;label:string;step:number};
const textRequirements:[keyof Challenge,string,number,number][]=[
 ['title','عنوان التحدي',8,1],['department','الجهات أو الفرق المتأثرة',2,1],
 ['situation','الموقف الذي يوضح التحدي',40,1],['stakeholders','الأشخاص المتأثرون',10,2],
 ['need','ما الذي يحاول المتأثرون إنجازه؟',10,2],['evidence','شاهد من الواقع',15,2],
 ['workaround','طريقة التعامل الحالية',15,2],['impact','أثر استمرار التحدي',30,3],
 ['success','علامة تحسّن الوضع',15,3]
];
const length=(value:unknown)=>typeof value==='string'?value.trim().length:0;
export function challengeGaps(c:Partial<Record<keyof Challenge,string>>):ChallengeGap[]{
 const gaps=textRequirements.filter(([key,,min])=>length(c[key])<min).map(([key,label,,step])=>({key,label,step}));
 if(!scopes.some(value=>value===c.scope))gaps.push({key:'scope',label:'نطاق المشروع وجمهوره',step:1});
 if(!domains.some(value=>value===c.domain))gaps.push({key:'domain',label:'مجال التحدي',step:1});
 if(!frequencies.some(value=>value===c.frequency))gaps.push({key:'frequency',label:'تكرار التحدي',step:2});
 if(!['individual','shared'].includes(c.ownership||''))gaps.push({key:'ownership',label:'هل تتبنى التحدي بمفردك أم مع فريق؟',step:3});
 else if(c.ownership==='shared'&&length(c.coOwners)<2)gaps.push({key:'coOwners',label:'أسماء الشركاء أو الفريق',step:3});
 if(!['none','implemented'].includes(c.initialSolutionStatus||''))gaps.push({key:'initialSolutionStatus',label:'هل جُرّب حل أولي؟',step:3});
 else if(c.initialSolutionStatus==='implemented'&&length(c.initialSolution)<10)gaps.push({key:'initialSolution',label:'وصف الحل الأولي المجرّب',step:3});
 return gaps;
}

// Supplemental context may be filled without changing the description people
// voted on. Complete fields, title and core description remain immutable here.
export const supplementalKeys=['need','ownership','coOwners','initialSolutionStatus','initialSolution','initialSolutionOutcome'] as const;
export type SupplementalKey=typeof supplementalKeys[number];
export function canSupplement(c:Partial<Challenge>){const gaps=challengeGaps(c);return gaps.length>0&&gaps.every(g=>supplementalKeys.includes(g.key as SupplementalKey));}
export function allowedSupplements(c:Partial<Challenge>,patch:Partial<Record<keyof Challenge,string>>){
 const gaps=new Set(challengeGaps(c).map(g=>g.key)),allowed=new Set<keyof Challenge>();
 if(gaps.has('need'))allowed.add('need');
 if(gaps.has('ownership')){allowed.add('ownership');if(patch.ownership==='shared')allowed.add('coOwners');}
 if(gaps.has('coOwners'))allowed.add('coOwners');
 if(gaps.has('initialSolutionStatus')){
  allowed.add('initialSolutionStatus');
  if(patch.initialSolutionStatus==='implemented'){allowed.add('initialSolution');allowed.add('initialSolutionOutcome');}
 }
 if(gaps.has('initialSolution')){allowed.add('initialSolution');if(!length(c.initialSolutionOutcome))allowed.add('initialSolutionOutcome');}
 return allowed;
}

export function completionKeys(c:Partial<Challenge>,candidate:Partial<Record<keyof Challenge,string>>){
 const allowed=allowedSupplements(c,candidate);
 for(const gap of challengeGaps(c))allowed.add(gap.key);
 return allowed;
}
export function mergeCompletionDraft(c:Partial<Challenge>,candidate:Record<string,string>){
 const allowed=completionKeys(c,candidate as Partial<Challenge>);
 return {...c,...Object.fromEntries(Object.entries(candidate).filter(([key])=>allowed.has(key as keyof Challenge)))};
}
export const completionQuestions:Partial<Record<keyof Challenge,string>>={
 need:'ما المهمة التي يحاول المتأثرون إنجازها عندما يظهر التحدي؟',
 ownership:'هل تتبنى هذا التحدي بمفردك أم معك زملاء؟',
 coOwners:'ما أسماء شركائك أو اسم الفريق؟ ستظهر في البطاقة بموافقتهم.',
 initialSolutionStatus:'هل سبق أن نفّذت حلًا أوليًا لهذا التحدي؟',
 initialSolution:'ما الذي جرّبته بالفعل لمعالجة هذا التحدي؟'
};
export function completionGreeting(c:Partial<Challenge>){
 return `أهلًا بك، بيانات تحدّيك موجودة أمامي. ستكمل معي التفاصيل الناقصة فقط، ثم تراجع الإضافات قبل حفظها.\n\n${nextCompletionQuestion(c)}`;
}
export function nextCompletionQuestion(c:Partial<Challenge>){const first=challengeGaps(c)[0];if(first?.key==='need'&&c.title?.trim())return 'في تحدّي «'+c.title.trim()+'»، ما الذي يحتاج الشخص المتأثر إلى إنجازه؟';return first?(completionQuestions[first.key]||`حدّثني عن ${first.label}.`):'التفاصيل الأساسية مكتملة؛ يمكنك مراجعة الإضافات وحفظها.';}
