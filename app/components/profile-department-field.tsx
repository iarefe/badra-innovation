'use client';
import {useState} from 'react';
import {profileDepartment,departmentMaxLength} from '@/lib/profile-department';
import type {AccountState} from '@/lib/account';
export function DepartmentField({value,onChange,disabled=false,focus=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean;focus?:boolean}){
 return <label className="field profile-department-field"><span data-badra-anchor="profile-department">اسم الإدارة</span><input name="department" autoComplete="off" autoFocus={focus} value={value} onChange={e=>onChange(e.target.value)} minLength={2} maxLength={departmentMaxLength} disabled={disabled} required placeholder="مثال: إدارة المنح"/><small>تظهر إدارتك تحت اسمك في صفحة التحدي الذي تطرحه.</small></label>;
}
export function AccountDepartment({value,onSaved}:{value:string;onSaved:(state:AccountState)=>void}){
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 async function save(){if(busy||!profileDepartment(draft))return;setBusy(true);setError('');
  try{const response=await fetch('/api/employee-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update-department',department:draft})});const data=await response.json() as {account?:AccountState;error?:string};
   if(!response.ok||!data.account)throw Error(data.error||'تعذّر حفظ اسم الإدارة.');onSaved(data.account);setEditing(false);setSaved(true);
  }catch(e){setError(e instanceof Error?e.message:'تعذّر حفظ اسم الإدارة.')}finally{setBusy(false)}
 }
 return <div className="member-department">{editing?<form onSubmit={e=>{e.preventDefault();void save()}}><DepartmentField value={draft} onChange={setDraft} disabled={busy} focus/>{error&&<p role="alert" className="error">{error}</p>}<div className="member-edit-actions"><button className="button dark small" disabled={busy||!profileDepartment(draft)}>{busy?'جارٍ الحفظ…':'حفظ الإدارة'}</button><button type="button" className="text-link" disabled={busy} onClick={()=>setEditing(false)}>إلغاء</button></div></form>:<><div className="member-department-label"><span>الإدارة</span><button className="text-link" type="button" aria-label="تعديل اسم الإدارة" onClick={()=>{setDraft(value);setEditing(true);setError('');setSaved(false)}}>تعديل</button></div><p>{value}</p>{saved&&<small role="status">حُفظ اسم إدارتك.</small>}</>}</div>;
}
