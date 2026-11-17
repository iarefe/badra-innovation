import {profileDepartment} from '@/lib/profile-department';
import {database,fail} from '@/lib/server/access';
import {withParticipant} from '@/lib/server/participant';
import {challengeExtras,exampleChallenges,type Challenge} from '@/lib/challenges';
import {arabicPdfFonts} from '@/lib/server/pdf-fonts';
export const dynamic='force-dynamic';
export async function GET(request:Request){return withParticipant(request,async viewer=>{
 const id=new URL(request.url).searchParams.get('id')||'';
 const sample=exampleChallenges.find(x=>x.id===id);
 let challenge:Challenge|undefined=sample?.challenge,authorDepartment='';
 if(!challenge){
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return fail('التحدي غير متاح.',404);
  const record=await database().prepare("SELECT c.payload,e.department AS author_department FROM challenges c LEFT JOIN employees e ON c.owner='employee:'||e.id WHERE c.id=? AND (c.status='published' OR c.owner=? OR ?=1)").bind(id,viewer.id,viewer.manager?1:0).first<{payload:string;author_department:string|null}>();
  if(!record)return fail('التحدي غير متاح.',404);
  challenge={...challengeExtras,...JSON.parse(record.payload)} as Challenge;authorDepartment=profileDepartment(record.author_department);
 }
 const {createChallengePdf}=await import('@/lib/server/challenge-pdf');
 const pdf=await createChallengePdf(challenge,!!sample,arabicPdfFonts(),authorDepartment);
 const name=encodeURIComponent('بطاقة التحدي - '+challenge.title.replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').slice(0,100)+'.pdf').replace(/'/g,'%27');
 return new Response(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename=\"challenge.pdf\"; filename*=UTF-8''"+name,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
})}
