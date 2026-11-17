import type {HackathonReport,ReportChallenge} from './hackathon-report';

const rank=(a:ReportChallenge,b:ReportChallenge)=>b.votes-a.votes||(a.publishedAt??-1)-(b.publishedAt??-1)||(a.id<b.id?-1:a.id>b.id?1:0);
const ar=new Intl.Collator('ar');
export function reportOverview(r:HackathonReport){
 const published=r.challenges.filter(c=>c.status==='published').sort(rank),unpublished=r.challenges.filter(c=>c.status!=='published');
 const draftCount=unpublished.filter(c=>c.status==='draft').length;
 const voted=published.filter(c=>c.votes>0),withInterest=published.filter(c=>c.interests>0);
 const voteTotal=published.reduce((sum,c)=>sum+c.votes,0),interestTotal=published.reduce((sum,c)=>sum+c.interests,0);
 const domains=new Map<string,number>();
 for(const c of published){const label=c.domain.trim();if(label)domains.set(label,(domains.get(label)||0)+1)}
 const themes=[...domains].sort((a,b)=>b[1]-a[1]||ar.compare(a[0],b[0]));
 const approved=r.workshop.state==='final';
 const picks=approved?r.workshop.selection:voted.slice(0,r.workshop.target);
 const state=approved?'القائمة معتمدة':r.workshop.state==='paused'?'التصويت موقوف مؤقتًا':'التصويت مفتوح';
 const reading=!published.length?'تبدأ قراءة الأولويات بعد نشر أول تحدٍّ. المسودات محفوظة لأصحابها ولا تدخل في الترشيح.'
  :approved?'اعتُمدت قائمة الورشة. تُستخدم رغبات الانضمام لتوزيع المشاركين على الفرق، وتبقى الأصوات المثبّتة عند الاعتماد مرجعًا للترشيح.'
  :!voteTotal?'لم تُسجّل أصوات على التحديات المنشورة بعد. لا تتضح أولوية أحدها من الترتيب الحالي.'
  :!interestTotal?'بدأ التصويت على الأولويات، ولم تُسجَّل رغبات انضمام بعد. دعوة الموظفين لاختيار تحدٍّ يودّون العمل عليه تساعد في تكوين الفرق.'
  :withInterest.length<published.length?'تظهر رغبات الانضمام في بعض التحديات. عند تكوين الفرق، تُراجع هذه الرغبات إلى جانب الأدوار التي يستطيع المشاركون تقديمها.'
  :'لكل تحدٍّ منشور مَن يرغب في العمل عليه. تحدّد الأصوات أولوية الترشيح، وتساعد الرغبات في تكوين الفرق.';
 return {published,unpublished,draftCount,voted:voted.length,withInterest:withInterest.length,voteTotal,interestTotal,themes,picks,approved,state,reading};
}
