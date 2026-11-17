import {database,fail,viewer} from '@/lib/server/access';
import {ensureProspectiveEmployees} from '@/lib/server/prospective-employees';
import {readHackathonReport,reportDay} from '@/lib/server/hackathon-report';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const v=await viewer(request);
  if(!v.manager)return fail('هذا التقرير متاح لمدير النظام فقط.',v.signedIn?403:401);
  await ensureProspectiveEmployees();
  const snapshot=await readHackathonReport(database());
  const {createHackathonReportPdf}=await import('@/lib/server/hackathon-report-pdf');
  const day=reportDay(snapshot.generatedAt),pdf=await createHackathonReportPdf(snapshot);
  const file='تقرير الهاكاثون - '+day+'.pdf';
  return new Response(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="hackathon-report-${day}.pdf"; filename*=UTF-8''${encodeURIComponent(file)}`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, noarchive'}});
 }catch{return fail('تعذّر تجهيز التقرير. حاول تصديره مرة أخرى.',503)}
}
