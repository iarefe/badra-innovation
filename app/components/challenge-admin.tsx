'use client';
import {useState,useId,useMemo} from 'react';
import {ArrowLeft,ChevronDown,Trash2} from 'lucide-react';
import type {Entry} from '@/lib/challenges';
import {num,statusLabels} from '@/lib/admin-dashboard';
import {SearchBox,Empty,stagger} from './admin-ui';
import {participantRoles} from '@/lib/participant-roles';
import {filterAdminChallenges,type ChallengeListSort,type JoinRoleFilter} from '@/lib/admin-challenge-list';
import {StatusBadge,RoleTags} from './participation-badges';
type Filter='all'|Entry['status'];
export default function ChallengeAdmin({entries,busy,onDelete,announcedIds=[],initialWithInterests=false}:{initialWithInterests?:boolean;announcedIds?:string[];entries:Entry[];busy:boolean;onDelete:(entry:Entry)=>Promise<boolean>}){
 const [sort,setSort]=useState<ChallengeListSort>('newest'),[role,setRole]=useState<JoinRoleFilter>('all'),[limit,setLimit]=useState(20),[filter,setFilter]=useState<Filter>('all'),[query,setQuery]=useState(''),[open,setOpen]=useState<string[]>([]),[armed,setArmed]=useState<string|null>(null),base=useId();
 const counts={all:entries.length,published:entries.filter(e=>e.status==='published').length,draft:entries.filter(e=>e.status==='draft').length};
 const [withInterests,setWithInterests]=useState(initialWithInterests);
 const rows=useMemo(()=>filterAdminChallenges(entries,filter,query,role,sort,withInterests),[entries,filter,query,role,sort,withInterests]);

 return <section aria-label="إدارة التحديات" className="ba-stack">
  <div className="ba-toolbar"><div className="ba-pills" role="group" aria-label="حالة التحدي">{(['all','published','draft',...(['pending','returned'] as const).filter(status=>entries.some(e=>e.status===status))] as Filter[]).map(f=><button type="button" key={f} data-br-state={f==='all'?undefined:`challenge-${f}`} aria-pressed={filter===f} onClick={()=>{setArmed(null);setFilter(f);setLimit(20)}}>{f==='all'?'الكل':statusLabels[f]} <span>· {num(f in counts?counts[f as keyof typeof counts]:entries.filter(e=>e.status===f).length)}</span></button>)}</div><SearchBox value={query} onChange={s=>{setQuery(s);setLimit(20);setArmed(null)}} label="ابحث بالعنوان أو صاحب التحدي"/></div>
  <div className="ba-list-controls"><label className="ba-field">ترتيب التحديات<select value={sort} onChange={e=>{setSort(e.target.value as ChallengeListSort);setLimit(20);setArmed(null)}}><option value="newest">الأحدث أولًا</option><option value="votes">الأكثر أصواتًا</option><option value="interests">الأكثر رغبات انضمام</option></select></label><label className="ba-field">دور المنضمين<select value={role} onChange={e=>{setRole(e.target.value as JoinRoleFilter);setLimit(20);setArmed(null)}}><option value="all">جميع الأدوار</option>{participantRoles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}<option value="unspecified">دون دور محدد</option></select></label><p className="ba-help">التصفية تُظهر التحديات التي تضم صاحب الدور المختار؛ إجمالي الأصوات والرغبات لا يتغيّر.</p></div>
  <div className="ba-results-line"><button type="button" className="ba-btn" aria-pressed={withInterests} onClick={()=>{setWithInterests(!withInterests);setLimit(20);setArmed(null)}}>{withInterests?'إظهار كل التحديات':'إخفاء التحديات بلا رغبات'}</button><p role="status" aria-live="polite">عرض {num(rows.length)} من {num(entries.length)} تحديًا</p>{(withInterests||query||filter!=='all'||role!=='all'||sort!=='newest')&&<button type="button" className="ba-link" onClick={()=>{setWithInterests(false);setQuery('');setFilter('all');setRole('all');setSort('newest');setLimit(20);setArmed(null)}}>مسح البحث والفلاتر</button>}</div>
  {announcedIds.length?<p className="ba-help">يمكنك استعراض سجل التحديات. تبقى التحديات المعلنة مرتبطة بفرقها وتسليماتها.</p>:<p className="ba-help">تُنشر التحديات فور تسليمها خلال فترة الاستقبال. يمكنك استعراضها وحذف أي تحدٍ عند الحاجة؛ الحذف يزيل أصواته ورغبات الانضمام إليه أيضًا.</p>}
  <div className="ba-list">{rows.length?rows.slice(0,limit).map((e,i)=>{const expanded=open.includes(e.id),token=[e.id,e.votes,e.interestCount].join(':'),confirming=armed===token;
   return <article key={e.id} className="ba-ch-row ba-appear" style={stagger(i)}>
    <div className="ba-ch-line"><div className="ba-ch-copy"><div className="ba-meta"><StatusBadge state={`challenge-${e.status}`}>{statusLabels[e.status]}</StatusBadge><span>{e.challenge.author}</span><span className="category-tag">{e.challenge.domain}</span></div>
     <h2><button className="ba-disclose-title" type="button" aria-expanded={expanded} aria-controls={base+e.id} onClick={()=>setOpen(s=>s.includes(e.id)?s.filter(id=>id!==e.id):[...s,e.id])}>{e.challenge.title}<ChevronDown size={15} aria-hidden="true"/></button></h2>
     <p className="ba-desc" id={base+e.id} hidden={!expanded}>{e.challenge.situation}</p></div>
     <div className="ba-ch-tools"><span className="ba-number"><b>{num(e.votes??0)}</b>صوت</span><span className="ba-number"><b>{num(e.interestCount??0)}</b>راغب</span>
      <a className="ba-link" href={'/challenge/'+e.id}>استعرض البطاقة <ArrowLeft size={15}/></a>
      {announcedIds.includes(e.id)?<span className="ba-result-tag">تحدٍّ مرشّح</span>:<button type="button" className="ba-btn ba-danger" aria-label={'حذف تحدي '+e.challenge.title} aria-expanded={confirming} disabled={busy} onClick={()=>setArmed(confirming?null:token)}><Trash2 size={14}/>حذف</button>}
     </div>
    </div>
    <details className="ba-ch-members"><summary>المصوّتون وراغبو الانضمام <span>{num(e.votes??0)} صوت · {num(e.interestCount??0)} رغبة</span></summary><div className="ba-ch-member-grid"><section><h3>المصوّتون</h3>{e.voters?.length?<ul>{e.voters.map((m,j)=><li key={j}>{m.name||'مشارك دون اسم'}</li>)}</ul>:<p className="ba-help">{(e.votes??0)>0?'لم تتوفر أسماء المصوّتين.':'لا توجد أصوات.'}</p>}</section><section><h3>راغبو الانضمام</h3>{e.interestedMembers?.length?<ul>{e.interestedMembers.map((m,j)=><li key={j} data-matches={role!=='all'&&(role==='unspecified'?m.roles.length===0:m.roles.includes(role))}><strong>{m.name||'مشارك دون اسم'}</strong><RoleTags roles={m.roles}/></li>)}</ul>:<p className="ba-help">{(e.interestCount??0)>0?'لم تتوفر أسماء المنضمين.':'لا توجد رغبات انضمام.'}</p>}</section></div></details>
    {confirming&&<div className="ba-danger-strip" role="group" aria-label={'تأكيد حذف '+e.challenge.title}><p>سيُحذف التحدي مع {num(e.votes??0)} صوت و{num(e.interestCount??0)} رغبة انضمام. لا يمكن التراجع.</p><div className="ba-actions"><button type="button" className="ba-btn" disabled={busy} onClick={()=>setArmed(null)}>إلغاء</button><button type="button" className="ba-btn ba-danger-solid" disabled={busy} onClick={async()=>{if(await onDelete(e))setArmed(null)}}>تأكيد الحذف</button></div></div>}
   </article>;}):<Empty>{entries.length?'لا توجد نتائج مطابقة. جرّب اسمًا أو دورًا آخر أو امسح الفلاتر.':'لم تصل تحديات بعد. ستظهر هنا فور إضافتها.'}</Empty>}</div>
  {rows.length>limit&&<button type="button" className="ba-btn" onClick={()=>setLimit(v=>v+20)}>عرض المزيد · يتبقى {num(rows.length-limit)}</button>}
 </section>
}
