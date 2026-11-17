// Canonical identity for lookup, uniqueness and rate limits. Arabic numerals are accepted.
export function normalizePhone(value:string){
 let phone=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'');
 if(phone.startsWith('00'))phone='+'+phone.slice(2);
 if(/^05\d{8}$/.test(phone))phone='+966'+phone.slice(1);
 else if(/^5\d{8}$/.test(phone))phone='+966'+phone;
 else if(/^9665\d{8}$/.test(phone))phone='+'+phone;
 if(phone.startsWith('+966'))return /^\+9665\d{8}$/.test(phone)?phone:'';
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:'';
}
