// Split only recognizable source text. Unstructured outcomes are displayed verbatim.
export type OutcomeMetric={label:string;value:string;direction:'↑'|'↓'|''};
const direction=(value:string):OutcomeMetric['direction']=>/^(?:زيادة|ارتفاع|رفع)\s/u.test(value)?'↑':/^(?:انخفاض|خفض|تقليل|تراجع)\s/u.test(value)?'↓':'';
export function outcomeMetrics(source:string):{intro:string;items:OutcomeMetric[]}|null{
 const s=source.trim(), list=s.split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
 if(list.length>1){
  const rows=list.map(x=>x.match(/^[-•]?\s*([^:：]{1,55})[:：]\s*(.+)$/u));
  if(rows.every(Boolean))return {intro:'',items:rows.map(m=>({label:m![1].trim(),value:m![2].trim(),direction:direction(m![2].trim())}))};
 }
 const enumerated=s.match(/^(.+?)[،,]\s*مثل\s+([\s\S]+)$/u);
 if(!enumerated)return null;
 const clauses=enumerated[2].replace(/[.。]\s*$/u,'').split(/[،,؛;]\s*(?:أو\s+)?/u);
 if(clauses.length<2)return null;
 const rows=clauses.map(item=>item.trim().match(/^((?:زيادة|ارتفاع|رفع|انخفاض|خفض|تقليل|تراجع)\s+.+?)\s+في\s+(.+)$/u));
 if(!rows.every(Boolean))return null;
 return {intro:enumerated[1]+'، مثل:',items:rows.map(m=>({label:m![2],value:m![1],direction:direction(m![1])}))};
}
