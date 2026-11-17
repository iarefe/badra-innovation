'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Check,LoaderCircle,Trash2,Upload,X} from 'lucide-react';
import type {Entry} from '@/lib/challenges';

export function ProfileAvatar({name,url,size='normal',singleInitial=false}:{name:string;url?:string|null;size?:'small'|'normal'|'large';singleInitial?:boolean}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);
 const parts=name.trim().split(/\s+/).filter(Boolean),initials=!singleInitial&&parts.length>1?parts[0][0]+parts.at(-1)![0]:parts[0]?.[0]||'؟';
 return <span className={'profile-avatar '+size}>{url&&!failed?<img src={url} alt={'الصورة الشخصية لـ '+name} width={96} height={96} decoding="async" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{initials}</span>}</span>;
}
export function ChallengeAuthor({entry,label=false}:{entry:Entry;label?:boolean}){
 return <div className={'challenge-author'+(label?' labeled':'')}><ProfileAvatar name={entry.challenge.author} url={entry.authorAvatar} size={label?'normal':'small'}/><div>{label&&<small>{entry.challenge.ownership==='shared'?'صاحب التحدي وفريقه':'صاحب التحدي'}</small>}<b>{entry.challenge.author}{!label&&entry.challenge.ownership==='shared'?' وفريقه':''}</b>{label&&entry.authorDepartment&&<span className="cd-author-department" aria-label={'إدارة صاحب التحدي: '+entry.authorDepartment}>{entry.authorDepartment}</span>}{label&&entry.challenge.ownership==='shared'&&entry.challenge.coOwners&&<p>{entry.challenge.coOwners}</p>}</div></div>;
}

export default function AvatarEditor({name,url,onSaved}:{name:string;url?:string|null;onSaved:(url:string|null)=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [source,setSource]=useState<HTMLImageElement|null>(null),[sourceUrl,setSourceUrl]=useState(''),[zoom,setZoom]=useState(1),[x,setX]=useState(50),[y,setY]=useState(50);
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),canvas=useRef<HTMLCanvasElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
 useEffect(()=>()=>{if(sourceUrl)URL.revokeObjectURL(sourceUrl)},[sourceUrl]);
 useEffect(()=>{
  if(!source||!canvas.current)return;const ctx=canvas.current.getContext('2d');if(!ctx)return;
  const side=Math.min(source.naturalWidth,source.naturalHeight)/zoom;
  ctx.clearRect(0,0,384,384);ctx.drawImage(source,(source.naturalWidth-side)*x/100,(source.naturalHeight-side)*y/100,side,side,0,0,384,384);
 },[source,zoom,x,y,open]);
 function close(){if(busy)return;setOpen(false);setSource(null);setSourceUrl('');setError('');trigger.current?.focus()}
 async function choose(file?:File){
  if(!file)return;setError('');setBusy(true);let objectUrl='';
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('اختر صورة JPEG أو PNG أو WebP لا تتجاوز ١٠ ميجابايت.');
   objectUrl=URL.createObjectURL(file);const image=new Image();image.src=objectUrl;await image.decode();
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('اختر صورة أصغر لتجهيزها بسهولة.');
   setSourceUrl(objectUrl);setSource(image);objectUrl='';setZoom(1);setX(50);setY(50);
  }catch(e){if(objectUrl)URL.revokeObjectURL(objectUrl);setError(e instanceof Error?e.message:'تعذّر فتح الصورة. جرّب صورة أخرى.');}finally{setBusy(false);if(input.current)input.current.value=''}
 }
 async function save(remove=false){
  if(busy||(!remove&&!source))return;setBusy(true);setError('');
  try{
   const blob=remove?null:await new Promise<Blob>((resolve,reject)=>{if(!canvas.current){reject(Error('تعذّر تجهيز الصورة. اخترها مجددًا.'));return}canvas.current.toBlob(value=>value?resolve(value):reject(Error('تعذّر تجهيز الصورة.')),'image/webp',.88)});
   if(blob&&blob.size>512*1024)throw Error('الصورة كبيرة بعد تجهيزها. اختر صورة أصغر.');
   const response=await fetch('/api/avatar',{method:remove?'DELETE':'POST',...(blob?{headers:{'Content-Type':blob.type},body:blob}:{})});
   const data:any=await response.json();if(!response.ok)throw Error(data.error||'تعذّر حفظ الصورة.');
   onSaved(data.avatarUrl||null);setSource(null);setSourceUrl('');setOpen(false);setMessage(remove?'أُزيلت صورتك الشخصية.':'حُفظت صورتك وظهرت مع تحدياتك.');trigger.current?.focus();
  }catch(e){setError(e instanceof Error?e.message:'تعذّر الاتصال. حاول مجددًا.');}finally{setBusy(false)}
 }
 return <div className="avatar-editor" id="profile-photo"><button ref={trigger} type="button" className="avatar-trigger" onClick={()=>{setMessage('');setError('');setOpen(true)}} aria-label={url?'تعديل صورتك الشخصية':'إضافة صورة شخصية'}><ProfileAvatar name={name} url={url} size="large"/><span className="avatar-camera"><Camera size={15}/></span></button><span className="avatar-trigger-label">{url?'تعديل الصورة':'أضف صورتك'}</span>{message&&<span className="avatar-feedback" role="status">{message}</span>}
 <dialog className="avatar-dialog" ref={dialog} aria-labelledby="avatar-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else close()}} onClose={()=>setOpen(false)}><div className="avatar-dialog-heading"><div><span className="eyebrow">صورتك مع تحدياتك</span><h2 id="avatar-dialog-title">صورتك الشخصية</h2></div><button type="button" className="icon-button" disabled={busy} onClick={close} aria-label="إغلاق تعديل الصورة"><X size={19}/></button></div>
  <p className="avatar-dialog-intro">اختر صورة تعبّر عنك. تظهر بجانب اسمك في بطاقات تحدياتك وصفحاتها.</p>
  <div className="avatar-crop-preview">{source?<canvas ref={canvas} width={384} height={384} aria-label="معاينة قصّ الصورة الشخصية"/>:<ProfileAvatar name={name} url={url} size="large"/>}</div>
  <button type="button" className="button ghost avatar-choose" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{source?'اختر صورة أخرى':'اختر صورة من جهازك'}</button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void choose(e.target.files?.[0])}/>
  {source&&<details className="avatar-crop-controls"><summary>ضبط قصّ الصورة</summary><label>التكبير<input type="range" min={1} max={3} step={.05} value={zoom} disabled={busy} onChange={e=>setZoom(Number(e.target.value))}/></label><label>الموضع الأفقي<input type="range" min={0} max={100} value={x} disabled={busy} onChange={e=>setX(Number(e.target.value))}/></label><label>الموضع الرأسي<input type="range" min={0} max={100} value={y} disabled={busy} onChange={e=>setY(Number(e.target.value))}/></label></details>}
  <p className="avatar-image-hint">JPEG أو PNG أو WebP · حتى ١٠ ميجابايت.<br/>تُجهّز الصورة وتُضغط تلقائيًا قبل الرفع.</p>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="avatar-dialog-actions"><button type="button" className="button orange" disabled={busy||!source} onClick={()=>void save()}>{busy?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>}حفظ الصورة</button><button type="button" className="button ghost" disabled={busy} onClick={close}>إلغاء</button>{url&&<button type="button" className="text-link avatar-remove" disabled={busy} onClick={()=>void save(true)}><Trash2 size={15}/>إزالة الصورة</button>}</div>
 </dialog></div>;
}
