import PDFDocument from 'pdfkit';
import {Buffer} from 'node:buffer';
import {arabicPdfFonts} from './pdf-fonts';
import {statusLabels} from '../admin-dashboard';
import {eventCalendar,eventPrize,journeyStages,riyadhEventDay} from '../hackathon-event';
import type {HackathonReport,ReportChallenge} from './hackathon-report';
import {reportOverview} from './hackathon-report-summary';
import {accessTime,type EmployeePresence} from '../employee-reach';

const C={ink:'#1e302e',teal:'#23484a',green:'#447165',muted:'#526461',quiet:'#65736e',orange:'#9d5226',accent:'#c56b38',line:'#d9e2da',soft:'#edf3ee',warm:'#fcf2e6',paper:'#f6f8f4',light:'#fbfcf9',white:'#ffffff'};
const L=40,R=555.28,W=R-L,B=774;
const features:PDFKit.Mixins.OpenTypeFeatures[]=['kern'];
type S={size:number;bold?:boolean;color?:string};
type Block={lines:string[];s:S;h:number};
type Chapter='overview'|'challenges'|'employees';
const chapters:Record<Chapter,{name:string;index:string}>={overview:{name:'الملخص التنفيذي',index:'01'},challenges:{name:'التحديات والتفاعل',index:'02'},employees:{name:'ملحق الموظفين',index:'03'}};
const body:S={size:10.5,color:C.ink},strong:S={...body,bold:true},small:S={size:9,color:C.muted};
const num=(n:number)=>new Intl.NumberFormat('en-US').format(n);
const clean=(s:string)=>s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/gu,' ').trim();
const ltr=/([A-Za-z\d٠-٩۰-۹]+(?:[ .:/,+_–-][A-Za-z\d٠-٩۰-۹]+)*[%٪]?)/gu;
const runs=(s:string)=>s.split(ltr).filter(Boolean);
const dm=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',timeZone:'UTC'});
function span(start:string,end:string){
 const a=new Date(start+'T12:00:00Z'),b=new Date(end+'T12:00:00Z');
 if(start===end)return dm.format(a);
 return 'من '+(start.slice(0,7)===end.slice(0,7)?String(a.getUTCDate()):dm.format(a))+' إلى '+dm.format(b);
}

export function createHackathonReportPdf(r:HackathonReport):Promise<Blob>{
 return new Promise((resolve,reject)=>{
  const doc=new PDFDocument({size:'A4',autoFirstPage:false,bufferPages:true,font:'',margin:0,compress:true,lang:'ar-SA',
   info:{Title:'تقرير الهاكاثون',Subject:r.title,Author:'الجهة المنظمة',CreationDate:new Date(r.generatedAt)}});
  const fonts=arabicPdfFonts();doc.registerFont('Plex',fonts.regular);doc.registerFont('PlexBold',fonts.bold);
  const parts:Uint8Array<ArrayBuffer>[]=[];
  doc.on('data',(b:Uint8Array)=>parts.push(Uint8Array.from(b)));doc.on('error',reject);
  doc.on('end',()=>resolve(new Blob(parts,{type:'application/pdf'})));
  const o=reportOverview(r),reach=r.reach;
  const date=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Riyadh'}).format(r.generatedAt);
  const clock=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Riyadh'}).format(r.generatedAt);
  const chapterPages:Partial<Record<Chapter,number>>={},onPage:Chapter[]=[];let active:Chapter='overview',y=82;
  function face(s:S){doc.font(s.bold?'PlexBold':'Plex').fontSize(s.size).fillColor(s.color||C.ink)}
  const measure=(s:string)=>runs(s).reduce((sum,t)=>sum+doc.widthOfString(t,{features}),0);
  function line(t:string,edge:number,at:number,s:S=body,align:'right'|'center'|'left'='right'){
   if(!t)return;face(s);const pieces=runs(t),widths=pieces.map(p=>doc.widthOfString(p,{features})),w=widths.reduce((a,b)=>a+b,0);
   let x=align==='center'?edge+w/2:align==='left'?edge+w:edge;
   for(let i=0;i<pieces.length;i++){x-=widths[i];doc.text(pieces[i],x,at,{lineBreak:false,features})}
  }
  function wrap(t:string,width:number,s:S,limit=Infinity){
   face(s);const result:string[]=[],words=clean(t).split(' ');let part='';
   for(const word of words){
    if(!word)continue;const candidate=part?part+' '+word:word;
    if(measure(candidate)<=width){part=candidate;continue}
    if(part){result.push(part);part=''}
    if(measure(word)<=width){part=word;continue}
    for(const ch of word){if(part&&measure(part+ch)>width){result.push(part);part=''}part+=ch}
   }
   if(part)result.push(part);if(result.length<=limit)return result;
   const output=result.slice(0,limit);let tail=output[output.length-1];
   while(tail&&measure(tail+'…')>width){const space=tail.lastIndexOf(' ');tail=space>0?tail.slice(0,space):Array.from(tail).slice(0,-1).join('')}
   output[output.length-1]=tail+'…';return output;
  }
  function block(t:string,w:number,s:S,limit=Infinity,h=s.size*1.55):Block{return {lines:wrap(t,w,s,limit),s,h}}
  function put(b:Block,right:number,at:number){b.lines.forEach((t,i)=>line(t,right,at+i*b.h,b.s));return b.lines.length*b.h}
  function rule(x1:number,at:number,x2:number,color=C.line,weight=.65){doc.moveTo(x1,at).lineTo(x2,at).lineWidth(weight).stroke(color)}
  function box(x:number,at:number,w:number,h:number,fill:string,radius=0){if(radius)doc.roundedRect(x,at,w,h,radius).fill(fill);else doc.rect(x,at,w,h).fill(fill)}
  function pill(t:string,cx:number,at:number,s:S,bg:string,max:number){
   face(s);const w=Math.min(max,measure(t)+15);box(cx-w/2,at,w,18,bg,6);line(t,cx,at+1.6,s,'center');
  }
  function page(ch:Chapter=active){
   active=ch;doc.addPage();onPage.push(ch);
   if(chapterPages[ch]===undefined){chapterPages[ch]=onPage.length;doc.addNamedDestination(ch,'Fit');doc.outline.addItem(chapters[ch].name)}
   line('بذرة',R,18,{size:16,bold:true});
   line('بذرة  /  تقارير الهاكاثون',L,17,{size:10,bold:true,color:C.teal},'left');line(date+'  ·  '+clock+' بتوقيت الرياض',L,35,{size:8.8,color:C.muted},'left');
   rule(L,62,R);box(R-36,61.2,36,1.8,C.accent);y=81;
  }
  function chapterTitle(kicker:string,title:string,sub:string){
   line(kicker,R,y,{size:9.5,bold:true,color:C.orange});y+=20;
   line(title,R,y,{size:25,bold:true,color:C.teal});y+=41;
   y+=put(block(sub,W,{size:10.5,color:C.muted}),R,y)+16;
  }
  function continuation(title:string){
   page();line(chapters[active].index+'  /  '+chapters[active].name,R,y,{size:9.5,color:C.orange,bold:true});y+=22;
   line(title+' · تابع',R,y,{size:17,bold:true,color:C.teal});y+=31;
  }
  function strip(items:{label:string;value:string}[],at:number){
   box(L,at,W,39,C.paper,5);const w=W/items.length;
   items.forEach((q,i)=>{const right=R-i*w;if(i)doc.moveTo(right,at+7).lineTo(right,at+32).lineWidth(.6).stroke(C.line);
    line(q.label,right-9,at+3,{size:8.4,color:C.quiet});line(q.value,right-9,at+16,{size:11,bold:true,color:C.teal})});
  }
  function rowTitle(t:string,at:number){line(t,R,at,{size:16,bold:true,color:C.teal})}
  function cards(){
   const k=[['التحديات المنشورة',num(r.published),'المسودات: '+num(o.draftCount),C.green],['المصوّتون',num(r.voters),'إجمالي الأصوات: '+num(o.voteTotal),C.teal],
    ['الراغبون بالانضمام',num(r.joiners),'إجمالي الرغبات: '+num(o.interestTotal),C.accent],['دخول الموظفين',num(reach.entered)+' من '+num(reach.total),'أكّدوا بياناتهم: '+num(reach.confirmed),C.green]];
   const gap=8,w=(W-gap*3)/4;
   k.forEach(([label,value,foot,accent],i)=>{const right=R-i*(w+gap),left=right-w;
    box(left,270,w,80,C.paper,6);box(right-31,270,22,2,accent);
    line(label,right-9,278,{size:10.2,bold:true,color:C.ink});
    const fs=value.length>10?17:value.length>5?20:24;line(value,right-9,293,{size:fs,bold:true,color:C.teal});
    line(foot,right-9,330,{size:8.8,color:C.muted});
   });
  }
  function chart(){
   const rightW=247,split=R-rightW-13,lRight=split-16,lWidth=lRight-L;
   line('انتشار التفاعل',R,370,{size:15,bold:true,color:C.teal});line('قراءة المؤشرات',lRight,370,{size:15,bold:true,color:C.teal});
   doc.moveTo(split,374).lineTo(split,474).lineWidth(.7).stroke(C.line);
   if(r.published){[['تحديات حصلت على أصوات',o.voted,C.teal],['تحديات لها رغبات انضمام',o.withInterest,C.accent]].forEach((row,i)=>{
    const [label,val,tone]=row as [string,number,string],at=403+i*39;
    line(label,R,at,{size:9.7,color:C.ink});line(num(val)+' من '+num(r.published),R-rightW,at,{size:9.5,bold:true,color:C.teal},'left');
    box(R-rightW,at+18,rightW,4,C.soft,2);if(val)box(R-rightW*val/r.published,at+18,rightW*val/r.published,4,tone,Math.min(2,rightW*val/r.published/2));
   })}else put(block('لا تُحسب نسبة انتشار التفاعل قبل نشر أول تحدٍّ.',rightW,body),R,404);
   put(block(o.reading,lWidth,{size:10.2,color:C.ink},5,15.6),lRight,401);
  }
  function highlights(){
   const fromVotes=!o.approved&&o.picks.length>0;
   const items=o.picks.length?o.picks.slice(0,2):o.approved?[]:o.published.slice(0,2);
   rowTitle(o.approved?'من القائمة المعتمدة للورشة':fromVotes?'التحديات المتقدمة في التصويت':'من التحديات المنشورة',493);
   const hint=o.approved?'حسب القائمة المثبّتة عند الاعتماد.':fromVotes?'ترتيب مبدئي؛ وعند التعادل يتقدّم التحدّي الأسبق نشرًا.':'يبدأ ترتيب الأولويات مع أول صوت.';
   line(hint,R,519,small);
   if(!items.length){box(L,546,W,53,C.light,5);line(o.approved?'لا توجد بنود محفوظة في القائمة المعتمدة.':'لا توجد تحديات منشورة وقت التصدير.',R-12,560,body);return}
   items.forEach((a,i)=>{const at=541+i*37;rule(L,at,R);doc.circle(R-10,at+18,8.5).fill(C.soft);
    line(num(i+1),R-10,at+10,{size:9,bold:true,color:C.teal},'center');
    const title=block(a.title,W-123,{size:10.5,bold:true,color:C.ink},2,13);put(title,R-25,at+(37-title.lines.length*13)/2-1);
    line((o.approved?'عند الاعتماد: ':'الأصوات: ')+num(a.votes),L+5,at+10,{size:9,color:C.muted},'left');
   });
  }
  function calendar(){
   const top=640;rule(L,top-9,R);rowTitle('رحلة الهاكاثون',top);
   const cal=eventCalendar(riyadhEventDay(new Date(r.generatedAt))),labels=['طرح التحديات','التصويت والفرز','ابتكار الحلول وبناؤها','عرض الحلول وتقييمها'];
   const w=W/4,mid=(i:number)=>R-(i+.5)*w;
   rule(mid(3),top+49,mid(0),C.line,1.6);
   journeyStages.forEach((s,i)=>{const x=mid(i),now=cal.stages[i]==='current';
    if(now)doc.circle(x,top+49,8).fill(C.warm);doc.circle(x,top+49,now?5.3:3.5).fill(now?C.accent:cal.stages[i]==='done'?C.green:'#9aaba0');
    line(labels[i],x,top+61,{size:9.8,bold:true,color:C.teal},'center');
    line(span(s.start,s.end),x,top+78,{size:8.7,color:C.muted},'center');
   });
  }
  function overview(){
   page('overview');
   line('01   /   الملخص التنفيذي',R,80,{size:10,bold:true,color:C.orange});
   line('تقرير الهاكاثون',R,97,{size:32,bold:true,color:C.teal});
   put(block(r.title,333,{size:13,bold:true,color:C.ink},2,17),R,146);
   line('هاكاثون الابتكار',L+158,110,{size:15,bold:true});
   line('من التحديات التي طرحها الموظفون إلى أولويات الورشة وتكوين فرقها.',R,184,{size:10.5,color:C.muted});
   strip([{label:'حالة الترشيح',value:o.state},{label:o.approved?'التحديات المعتمدة للورشة':'عدد التحديات المستهدف للورشة',value:num(o.approved?r.workshop.selection.length:r.workshop.target)},{label:'إجمالي الجوائز المعلنة',value:num(eventPrize)+' ريال'}],207);
   cards();line('كل شخص يُحسب مرة واحدة في مؤشّر التصويت أو الرغبة، ولو اختار عدة تحديات منشورة.',R,353,{size:8.4,color:C.muted});chart();highlights();calendar();
  }
  function headerRow(cols:{name:string;w:number;center?:boolean}[]){
   box(L,y,W,26,C.teal,4);let rx=R;for(const c of cols){line(c.name,c.center?rx-c.w/2:rx-7,y+4,{size:9.1,bold:true,color:C.white},c.center?'center':'right');rx-=c.w}y+=26;
  }
  function themes(){
   if(!o.themes.length)return;
   const text=o.themes.slice(0,4).map(([name,n])=>name+': '+num(n)).join('   ·   ')+(o.themes.length>4?'   ·   مجالات أخرى: '+num(o.themes.length-4):'');
   const b=block(text,W-24,{size:10,color:C.teal});box(L,y,W,29+b.lines.length*b.h,C.soft,5);
   line('مجالات التحديات المنشورة',R-12,y+3,{size:9,bold:true,color:C.green});put(b,R-12,y+18);y+=40+b.lines.length*b.h;
  }
  function snapshot(){
   if(!o.approved)return;
   const cols=[{name:'الترتيب',w:49,center:true},{name:'التحدي المعتمد',w:367.28},{name:'الأصوات عند الاعتماد',w:99,center:true}];
   line('القائمة المعتمدة للورشة',R,y,{size:15,bold:true,color:C.teal});y+=28;headerRow(cols);
   if(!r.workshop.selection.length){line('لا توجد بنود محفوظة في القائمة.',R-8,y+5,small);y+=30}
   r.workshop.selection.forEach((item,i)=>{const b=block(item.title,cols[1].w-18,strong),height=Math.max(28,b.lines.length*b.h+9);
    if(y+height>B){continuation('القائمة المعتمدة للورشة');headerRow(cols)}
    if(i%2)box(L,y,W,height,C.light);line(num(item.rank),R-cols[0].w/2,y+5,strong,'center');put(b,R-cols[0].w-8,y+4);
    line(num(item.votes),L+cols[2].w/2,y+5,strong,'center');y+=height;rule(L,y,R);
   });y+=18;
  }
  function records(){
   page('challenges');chapterTitle('02   /   التحديات والتفاعل','سجل التحديات','يبيّن السجل ما يواجهه أصحاب التحديات، وعدد مَن صوّت لكل تحدٍّ ومَن يرغب في العمل على حلّه.');
   themes();snapshot();
   const cols=[{name:'التحدي وما يصفه صاحبه',w:238.28},{name:'صاحب التحدي',w:95},{name:'الحالة',w:70,center:true},{name:'الأصوات',w:52,center:true},{name:'الراغبون',w:60,center:true}];
   const desc=(t:string)=>{y+=put(block(t,W,small),R,y)+6};
   function plan(c:ReportChallenge){
    const room=cols[0].w-19,title=block(c.title,room,{size:11,bold:true,color:C.ink}),meta=block([c.domain,c.scope].filter(Boolean).join(' · '),room,{size:8.6,color:C.orange},2,12);
    const excerpt=block(c.issue,room,{size:9.2,color:C.muted},2,13),owner=block(c.author,cols[1].w-12,body);
    const blocks=[title,meta,excerpt].filter(b=>b.lines.length),textHeight=blocks.reduce((h,b)=>h+b.lines.length*b.h,0)+Math.max(0,blocks.length-1)*2;
    return {c,blocks,owner,h:Math.max(37,textHeight+14,owner.lines.length*owner.h+14)};
   }
   const items=[...o.published,...o.unpublished].map(plan);
   const intro='المنشور أولًا بحسب الأصوات، ثم البطاقات غير المنشورة. لا تدخل أمثلة الاستلهام في السجل.';
   const introBlock=block(intro,W,small);
   if(y+introBlock.lines.length*introBlock.h+6+26+(items[0]?.h??38)>B)continuation('سجل التحديات');
   desc(intro);headerRow(cols);
   if(!items.length){box(L,y,W,38,C.light);line('لا توجد بطاقات تحدٍّ وقت إصدار التقرير.',R-10,y+8,body);return}
   function row({c,blocks,owner,h}:ReturnType<typeof plan>,i:number){
    if(y+h>B){continuation('سجل التحديات');headerRow(cols)}
    if(i%2===1)box(L,y,W,h,C.light);
    let ty=y+5;for(const b of blocks)ty+=put(b,R-8,ty)+2;put(owner,R-cols[0].w-6,y+5);
    const st=c.status==='published';pill(statusLabels[c.status]||'غير محددة',R-cols[0].w-cols[1].w-cols[2].w/2,y+7,{size:8.8,bold:true,color:st?C.green:C.orange},st?C.soft:C.warm,cols[2].w-5);
    line(num(c.votes),L+cols[4].w+cols[3].w/2,y+7,strong,'center');line(num(c.interests),L+cols[4].w/2,y+7,body,'center');y+=h;rule(L,y,R);
   }
   items.forEach(row);
  }
  function directory(){
   page('employees');chapterTitle('03   /   ملحق المتابعة الإدارية','دخول موظفي المؤسسة','الأسماء من دليل الموظفين. يثبت الدخول بالتحقق الناجح أو بفتح المنصة بجلسة محفوظة، ولا يكفي إنشاء حساب أو تأكيد الاسم.');
   const pct=reach.total?new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(100*reach.entered/reach.total)+'%':'—';
   strip([{label:'دخلوا من دليل الموظفين',value:num(reach.entered)+' من '+num(reach.total)},{label:'نسبة الدخول',value:pct},{label:'أكّدوا بياناتهم من الدليل',value:num(reach.confirmed)}],y);y+=55;
   const entered=reach.rows.filter(p=>p.status==='entered'),waiting=reach.rows.filter(p=>p.status==='waiting'),uncertain=reach.rows.filter(p=>p.status==='unknown');
   const gap=14,cw=(W-gap)/2;
   function list(title:string,people:EmployeePresence[],bg:string,ink:string,empty:string,mode:'yes'|'no'|'unknown'|'outside'){
    const info=mode==='yes'||mode==='outside'?'وقت آخر دخول بتوقيت الرياض متى كان محفوظًا.':mode==='unknown'?'لا تكفي البيانات لإثبات الدخول أو مطابقة الجوال.':null;
    const plan=(p:EmployeePresence)=>{const name=block(p.name,cw-13,{size:10.1,bold:true,color:C.ink});const t=mode==='unknown'?p.note:(mode==='yes'||mode==='outside')&&p.lastAccessAt!==null?accessTime(p):'';
     const detail=block(t,cw-13,{size:8.2,color:C.muted},3,11);return {name,detail,h:Math.max(23,7+name.lines.length*name.h+detail.lines.length*detail.h)}};
    const first=people.slice(0,2).map(plan);const headerH=info?42:27;
    function head(cont=false){box(L,y,W,24,bg,4);line(title+(cont?' · تابع':''),R-8,y+3,{size:10.5,bold:true,color:ink});line(num(people.length),L+9,y+3,{size:10.5,bold:true,color:ink},'left');y+=27;
     if(info){line(info,R-6,y,small);y+=15}}
    if(y+headerH+Math.max(23,...first.map(e=>e.h))>B){continuation('دخول موظفي المؤسسة')}head();
    if(!people.length){line(empty,R-7,y+1,small);y+=28;return}
    for(let i=0;i<people.length;i+=2){
     const cells=people.slice(i,i+2).map(plan),h=Math.max(...cells.map(c=>c.h));
     if(y+h>B){continuation('دخول موظفي المؤسسة');head(true)}
     cells.forEach((cell,j)=>{const rt=R-j*(cw+gap);if((i/2)%2)box(rt-cw,y,cw,h,C.light);
      const n=put(cell.name,rt-5,y+2);put(cell.detail,rt-5,y+2+n);rule(rt-cw,y+h,rt)});
     y+=h;
    }y+=12;
   }
   if(!reach.total){line('لا توجد أسماء في دليل المؤسسة وقت إصدار التقرير.',R,y,body);y+=31}
   else{list('دخلوا المنصة',entered,C.soft,C.teal,'لم يُرصد دخول أي موظف حتى وقت الإصدار.','yes');
    list('لم يدخلوا المنصة بعد',waiting,C.paper,C.ink,'لا يوجد موظفون في هذه القائمة.','no');
    if(uncertain.length)list('سجلات بحاجة إلى تحقق',uncertain,C.warm,C.orange,'','unknown');}
   if(reach.outside.length)list('حسابات دخلت ولم تُطابَق مع الدليل · خارج الإجمالي',reach.outside,C.paper,C.muted,'','outside');
  }
  overview();records();directory();
  const range=doc.bufferedPageRange();
  for(let i=0;i<range.count;i++){doc.switchToPage(i);
   rule(L,791,R);line('للاستخدام الإداري   /   '+chapters[onPage[i]].name,R,801,small);
   line('صفحة '+num(i+1)+' من '+num(range.count),L,801,{size:9,bold:true,color:C.teal},'left');
  }
  // The contents line includes actual page numbers after pagination and works as two internal links.
  doc.switchToPage(0);rule(L,747,R);
  const nav=(key:'challenges'|'employees',right:number)=>{line(chapters[key].name+'   ·   ص '+num(chapterPages[key]!),right,755,{size:9.4,bold:true,color:C.teal});doc.goTo(right-154,751,154,23,key)};
  nav('challenges',R);nav('employees',R-178);doc.end();
 });
}
