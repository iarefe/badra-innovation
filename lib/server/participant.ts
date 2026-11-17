import {profileDepartment} from '../profile-department';
import {viewer,isManagerPhone,sameOrigin,fail} from './access';
import {readRoles,ParticipantRole} from '../participant-roles';
import {sessionEmployee,renewEmployeeSession} from './employee';

const cookieName='__Host-badra-visitor';
export type Participant=Awaited<ReturnType<typeof viewer>>&{employeeId?:string;employeeName?:string;department?:string;employeeNumber?:string;roles?:ParticipantRole[];needsProfile?:boolean;session?:Awaited<ReturnType<typeof sessionEmployee>>};

// Read the session once per request. Contribution roles never grant manager access.
export async function readParticipant(r:Request){
 const session=await sessionEmployee(r),roles=readRoles(session?.roles),e=session?.name.trim()&&roles.length?session:null;
 const v:Participant={id:e?'employee:'+e.id:'',email:e?.email||'',signedIn:!!e,manager:!!e&&isManagerPhone(e.phone),employee:!!e,needsProfile:!!session&&(!e||!profileDepartment(e.department)),session};
 if(e){v.employeeId=e.id;v.employeeName=e.name;v.department=e.department;v.roles=roles;v.employeeNumber=e.number||undefined;}
 const existing=(r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 const valid=!!existing&&/^[a-f0-9]{64}$/.test(existing);
 const secret=valid?existing!:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
 if(!v.id){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));v.id='guest:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
 return {v,valid,secret};
}
// Preserve guest identity and enforce origin checks. Contribution routes separately require verified participation.
export async function withParticipant(r:Request,run:(v:Participant)=>Promise<Response>){
 if(r.method!=='GET'&&(!sameOrigin(r)||r.headers.get('sec-fetch-site')==='cross-site'))return fail('طلب غير مسموح.',403);
 try{const {v,valid,secret}=await readParticipant(r);const response=await run(v);
  if(v.session&&response.ok)await renewEmployeeSession(r,response);
  if(!valid)response.headers.append('Set-Cookie',`${cookieName}=${secret}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  response.headers.set('Cache-Control','private, no-store');return response;
 }catch{return fail('تعذّر الاتصال. حاول مجددًا.',500);}
}
