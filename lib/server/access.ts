import {env} from 'cloudflare:workers';
import {employee} from './employee';
const managerPhones=()=>new Set(String((env as any).MANAGER_PHONES||'').split(',').map((s:string)=>s.trim()).filter(Boolean));
export function isManagerPhone(phone:string|null|undefined){return !!phone&&managerPhones().has(phone);}
export function database(){if(!env.DB)throw Error('DB missing');return env.DB;}
// Manager authorization is derived only from the verified, active phone session.
export async function viewer(r:Request){
 const e=await employee(r);
 const manager=!!e&&isManagerPhone(e.phone);
 return {id:e?'employee:'+e.id:'',email:e?.email||'',signedIn:!!e,manager,employee:!!e};
}
export function sameOrigin(r:Request){const origin=r.headers.get('origin');return !origin||origin===new URL(r.url).origin;}
export function reply(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export function fail(error:string,status=400){return reply({error},status);}
// One-time, owner-authorized closure on deployment. Never deletes votes or interests; subsequent manager choices persist.
export async function settings(){await database().prepare('UPDATE workshop_settings SET open=0,joining_open=0,engagement_controls_initialized=1,revision=revision+1 WHERE id=1 AND engagement_controls_initialized=0').run();const s=await database().prepare('SELECT * FROM workshop_settings WHERE id=1').first() as any||{id:1,title:'هاكاثون الابتكار الرقمي',count:3,open:0,joining_open:0,finalized:0,revision:0};if(s.title==='ورشة ابتكار حلول المؤسسة')s.title='هاكاثون الابتكار الرقمي';return s;}
export async function ensureSettings(){await database().prepare("INSERT OR IGNORE INTO workshop_settings(id,title,count,open,finalized,revision) VALUES(1,'هاكاثون الابتكار الرقمي',3,0,0,0)").run();}
export const rankedSQL=`SELECT c.*, (SELECT COUNT(*) FROM challenge_votes v WHERE v.challenge_id=c.id AND v.user_id LIKE 'employee:%' AND v.user_id<>c.owner) AS votes FROM challenges c WHERE c.status='published' ORDER BY votes DESC,c.published_at ASC,c.id ASC`;
