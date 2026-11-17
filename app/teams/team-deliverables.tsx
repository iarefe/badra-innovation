'use client';

import {useRef,useState,type FormEvent,type ReactNode} from 'react';
import {Eye} from 'lucide-react';
import {PanelsTopLeft} from 'lucide-react';

export type DeliveryData={id:string;mine:number;solution:string;instructions:string;slides_url:string;files:{kind:string;name:string}[]};
type Act=(data:Record<string,unknown>)=>Promise<boolean>;
type Props={team:DeliveryData;act:Act;upload:(file:File)=>Promise<boolean>};

const inputURL={type:'url',dir:'ltr',inputMode:'url' as const,autoCapitalize:'none',spellCheck:false,maxLength:2000,placeholder:'https://',pattern:'[hH][tT][tT][pP][sS]://.+',title:'أدخل رابطًا يبدأ بـ https://'};
const downloadURL=(id:string,kind:string)=>'/api/teams/file?team='+encodeURIComponent(id)+'&kind='+kind;

function Item({number,title,children,action}:{number:string;title:string;children:ReactNode;action?:ReactNode}){
 return <section className="td-delivery-item"><header><span className="td-delivery-no" aria-hidden="true">{number}</span><h4>{title}</h4>{action}</header>{children}</section>;
}
function focusField(id:string){requestAnimationFrame(()=>document.getElementById(id)?.focus({preventScroll:true}))}
function Toggle({expanded,id,onClick,children}:{expanded:boolean;id:string;onClick:()=>void;children:ReactNode}){
 return <button className="td-delivery-edit" type="button" id={id+'-edit'} aria-controls={id} aria-expanded={expanded} onClick={onClick}>{expanded?'إلغاء':children}</button>;
}
function External({url,children}:{url:string;children:ReactNode}){
 return <a className="td-delivery-link" href={url} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span></a>;
}
type SavedDelivery=Pick<DeliveryData,'id'|'solution'|'instructions'|'slides_url'|'files'>;
function SavedField({t,kind}:{t:SavedDelivery;kind:'solution'|'instructions'}){
 const saved=t[kind],isURL=kind==='solution';
 return saved?(isURL?<External url={saved}>فتح الحل</External>:<p className="td-delivery-instructions" dir="auto">{saved}</p>):<small>{isURL?'لم يُضف رابط الحل بعد.':'لم تُضف إرشادات لتشغيل الحل بعد.'}</small>;
}
function Legacy({t}:{t:SavedDelivery}){const f=t.files.find(f=>f.kind==='solution');return f?<a className="td-delivery-legacy" href={downloadURL(t.id,'solution')}>مرفق الحل السابق: <bdi>{f.name}</bdi> ↓</a>:null;}
function SavedSlides({t}:{t:SavedDelivery}){
 const f=t.files.find(f=>f.kind==='slides');
 return t.slides_url?<External url={t.slides_url}>فتح العرض التقديمي</External>:f?<a className="td-delivery-link" href={downloadURL(t.id,'slides')}>تنزيل العرض: <bdi>{f.name}</bdi> ↓</a>:<small>لم يُسلَّم عرض تقديمي بعد.</small>;
}
export function DeliverySummary({team}:{team:SavedDelivery}){return <div className="td-delivery-list">
 <Item number="01" title="رابط الحل"><SavedField t={team} kind="solution"/><Legacy t={team}/></Item>
 <Item number="02" title="إرشادات وبيان الحل"><SavedField t={team} kind="instructions"/></Item>
 <Item number="03" title="العرض التقديمي"><SavedSlides t={team}/></Item>
 </div>;}
function PreviewLaunch({team,title}:{team:DeliveryData;title:string}){
 const modal=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLAnchorElement>(null);
 const [show,render]=useState(false);
 return <><a className="td-preview-button" ref={trigger} aria-haspopup="dialog" href={'/teams?team='+encodeURIComponent(team.id)+'&view=preview'} onClick={e=>{
  if(e.button!==0||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!modal.current?.showModal)return;
  e.preventDefault();render(true);modal.current.showModal();
 }}><Eye size={16} aria-hidden="true"/>{team.mine?'عاين تسليمك كما يراه المقيّم':'معاينة تسليم الفريق'}</a>
 <dialog ref={modal} className="td-preview-dialog" aria-labelledby={'preview-title-'+team.id} onClose={()=>{render(false);trigger.current?.focus({preventScroll:true})}}>
  <div className="td-preview-head"><div><span className="td-eyebrow">معاينة تسليم الفريق · للقراءة فقط</span><h2 id={'preview-title-'+team.id}>{title}</h2></div><button type="button" className="plain" onClick={()=>modal.current?.close()}>إغلاق المعاينة</button></div>
  <p className="td-preview-note">هذه هي النسخة المحفوظة التي يراها المقيّم.</p>{show&&<DeliverySummary team={team}/>}
 </dialog></>;
}
function Fields({t,act,kind}:{t:DeliveryData;act:Act;kind:'solution'|'instructions'}){
 const isURL=kind==='solution',saved=t[kind]||'',legacy=isURL?t.files.find(f=>f.kind==='solution'):undefined;
 const [editing,edit]=useState(!saved&&!legacy),[value,write]=useState(saved),[problem,warn]=useState('');
 const id='delivery-'+kind+'-'+t.id,help=id+'-help';
 function toggle(){write(saved);warn('');edit(!editing);if(!editing)focusField(id+'-input')}
 async function save(e:FormEvent){e.preventDefault();const v=value.trim();warn('');const ok=await act(isURL?{action:'solution',team:t.id,url:v}:{action:'instructions',team:t.id,text:v});if(ok){edit(false);focusField(id+'-edit')}else warn('تعذّر حفظ هذا الحقل. بقي النص كما كتبته؛ حاول مجددًا.')}
 return <Item number={isURL?'01':'02'} title={isURL?'رابط الحل':'إرشادات وبيان الحل'} action={!!t.mine&&<Toggle id={id} expanded={editing} onClick={toggle}>{saved?'تعديل':isURL?'إضافة رابط':'كتابة الإرشادات'}</Toggle>}>
  {!(editing&&t.mine)&&<SavedField t={t} kind={kind}/>}
  {!!t.mine&&<div id={id} hidden={!editing}><form className="td-delivery-form" onSubmit={save}>
   <label htmlFor={id+'-input'}>{isURL?'أدخل رابط الحل':'إرشادات تشغيل الحل'}</label>
   {isURL?<input {...inputURL} id={id+'-input'} aria-describedby={problem?id+'-error':undefined} onInvalid={()=>warn('أدخل رابطًا كاملًا يبدأ بـ https://.')} value={value} onChange={e=>{warn('');write(e.target.value)}}/>:<>
    <small id={help}>اكتب بيانات الدخول أو أي احتياجات لازمة لتشغيل الحل.</small>
    <textarea id={id+'-input'} aria-describedby={help} rows={4} maxLength={6000} value={value} onChange={e=>write(e.target.value)}/>
   </>}
   {problem&&<p id={id+'-error'} role="alert" className="td-delivery-error">{problem}</p>}
   <button type="submit" disabled={!saved&&!value.trim()}>{isURL?'حفظ رابط الحل':'حفظ الإرشادات'}</button>
  </form></div>}
  {isURL&&<Legacy t={t}/>}
 </Item>;
}

function Slides({team:t,act,upload}:Props){
 const attached=t.files.find(f=>f.kind==='slides'),url=t.slides_url||'',id='delivery-slides-'+t.id;
 const current=url?'link':attached?'file':'link';
 const [editing,edit]=useState(!url&&!attached),[mode,choose]=useState<'link'|'file'>(current),[link,setLink]=useState(url),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[problem,warn]=useState('');
 const input=useRef<HTMLInputElement>(null);
 function toggle(){warn('');setLink(url);choose(current);setFile(null);setError('');if(input.current)input.current.value='';edit(!editing);if(!editing)focusField(id+(current==='file'?'-file':'-url'))}
 function chooseFile(f:File|null){warn('');setFile(f);setError(!f?'':f.size>10*1024*1024?'الملف يتجاوز 10 ميغابايت.':!(/\.(pdf|pptx)$/i).test(f.name)?'اختر عرضًا بصيغة PPTX أو PDF.':'')}
 async function save(e:FormEvent){e.preventDefault();if(error&&mode==='file')return;warn('');
  const ok=mode==='link'?await act({action:'slidesLink',team:t.id,url:link.trim()}):file?await upload(file):attached&&url?await act({action:'slidesLink',team:t.id,url:''}):false;
  if(ok){edit(false);setFile(null);setError('');if(input.current)input.current.value='';focusField(id+'-edit')}else warn('لم يتغيّر العرض المحفوظ. حاول حفظ العرض مجددًا.')
 }
 return <Item number="03" title="العرض التقديمي" action={!!t.mine&&<Toggle id={id} expanded={editing} onClick={toggle}>{attached||url?'تعديل':'إضافة العرض'}</Toggle>}>
  {!(editing&&t.mine)&&<SavedSlides t={t}/>}
  {!!t.mine&&<div id={id} hidden={!editing}><form className="td-delivery-form" onSubmit={save}>
   <fieldset className="td-delivery-mode"><legend>طريقة تسليم العرض</legend>{(['link','file'] as const).map(m=><label key={m}><input type="radio" name={id+'-mode'} checked={mode===m} onChange={()=>{choose(m);warn('')}}/><span>{m==='link'?'رابط':'ملف مرفق'}</span></label>)}</fieldset>
   {mode==='link'?<><label htmlFor={id+'-url'}>رابط العرض التقديمي</label><input {...inputURL} id={id+'-url'} required aria-describedby={problem?id+'-problem':undefined} onInvalid={()=>warn('أدخل رابطًا كاملًا يبدأ بـ https://.')} value={link} onChange={e=>{warn('');setLink(e.target.value)}}/></>:<>
    {attached&&<a className="td-delivery-existing" href={downloadURL(t.id,'slides')}>الملف المحفوظ: <bdi>{attached.name}</bdi> ↓</a>}
    <label htmlFor={id+'-file'}>{attached?'اختر ملفًا بديلًا':'اختر ملف العرض'}</label><small id={id+'-hint'}>PPTX أو PDF · حتى 10 ميغابايت</small>
    <input id={id+'-file'} ref={input} type="file" aria-invalid={!!error||undefined} aria-describedby={id+'-hint'+(error?' '+id+'-error':'')} accept=".pptx,.pdf" onChange={e=>chooseFile(e.target.files?.[0]||null)}/>
    {file&&!error&&<small>الملف المحدد: <bdi>{file.name}</bdi></small>}{error&&<small id={id+'-error'} className="td-delivery-error" role="alert">{error}</small>}
   </>}
   {problem&&<p id={id+'-problem'} role="alert" className="td-delivery-error">{problem}</p>}
   <button type="submit" disabled={mode==='link'?!link.trim():!!error||(!file&&!(url&&attached))}>{mode==='file'&&!file&&attached&&url?'اعتماد الملف المحفوظ':'حفظ العرض التقديمي'}</button>
  </form></div>}
 </Item>;
}
export default function TeamDeliverables(props:Props&{title:string;manager:boolean}){
 const {team,act}=props;
 return <section className="td-deliverables" aria-labelledby={'td-deliveries-'+team.id}><div className="td-section-title td-delivery-heading"><PanelsTopLeft size={18} aria-hidden="true"/><h3 id={'td-deliveries-'+team.id} tabIndex={-1}>تسليمات الفريق</h3>{(!!team.mine||props.manager)&&<PreviewLaunch team={team} title={props.title}/>}</div>
  {team.mine?<div className="td-delivery-list"><Fields t={team} act={act} kind="solution"/><Fields t={team} act={act} kind="instructions"/><Slides {...props}/></div>:<DeliverySummary team={team}/>}
 </section>;
}
