'use client';
import {useEffect,useState,useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {channelLabels,type AdminNotify,type Channel,type RegisteredEmployee} from '@/lib/admin-dashboard';
import type {AdminDirectory} from './use-admin-directory';
import UnifiedPeople from './unified-people';
import AdminDialog from './admin-dialog';

export default function ParticipationAdmin({directory,notify,mode='people'}:{directory:AdminDirectory;notify:AdminNotify;mode?:'people'|'settings'}){
 const {participation,prospects,reload}=directory,data=participation.data;

 const [editing,setEditing]=useState<RegisteredEmployee|null>(null),[channel,setChannel]=useState<Channel|null>(null);
 const [pending,setPending]=useState(''),[error,setError]=useState(''),[editError,setEditError]=useState(''),[check,setCheck]=useState<{ok:boolean;text:string}|null>(null);
 const working=useRef(false),busy=!!pending;
 useEffect(()=>{setChannel(data?.channel||null)},[data?.channel,data?.revision]);
 function edit(e:RegisteredEmployee){setEditing({...e,phone:e.phone||'',email:e.email||''});setEditError('')}
 async function save(body:Record<string,unknown>&{action:string}){
  if(working.current)return;working.current=true;setPending(body.action);setError('');setEditError('');
  if(body.action==='check-otp')setCheck(null);
  try{const r=await fetch('/api/participation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json() as {error?:string;message?:string};if(!r.ok)throw Error(d.error||'تعذّر تنفيذ الطلب.');
   if(body.action==='check-otp'){const result=d.message||'اكتمل فحص الاتصال.';setCheck({ok:true,text:result});notify(result);return}
   if(body.action==='update')setEditing(null);
   if(body.action==='otp-channel')setCheck(null);
   notify(body.action==='active'?(body.active?'أُعيد تفعيل الحساب.':'أُوقف الحساب.') :body.action==='otp-channel'?'حُفظت قناة إرسال الرموز.':'حُفظ تعديل الحساب.');
   await reload(body.action==='otp-channel'?'participation':'both');
  }catch(e){const msg=e instanceof Error?e.message:'تعذّر تنفيذ الطلب.';if(body.action==='check-otp')setCheck({ok:false,text:msg});else if(body.action==='update')setEditError(msg);else setError(msg)}
  finally{working.current=false;setPending('')}
 }
 const people=<UnifiedPeople directory={directory} busy={busy} notify={notify} editAccount={edit} toggleAccount={e=>void save({action:'active',id:e.id,active:!e.active})}/>;
 if(!data)return mode==='people'?people:<div className="ba-card">{participation.error?<p role="alert" className="ba-error">{participation.error}</p>:<p role="status">نحمّل إعدادات المشاركة…</p>}<button type="button" className="ba-link" onClick={()=>void reload('participation')}>إعادة التحميل</button></div>;
 const channels=data.channels,storedLabel=channelLabels[data.channel];
 return <section className="ba-stack" aria-label="المشاركون والدخول">
  {error&&<p className="ba-error" role="alert">{error}</p>}
  {mode==='people'&&people}
  {mode==='settings'&&<details className="ba-card ba-disclosure"><summary><span><b>إرسال رموز التحقق</b><small>القناة: {storedLabel} · {data.otpReady?'مفتاح Authentica مضاف':'مفتاح Authentica غير مضاف'}</small></span><ChevronDown size={17}/></summary>
   <div className="ba-disclosure-body ba-stack"><div className="ba-channel-line"><label className="ba-field">قناة إرسال الرمز<select value={channel??data.channel} disabled={busy} onChange={e=>{setChannel(e.target.value as Channel);setCheck(null)}}>{channels.map(k=><option key={k} value={k}>{channelLabels[k]}</option>)}</select></label>
    <button type="button" className="ba-btn" disabled={busy||channel===null||channel===data.channel} onClick={()=>void save({action:'otp-channel',channel,revision:data.revision})}>حفظ قناة الإرسال</button></div>
    <p className="ba-help">تأكد من تفعيل القناة المختارة في حساب Authentica. لا تُرسل الرسالة عبر القناتين معًا. {data.otpReady?'مفتاح Authentica مضاف. افحص الاتصال ثم اختبر وصول الرمز إلى جوالك.':'للتفعيل: أضف مفتاح Authentica في المتغير السري BATHRA_OTP لدى الاستضافة.'} تُرسل الرموز إلى الجوال الذي يدخله المشارك، وتنتهي خلال ١٠ دقائق كحد أقصى بحسب إعدادات المزود. لا تُعرض المفاتيح أو الرموز في لوحة الإدارة. يفحص المفتاح والاتصال دون إرسال رسالة. نجاح الفحص لا يؤكد وصول الرسالة.</p>
    <div className="ba-actions"><button type="button" className="ba-btn ba-primary" disabled={busy||!data.otpReady} onClick={()=>void save({action:'check-otp'})}>{pending==='check-otp'?'جارٍ الفحص…':'فحص اتصال Authentica'}</button>{check&&<span className="ba-check-result" data-ok={check.ok} role={check.ok?'status':'alert'}>{check.text}</span>}</div>
   </div>
  </details>}
  {mode==='settings'&&data.legacyVotes>0&&<p className="ba-help">حُفظ {data.legacyVotes} صوتًا من المشاركة السابقة. لا تدخل الأصوات غير المرتبطة بموظف في ترتيب التصويت الجديد. القائمة المعتمدة سابقًا تبقى محفوظة حتى إعادة فتح التصويت.</p>}
  <AdminDialog open={!!editing} busy={busy} close={()=>setEditing(null)} title="تعديل بيانات المشارك">{editing&&<form className="ba-stack" onSubmit={e=>{e.preventDefault();void save({action:'update',id:editing.id,name:editing.name,phone:editing.phone,email:editing.email})}}>
   <label className="ba-field">الاسم<input type="text" autoComplete="off" value={editing.name} required maxLength={100} disabled={busy} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
   <label className="ba-field">رقم الجوال<input type="tel" dir="ltr" autoComplete="off" value={editing.phone||''} required maxLength={100} disabled={busy} onChange={e=>setEditing({...editing,phone:e.target.value})}/></label>
   <p className="ba-help">تُحفظ الأصوات والمشاركات. يتطلب التعديل دخول المشارك مجددًا.</p>
   {editError&&<p className="ba-error" role="alert">{editError}</p>}<div className="ba-actions"><button type="button" className="ba-btn" disabled={busy} onClick={()=>setEditing(null)}>إلغاء</button><button className="ba-btn ba-primary" type="submit" disabled={busy}>حفظ التعديل</button></div>
  </form>}</AdminDialog>
 </section>
}
