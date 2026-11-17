import {z} from 'zod';
export const roleIds=['challenger','innovator','developer','creative'] as const;
export type ParticipantRole=typeof roleIds[number];
export const participantRoles=[
 {id:'challenger',label:'متحدّي',description:'لدي تحدٍ أطرحه أو أشترك في طرحه.'},
 {id:'innovator',label:'مبتكر',description:'أرغب في فهم التحديات وابتكار الحلول لها.'},
 {id:'developer',label:'مطور',description:'أرغب في بناء الحل باستخدام أدوات الذكاء الاصطناعي.'},
 {id:'creative',label:'مبدع',description:'أبدع في صناعة العروض وتقديم الحلول والإقناع.'},
] satisfies {id:ParticipantRole;label:string;description:string}[];
export const rolesSchema=z.array(z.enum(roleIds)).min(1).max(4).refine(values=>new Set(values).size===values.length);
export function readRoles(raw:unknown):ParticipantRole[]{try{const data=typeof raw==='string'?JSON.parse(raw):raw;return rolesSchema.safeParse(data).success?data:[];}catch{return [];}}
export const roleLabels=(roles:ParticipantRole[])=>participantRoles.filter(r=>roles.includes(r.id)).map(r=>r.label).join(' · ');
