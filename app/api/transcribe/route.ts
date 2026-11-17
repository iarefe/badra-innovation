import {env} from 'cloudflare:workers';
import {reply,fail} from '@/lib/server/access';
import {withParticipant} from '@/lib/server/participant';
import {participationGate,rate} from '@/lib/server/employee';
export const dynamic='force-dynamic';
const maxBytes=4*1024*1024;
const formats:Record<string,string>={'audio/webm':'webm','video/webm':'webm','audio/mp4':'mp4','video/mp4':'mp4','audio/ogg':'ogg','audio/wav':'wav','audio/mpeg':'mp3','audio/x-m4a':'m4a'};
export async function POST(r:Request){return withParticipant(r,async v=>{
 const gate=await participationGate(r,v);if(gate)return gate;
 if(!(env as any).OPENAI_API_KEY)return fail('الكتابة بالصوت غير متاحة الآن. يمكنك كتابة إجابتك.',503);
 if(!r.headers.get('content-type')?.startsWith('multipart/form-data'))return fail('أرسل تسجيلًا صوتيًا صالحًا.',415);
 if(Number(r.headers.get('content-length'))>maxBytes)return fail('التسجيل كبير. سجّل مقطعًا أقصر من ٩٠ ثانية.',413);
 if(!await rate('voice:'+v.employeeId,20,3600000)||!await rate('voice-global',200,86400000))return fail('بلغ التسجيل الصوتي حد الاستخدام الآن. يمكنك متابعة الكتابة.',429);
 try{
  // Bound even chunked uploads before parsing multipart data; audio is never stored.
  const reader=r.body?.getReader();if(!reader)return fail('التسجيل فارغ.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();return fail('التسجيل كبير. جرّب مقطعًا أقصر.',413);}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const form=await new Response(bytes,{headers:{'Content-Type':r.headers.get('content-type')!}}).formData();
  const file=form.get('audio');if(!(file instanceof File)||!file.size)return fail('لم يصل صوت. سجّل المقطع مجددًا.');
  const extension=formats[file.type.split(';')[0]];if(!extension)return fail('صيغة التسجيل غير مدعومة. جرّب متصفحًا آخر.',415);
  const body=new FormData();body.append('file',file,'recording.'+extension);body.append('model','gpt-4o-mini-transcribe');body.append('language','ar');body.append('response_format','json');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',redirect:'manual',headers:{Authorization:`Bearer ${(env as any).OPENAI_API_KEY}`},body,signal:AbortSignal.timeout(60000)});
  if(!response.ok)return fail('تعذّر تحويل الصوت الآن. يمكنك إعادة المحاولة أو كتابة إجابتك.',503);
  const data:any=await response.json();if(typeof data.text!=='string'||!data.text.trim())return fail('لم نلتقط كلامًا واضحًا. سجّل مجددًا بالقرب من الميكروفون.',422);
  if(data.text.length>4000)return fail('النص أطول من إجابة واحدة. قسّم التسجيل إلى مقاطع أقصر.',422);
  return reply({text:data.text.trim()});
 }catch{return fail('تعذّر تحويل الصوت. حاول مجددًا أو تابع بالكتابة.',503);}
});}
