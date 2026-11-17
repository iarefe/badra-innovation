'use client';
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Sparkles,Upload,X,LoaderCircle,Check} from 'lucide-react';
import type {Entry} from '@/lib/challenges';
import {initialCover,type ChallengeCover} from '@/lib/challenge-cover';
export function CoverImage({entry,priority=false}:{entry:Entry;priority?:boolean}){
 const cover=entry.cover||initialCover(entry.id,entry.challenge),fallback=initialCover(entry.id,entry.challenge).url;
 return <span className="challenge-cover-visual"><img className="challenge-cover-image" src={cover.url} alt={'رسم توضيحي لتحدي '+entry.challenge.title} width={1440} height={810} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={event=>{const image=event.currentTarget;if(image.getAttribute('src')!==fallback)image.src=fallback}}/></span>;
}
export function useAutomaticCovers(entries:Entry[],employeeId:string|undefined,onUpdate:(id:string,cover:ChallengeCover)=>void){
 const [cycle,setCycle]=useState(0);const attempted=useRef(new Set<string>()),active=useRef(false),session=useRef(employeeId);session.current=employeeId;
 useEffect(()=>{if(!employeeId||active.current)return;const candidate=entries.find(e=>e.mine&&!e.example&&(!e.cover||e.cover.status==='none')&&!attempted.current.has(e.id));if(!candidate)return;
  attempted.current.add(candidate.id);active.current=true;const owner=employeeId;
  onUpdate(candidate.id,{...(candidate.cover||initialCover(candidate.id,candidate.challenge)),status:'pending'});
  void (async()=>{let result:ChallengeCover={...(candidate.cover||initialCover(candidate.id,candidate.challenge)),status:'failed'};try{const response=await fetch('/api/challenge-cover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:candidate.id,action:'auto'})});const data:any=await response.json();if(data.cover)result=data.cover;}catch{}finally{active.current=false;if(session.current===owner)onUpdate(candidate.id,result);setCycle(n=>n+1);}})();
 },[entries,employeeId,cycle]);
}
async function prepareImage(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('اختر صورة JPEG أو PNG أو WebP لا تتجاوز ١٠ ميجابايت.');
 const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw Error('الصورة غير صالحة.');const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d');if(!ctx)throw Error('تعذّر تجهيز الصورة.');ctx.drawImage(image,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('تعذّر تجهيز الصورة.')),'image/webp',.84));}finally{URL.revokeObjectURL(url)}
}
export default function CoverEditor({entry,onUpdate,compact=false}:{entry:Entry;compact?:boolean;onUpdate:(id:string,cover:ChallengeCover)=>void}){
 const [open,setOpen]=useState(false),[prompt,setPrompt]=useState(entry.cover?.prompt||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState(''),[upload,setUpload]=useState<Blob|null>(null);const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const cover=entry.cover||initialCover(entry.id,entry.challenge),pending=cover.status==='pending';
 useEffect(()=>{if(open){dialog.current?.showModal();setPrompt(entry.cover?.prompt||'')}else dialog.current?.close()},[open]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 function close(){if(busy)return;setOpen(false);setUpload(null);setPreview('');setError('');setMessage('')}
 async function save(kind:'generate'|'upload'){
  if(busy||pending)return;setBusy(true);setError('');setMessage('');
  try{const response=await fetch('/api/challenge-cover'+(kind==='upload'?'?id='+encodeURIComponent(entry.id):''),{method:'POST',headers:{'Content-Type':kind==='upload'?'image/webp':'application/json'},body:kind==='upload'?upload!:JSON.stringify({id:entry.id,action:'generate',prompt})});const d:any=await response.json();if(d.cover)onUpdate(entry.id,d.cover);if(!response.ok)throw Error(d.error||'تعذّر حفظ الغلاف.');setUpload(null);setPreview('');setMessage('حُفظ الغلاف، وظهر في جميع بطاقات التحدي.');}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function choose(file?:File){if(!file)return;setError('');try{const blob=await prepareImage(file);setUpload(blob);setPreview(URL.createObjectURL(blob));setMessage('')}catch(e){setError((e as Error).message)}if(fileInput.current)fileInput.current.value='';}
 return <>{compact?<button type="button" className="cd-edit-cover" onClick={()=>setOpen(true)}>تعديل الغلاف</button>:<div className="cover-owner-tools"><button type="button" className="button ghost small" onClick={()=>setOpen(true)}><ImagePlus size={16}/>تعديل الغلاف</button>{pending?<span role="status"><LoaderCircle size={14} className="spin"/>يجري توليد غلافك… يمكنك متابعة التصفح.</span>:cover.status==='failed'?<span>لم يكتمل التوليد؛ أعد المحاولة من «تعديل الغلاف».</span>:<span>يمكنك تغيير الصورة دون تغيير الأصوات أو رغبات الانضمام.</span>}</div>}
 <dialog className="cover-dialog" ref={dialog} onCancel={e=>{if(busy)e.preventDefault();else close()}} onClose={()=>setOpen(false)}><div className="cover-dialog-heading"><div><span className="eyebrow">صورة تعبّر عن التحدي</span><h2>غلاف التحدي</h2></div><button type="button" className="icon-button" aria-label="إغلاق تعديل الغلاف" disabled={busy} onClick={close}><X size={20}/></button></div><div className="cover-editor-preview">{preview?<span className="challenge-cover-visual"><img className="challenge-cover-image" src={preview} alt="معاينة الصورة المختارة"/></span>:<CoverImage entry={entry}/>}</div><p className="cover-editor-note">التغيير هنا للصورة فقط. يُبنى الغلاف على عنوان التحدي ووصفه وأثره، ويمكنك توجيه شكله أو رفع صورتك.</p>
 <label className="field">كيف تحب أن يظهر الغلاف؟ <small>اختياري؛ اتركه فارغًا ليولّد المساعد تصورًا من بيانات التحدي.</small><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={600} rows={3} disabled={busy||pending} placeholder="مثلًا: كتب وأدلة معرفية تنتظر الوصول إلى الموظفين، بأسلوب هادئ وبسيط"/></label>
 <div className="cover-editor-actions"><button type="button" className="button dark" disabled={busy||pending||!!upload} onClick={()=>save('generate')}><Sparkles size={17}/>{busy&&!upload?'يجري التوليد…':'توليد غلاف جديد'}</button><button type="button" className="button ghost" disabled={busy||pending} onClick={()=>fileInput.current?.click()}><Upload size={17}/>رفع صورة</button><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>choose(e.target.files?.[0])}/></div>
 {upload&&<div className="cover-upload-confirm"><p>هذه معاينة؛ لن تتغير الصورة حتى تحفظها.</p><button className="button dark" disabled={busy||pending} onClick={()=>save('upload')}>{busy?'جارٍ الحفظ…':'حفظ الصورة المختارة'}</button><button className="text-link" disabled={busy} onClick={()=>{setUpload(null);setPreview('')}}>إلغاء الصورة</button></div>}
 {(busy||pending)&&<p className="cover-editor-status" role="status"><LoaderCircle size={16} className="spin"/>قد يستغرق تجهيز الغلاف نحو دقيقة. يبقى غلافك الحالي حتى يكتمل البديل.</p>}{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="member-feedback" role="status"><Check size={16}/>{message}</p>}
 </dialog></>;
}
