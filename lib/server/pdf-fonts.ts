import embedded from './data/dossier-fonts.json';
let fonts:{regular:ArrayBuffer;bold:ArrayBuffer}|undefined;
const bytes=(s:string)=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0)).buffer;
export function arabicPdfFonts(){return fonts??={regular:bytes(embedded.regular),bold:bytes(embedded.bold)}}
