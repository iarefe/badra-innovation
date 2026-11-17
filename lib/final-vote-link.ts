import {displayOrigin} from './presentation';
// Keep voting on the visitor-facing production host, never encode an admin or preview URL.
export function ballotLink(origin:string){
 const published=origin===displayOrigin||origin==='https://example.invalid';
 return (published?origin:displayOrigin)+'/final-vote';
}
