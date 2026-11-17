import {readRoles} from '../participant-roles';
import {otpConfigured} from './otp-provider';
import ipaddr from 'ipaddr.js';
import {database,fail} from './access';
export const sessionCookie='__Host-badra-employee';
export const sessionMaxAge=30*24*60*60;
const renewalInterval=24*60*60*1000;
export const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export function normalizeNumber(value:string){return value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));}
// Only the platform-supplied Cloudflare client address is accepted. Never trust X-Forwarded-For.
export function clientIp(r:Request){const ip=r.headers.get('cf-connecting-ip')||'';if(!ipaddr.isValid(ip)||ip==='2a06:98c0:3600::103')return '';return ip;}
export async function policy(){return await database().prepare('SELECT * FROM participation_settings WHERE id=1').first() as any||{id:1,networks:'[]',revision:0,otp_channel:'sms'};}
export const otpReady=otpConfigured;
export function readCookie(r:Request){return (r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)||'';}
export async function sessionEmployee(r:Request){const secret=readCookie(r);if(!/^[a-f0-9]{64}$/.test(secret))return null;return await database().prepare('SELECT e.id,e.number,e.phone,e.name,e.email,e.department,e.roles FROM employee_sessions s JOIN employees e ON e.id=s.employee_id WHERE s.digest=? AND s.expires_at>? AND e.active=1').bind(await hash(secret),Date.now()).first() as {id:string;number:string|null;phone:string|null;name:string;email:string|null;department:string;roles:string}|null;}
export async function employee(r:Request){const e=await sessionEmployee(r);return e?.name.trim()&&readRoles(e.roles).length?e:null;}
export async function participationGate(_r:Request,v:{employeeId?:string;needsProfile?:boolean}){if(!v.employeeId)return fail('سجّل دخولك برقم جوالك للمشاركة.',401);return v.needsProfile?fail('أضف اسم إدارتك من حسابي لإكمال المشاركة.',409):null;}
export async function rate(key:string,limit:number,window:number){const now=Date.now();const bucket=Math.floor(now/window);return !!await database().prepare('INSERT INTO auth_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key+':'+bucket,now+window*2,limit).first();}
export async function audit(actor:string,action:string){await database().prepare('INSERT INTO security_audit(id,actor,action,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),actor,action,Date.now()).run();}
export function sessionHeader(secret:string,maxAge=sessionMaxAge){return `${sessionCookie}=${secret}; Path=/; Max-Age=${maxAge}; Expires=${new Date(maxAge>0?Date.now()+maxAge*1000:0).toUTCString()}; HttpOnly; Secure; SameSite=Lax`;}

// Renew at most once a day. UPDATE-only ensures logout/revocation can never recreate a session.
export async function renewEmployeeSession(r:Request,response:Response){
 const secret=readCookie(r);if(!/^[a-f0-9]{64}$/.test(secret))return response;
 const now=Date.now(),expires=now+sessionMaxAge*1000;
 const renewed=await database().prepare('UPDATE employee_sessions SET expires_at=? WHERE digest=? AND expires_at>? AND expires_at<=? AND EXISTS (SELECT 1 FROM employees e WHERE e.id=employee_sessions.employee_id AND e.active=1) RETURNING digest').bind(expires,await hash(secret),now,expires-renewalInterval).first();
 if(renewed)response.headers.append('Set-Cookie',sessionHeader(secret));
 return response;
}
