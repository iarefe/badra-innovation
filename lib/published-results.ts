export type Standing={id:string;title:string;teamNumber:number;place:number;score:number};
export type PublishedResults={revision:number;publishedAt:number;standings:Standing[]};
export type PublicationPreview={standings:Standing[];fingerprint:string;revision:number;reason:string|null;unchanged:boolean};
const ordinal=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
const digits=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
export const numberLabel=(n:number)=>digits.format(n);
export const placeLabel=(n:number)=>'المركز '+(ordinal[n-1]||numberLabel(n));
export const champions=(items:Standing[])=>items.filter(t=>t.place===1);
