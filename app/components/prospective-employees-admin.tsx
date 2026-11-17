'use client';
import {useState,useRef} from 'react';
import {Link2} from 'lucide-react';
import {EmployeeRecordBadge} from './participation-badges';
import type {ProspectiveEmployee} from '@/lib/prospective-employees';
import {normalizePhone} from '@/lib/phone';
import {personMatches,prospectMatches,num,type RegisteredEmployee,type AdminNotify,type ProspectFilter} from '@/lib/admin-dashboard';
import {ProfileAvatar} from './profile-avatar';
import {Empty,stagger,AdminBar} from './admin-ui';
import AdminDialog from './admin-dialog';

type Props={rows:ProspectiveEmployee[];employees:RegisteredEmployee[];query:string;busy:boolean;filter:ProspectFilter;setFilter:(f:ProspectFilter)=>void;notify:AdminNotify;afterSave:()=>Promise<void>;editAccount:(id:string)=>void};
export default function ProspectiveEmployeesAdmin({rows,employees,query,busy,filter,setFilter,notify,afterSave,editAccount}:Props){
 const [editing,setEditing]=useState<ProspectiveEmployee|null>(null),[phone,setPhone]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const inFlight=useRef(false),confirmed=rows.filter(r=>r.linkedEmployeeId).length;
 const visible=rows.filter(r=>prospectMatches(r,filter)&&personMatches(r.name,r.phone,query));
 async function save(event:React.FormEvent){
  event.preventDefault();if(!editing||inFlight.current)return;inFlight.current=true;setSaving(true);setError('');
  try{const r=await fetch('/api/prospective-employees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'assign-phone',id:editing.id,revision:editing.revision,phone})});
   const d=await r.json() as {error?:string;message?:string};if(!r.ok)throw Error(d.error||'تعذّر حفظ ربط الجوال.');setEditing(null);notify(d.message||'حُفظ ربط الجوال.');await afterSave();
  }catch(e){setError(e instanceof Error?e.message:'تعذّر حفظ ربط الجوال.')}finally{inFlight.current=false;setSaving(false)}
 }
 return <div className="ba-stack ba-people-body">
  <p className="ba-muted">بيانات جاهزة من ملف الموظفين. يؤكد المشارك اسمه وصورته بعد توثيق جواله، ثم يختار أدواره.</p>
  <div className="ba-pills" role="group" aria-label="حالة سجل الموظف">{([['all','الكل'],['unregistered','لم يسجّل'],['confirmed','مؤكَّد']] as const).map(([id,label])=><button type="button" key={id} data-br-state={id==='all'?undefined:`record-${id}`} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
  <div className="ba-confirm-progress"><span>{num(confirmed)} من {num(rows.length)} أكّدوا</span><AdminBar value={confirmed} max={rows.length} label="تأكيد بيانات الموظفين"/></div>
  <div className="ba-table-scroll" role="region" aria-label="جدول الموظفين المحتملين" tabIndex={0}><table><thead><tr><th scope="col">الموظف</th><th scope="col">الجوال المرتبط</th><th scope="col">حالة السجل</th><th scope="col">الإجراء</th></tr></thead><tbody>
  {visible.map((r,i)=><tr className="ba-appear" style={stagger(i)} key={r.id}><th scope="row"><div className="ba-person"><ProfileAvatar name={r.name} url={r.avatarUrl} size="small" singleInitial/><b>{r.name}</b></div></th><td><bdi dir="ltr">{r.phone||'—'}</bdi></td>
   <td><EmployeeRecordBadge row={r}/>{r.linkedEmployeeId&&r.linkedName&&<small className="ba-linked-name">{r.linkedName}</small>}</td>
   <td>{r.linkedEmployeeId?<button type="button" className="ba-link" disabled={busy||saving} onClick={()=>editAccount(r.linkedEmployeeId!)}>تعديل حساب المسجّل</button>:<button type="button" className="ba-link" disabled={busy||saving} onClick={()=>{setEditing(r);setPhone(r.phone||'');setError('')}}><Link2 size={14}/>ربط جوال آخر</button>}</td>
  </tr>)}</tbody></table></div>
  {!visible.length&&<Empty>{rows.length?'لا توجد سجلات مطابقة.':'لا توجد سجلات موظفين محتملين.'}</Empty>}
  <AdminDialog open={!!editing} busy={saving} close={()=>setEditing(null)} title="ربط بيانات الموظف بجواله">{editing&&<form className="ba-stack" onSubmit={save}>
   <div className="ba-person ba-dialog-person"><ProfileAvatar name={editing.name} url={editing.avatarUrl} singleInitial/><div><b>{editing.name}</b><small><bdi dir="ltr">{editing.phone}</bdi></small></div></div>
   <p className="ba-help">اختر حسابًا مسجّلًا أو أدخل الجوال الجديد. سيُطلب من صاحبه تأكيد الاسم والصورة؛ تبقى مشاركاته وأصواته وأدواره محفوظة.</p>
   <label className="ba-field">اختر حسابًا مسجّلًا <small>اختياري</small><select value={employees.find(e=>e.phone===normalizePhone(phone))?.id||''} disabled={saving} onChange={e=>setPhone(employees.find(a=>a.id===e.target.value)?.phone||'')}><option value="">إدخال الجوال يدويًا</option>{employees.filter(e=>e.phone&&!rows.some(p=>p.linkedEmployeeId===e.id)).map(e=><option key={e.id} value={e.id}>{e.name||'لم يكمل الاسم'} · {e.phone}</option>)}</select></label>
   <label className="ba-field">رقم الجوال الجديد<input type="tel" inputMode="tel" dir="ltr" autoComplete="off" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={32} placeholder="05xxxxxxxx" required disabled={saving}/></label>
   {error&&<p className="ba-error" role="alert">{error}</p>}<div className="ba-actions"><button type="button" className="ba-btn" disabled={saving} onClick={()=>setEditing(null)}>إلغاء</button><button type="submit" className="ba-btn ba-primary" disabled={saving||!normalizePhone(phone)||normalizePhone(phone)===editing.phone}><Link2 size={15}/>حفظ ربط الجوال</button></div>
  </form>}</AdminDialog>
 </div>;
}
