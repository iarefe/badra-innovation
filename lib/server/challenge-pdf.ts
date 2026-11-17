// Called only by the download endpoint, after checking access to this entry.
import PDFDocument from 'pdfkit';
import {challengeImpactFacts,explorationQuestions,howMightWe,workshopOutputs,type Challenge} from '../challenges';
type Face='Plex'|'PlexBold';
type Fonts={regular:ArrayBuffer;bold:ArrayBuffer};
export function createChallengePdf(c:Challenge,example:boolean,fonts:Fonts,authorDepartment=''):Promise<Blob>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',font:'',margin:0,autoFirstPage:false,compress:true,lang:'ar-SA',info:{Title:c.title,Subject:'بطاقة التحدي',Author:'هاكاثون الابتكار الرقمي – الجهة المنظمة'}});
  doc.registerFont('Plex',fonts.regular);doc.registerFont('PlexBold',fonts.bold);
  const parts:Uint8Array<ArrayBuffer>[]=[];doc.on('data',(buf:Uint8Array)=>parts.push(Uint8Array.from(buf)));doc.on('error',reject);doc.on('end',()=>resolve(new Blob(parts,{type:'application/pdf'})));
  const width=499,margin=48,features:PDFKit.Mixins.OpenTypeFeatures[]=['kern'];
  let y=76,page=0;
  const measure=(s:string)=>doc.widthOfString(s,{features});
  function line(s:string,at:number){
   // Supplying OpenType features shapes the entire line, not each word separately.
   doc.text(s,margin+width-measure(s),at,{lineBreak:false,features});
  }
  function newPage(){doc.addPage();page++;doc.rect(0,0,595.28,5).fill('#23484a');
   doc.font('PlexBold').fontSize(11).fillColor('#23484a');line('هاكاثون الابتكار الرقمي  ·  الجهة المنظمة',28);
   doc.moveTo(margin,56).lineTo(margin+width,56).lineWidth(.6).stroke('#dce3dd');
   doc.font('Plex').fontSize(9).fillColor('#5f6b68');line('بذرة  ·  بطاقة التحدي',802);doc.text(page.toLocaleString('ar-SA'),margin,802,{lineBreak:false,features});y=76;
  }
  function paragraph(value:string,{size=12,face='Plex',color='#1d2b2a',gap=5,keep=0}:{size?:number;face?:Face;color?:string;gap?:number;keep?:number}={}){
   if(!value.trim())return;
   const lh=size*1.8,style=()=>doc.font(face).fontSize(size).fillColor(color);
   const room=(more:number)=>{if(y+more>780){newPage();style()}};
   style();room(lh+keep);
   const flush=(s:string)=>{if(!s)return;room(lh);line(s,y);y+=lh};
   for(const para of value.trim().split(/\r?\n/)){let current='';
    for(const word of para.trim().split(/\s+/)){if(!word)continue;
     if(measure(word)>width){if(current){flush(current);current=''}for(const ch of word){if(current&&measure(current+ch)>width){flush(current);current=''}current+=ch}continue}
     const next=current?current+' '+word:word;if(current&&measure(next)>width){flush(current);current=word}else current=next;
    }flush(current);
   }y+=gap;
  }
  function chapter(title:string){y+=6;paragraph(title,{size:17,face:'PlexBold',color:'#23484a',keep:54,gap:6})}
  function field(title:string,value:string){paragraph(title,{size:11,face:'PlexBold',color:'#975026',keep:23,gap:1});paragraph(value||'لم تُضف تفاصيل بعد.') }
  newPage();paragraph(example?'مثال للاستلهام':'بطاقة التحدي',{size:11,color:'#975026',face:'PlexBold',keep:36});paragraph(c.title,{size:22,face:'PlexBold',keep:23});
  paragraph(c.domain,{color:'#5f6b68'});field('صاحب التحدي',c.author);if(!example&&authorDepartment)paragraph(authorDepartment,{color:'#5f6b68'});
  if(c.ownership==='shared'&&c.coOwners)field('الشركاء في التحدي',c.coOwners);
  field('السؤال الذي تنطلق منه',howMightWe(c));paragraph('صياغة أولية تُراجع مع المتأثرين في الهاكاثون.',{size:10,color:'#5f6b68'});
  chapter('المشهد الحالي');field('ماذا يحدث في الواقع؟',c.situation);field('من يعيش التحدي؟',c.stakeholders);field('ما الذي يحاول إنجازه؟',c.need);field('كيف يجري التعامل معه الآن؟',c.workaround);
  if(c.initialSolutionStatus==='implemented'){field('ما الذي جُرّب؟',c.initialSolution);field('ماذا تحقق؟',c.initialSolutionOutcome||'لم تُوثّق نتائج التجربة بعد.')}else if(c.initialSolutionStatus==='none')paragraph('لم يُنفّذ حل أولي بعد.');
  chapter('الأثر والشواهد');for(const [label,value] of challengeImpactFacts(c))field(label,value);field('لماذا يستحق المعالجة؟',c.impact);field('ما الذي نعرفه؟',c.evidence);field('ما الذي يحتاج تحققًا؟',c.assumptions||'تُراجع الأسباب قبل اختيار الحل.');
  chapter('النتيجة المطلوبة');paragraph(c.success);field('يشمل',c.inScope);field('لا يشمل',c.outOfScope);field('معايير قبول الحلول المقترحة',c.criteria);
  chapter('في الهاكاثون');for(const [i,q] of explorationQuestions(c).entries())paragraph((i+1).toLocaleString('ar-SA')+' ـ '+q);
  for(const x of workshopOutputs)field(x.title,x.description);
  doc.end();
 });
}
