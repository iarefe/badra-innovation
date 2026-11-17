import {z} from 'zod';
import {database,fail,reply,settings} from '@/lib/server/access';
import {withParticipant,type Participant} from '@/lib/server/participant';
import {participationGate} from '@/lib/server/employee';
import {assessCard} from '@/lib/server/card-review';
import {changesBetween,issueForChanges,payloadPatch,readCard,revisedCard} from '@/lib/challenge-revision';
import type {Challenge} from '@/lib/challenges';
export const dynamic='force-dynamic';
const idSchema=z.string().uuid(),base=z.object({id:idSchema,version:z.number().int().nonnegative(),fields:payloadPatch}).strict();
const assessment=base.extend({clarification:z.string().trim().max(1000).optional()}).strict();
type Row={id:string;owner:string;status:string;payload:string;updated_at:number};
async function editable(r:Request,v:Participant,id:string):Promise<Row|Response>{
 const gate=await participationGate(r,v);if(gate)return gate;
 if(!idSchema.safeParse(id).success)return fail('هذه البطاقة غير متاحة للتعديل.',404);
 const row=await database().prepare('SELECT id,owner,status,payload,updated_at FROM challenges WHERE id=? AND (owner=? OR ?=1)').bind(id,v.id,v.manager?1:0).first<Row>();
 if(!row)return fail('تقييم البطاقة وتعديلها متاحان لصاحب التحدي ومدير النظام فقط.',403);
 if(row.status==='published'&&(await settings()).finalized)return fail('اعتُمدت القائمة النهائية. يتاح تعديل البطاقة بعد إعادة فتحها.',409);
 return row;
}
const conflict=()=>reply({code:'changed',error:'عُدّلت البطاقة من مكان آخر. حمّل أحدث نسخة ثم راجع تعديلاتك قبل الحفظ.'},409);
const snapshot=(r:Row)=>({id:r.id,version:r.updated_at,challenge:readCard(JSON.parse(r.payload)),status:r.status});
export async function GET(r:Request){return withParticipant(r,async v=>{
 const row=await editable(r,v,new URL(r.url).searchParams.get('id')||'');return row instanceof Response?row:reply(snapshot(row));
})}
async function body(r:Request){const text=await r.text();if(text.length>22000)return null;try{return JSON.parse(text)}catch{return null}}
// Assessment is read-only. Even a valid model response cannot write to a card.
export async function POST(r:Request){return withParticipant(r,async v=>{
 const p=assessment.safeParse(await body(r));if(!p.success)return fail('تعذّر قراءة البطاقة المطلوبة للتقييم.');
 const row=await editable(r,v,p.data.id);if(row instanceof Response)return row;
 if(row.updated_at!==p.data.version)return conflict();
 const current=snapshot(row).challenge,card=revisedCard(current,{...current,...p.data.fields} as Challenge);
 return reply({review:await assessCard(r,v.id,card,p.data.clarification||'')});
})}
export async function PATCH(r:Request){return withParticipant(r,async v=>{
 const p=base.safeParse(await body(r));if(!p.success)return fail('يمكن تعديل خانات البطاقة فقط.');
 const row=await editable(r,v,p.data.id);if(row instanceof Response)return row;
 if(row.updated_at!==p.data.version)return conflict();
 const data=JSON.parse(row.payload),current=readCard(data),next=revisedCard(current,{...current,...p.data.fields} as Challenge);
 const changes=changesBetween(current,next);if(!Object.keys(changes).length)return reply(snapshot(row));
 const issue=issueForChanges(current,p.data.fields);if(issue)return fail(issue);
 const now=Math.max(Date.now(),row.updated_at+1),json=JSON.stringify({...data,...changes});
 const allowed="id=? AND (owner=? OR ?=1) AND updated_at=? AND payload=? AND status=? AND (status<>'published' OR NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND finalized=1))";
 const args=[row.id,v.id,v.manager?1:0,row.updated_at,row.payload,row.status],db=database();
 const result=await db.batch([
  db.prepare('INSERT INTO security_audit(id,actor,action,created_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM challenges WHERE '+allowed+')').bind(crypto.randomUUID(),v.id,'تعديل بطاقة التحدي: '+row.id,now,...args),
  db.prepare('UPDATE challenges SET payload=?,updated_at=? WHERE '+allowed+' RETURNING id').bind(json,now,...args),
 ]);
 if(!result[1].results?.length)return conflict();
 return reply(snapshot({...row,payload:json,updated_at:now}));
})}
