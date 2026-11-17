export const rubric=[
 ['أثر الحل في التشغيل','إلى أي مدى يعالج الحل نقاط الألم ويوفّر الوقت والجهد في العمل؟',20],
 ['قابلية الحل للتنفيذ','هل يمكن تشغيل الحل بالأدوات والموارد المتاحة خلال مدة قصيرة؟',15],
 ['الابتكار والإبداع','هل يقدّم الحل فكرة جديدة أو طريقة مختلفة عن الحلول القائمة؟',15],
 ['وضوح بطاقة التحدي والابتكار','هل صاغ الفريق المشكلة والأطراف ونقاط الألم والحل بوضوح؟',10],
 ['مشاركة جميع أفراد الفريق','هل أسهم جميع الأعضاء في التحليل والبناء والعرض؟',5],
 ['استيفاء جميع المتطلبات','هل سُلّم النموذج الأولي والعرض في الموعد ووفق القالب؟',5],
] as const;
export const weighted=(scores:number[])=>rubric.reduce((sum,r,i)=>sum+(scores[i]||0)*r[2]/5,0);

export type JudgingReview={eligible?:boolean;person:string;name:string;stamp:number;card:{signature:string;notes:string[];scores:number[];total:number}};
export type JudgingRow={id:string;title:string;rank:number;result:TeamResult;evaluations?:JudgingReview[]};
export type TeamResult={required:number;submitted:number;committee:number|null;audience:number|null;final:number|null};
const hundredths=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
// Each eligible evaluator contributes one equally weighted card. Zero audience points
// is a recorded grade; null means the audience result has not been entered.
export function teamResult(required:number,submittedScores:number[][],audience:number|null):TeamResult{
 const submitted=submittedScores.length;
 const average=submitted?submittedScores.reduce((n,s)=>n+weighted(s),0)/submitted:null;
 return {required,submitted,committee:average===null?null:hundredths(average),audience,
  final:average!==null&&audience!==null?hundredths(average+audience):null};
}

// A running sum is available as soon as both components exist. Completeness only labels it.
export function resultDisplay(r:TeamResult){
 const complete=r.final!==null&&r.required>0&&r.submitted===r.required;
 const value=r.final??r.committee;
 const status=!r.required?'بانتظار تكليف محكّم':!r.submitted?'بانتظار أول بطاقة تقييم':r.audience===null?'بانتظار درجة الجمهور':complete?'اكتملت البطاقات ودرجة الجمهور':'نتيجة حالية · التحكيم جارٍ';
 return {complete,value,max:r.final===null?70:100,status,
  label:complete?'النتيجة النهائية':r.committee!==null&&r.audience===null?'النتيجة الحالية · اللجنة فقط':'النتيجة الحالية'};
}
