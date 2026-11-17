import type {Challenge} from './challenges';
export type ChallengeCover={url:string;status:'none'|'pending'|'ready'|'failed';source:'generated'|'upload'|'default';prompt?:string};
// The published challenge keeps its generated illustration.
export const seededCovers:Record<string,string>={};
const exampleCovers:Record<string,string>={'example-1':'/placeholder.svg','example-2':'/placeholder.svg','example-3':'/placeholder.svg'};
export function defaultCover(c:Pick<Challenge,'domain'|'title'|'situation'>){
 const text=c.title+' '+c.situation;
 if(/معرف|كتب|وثائق|معلومات|بيانات/.test(text)&&c.domain==='المعرفة والبيانات')return '/placeholder.svg';
 if(c.domain==='العمليات والاجتماعات')return '/placeholder.svg';
 if(c.domain==='المنح والمشاريع')return '/placeholder.svg';
 if(c.domain==='الاستشارات وتأسيس الجهات'||c.domain==='تجربة الجهات المستفيدة')return '/placeholder.svg';
 return '/placeholder.svg';
}
export function initialCover(id:string,c:Pick<Challenge,'domain'|'title'|'situation'>):ChallengeCover{if(exampleCovers[id])return {url:exampleCovers[id],status:'ready',source:'default'};return {url:seededCovers[id]||defaultCover(c),status:seededCovers[id]?'ready':'none',source:seededCovers[id]?'generated':'default'};}
