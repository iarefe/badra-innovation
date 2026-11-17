'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,CircleDashed,RefreshCw} from 'lucide-react';
import type {TeamReadinessRow} from '@/lib/team-readiness';
import './admin-team-readiness.css';

type Props={initialRows?:TeamReadinessRow[]|null};
const items=[
  {key:'solution',title:'رابط الحل',yes:'متاح',no:'ينقص الرابط'},
  {key:'instructions',title:'إرشادات التشغيل',yes:'محفوظة',no:'تنقص الإرشادات'},
  {key:'slides',title:'العرض التقديمي',yes:'متاح',no:'ينقص العرض'},
] as const;
const delivered=(r:TeamReadinessRow)=>items.every(i=>r[i.key]);

function CountOf({count,total}:{count:number;total:number}){
  return <span className="btr-count-of" dir="rtl"><bdi dir="ltr">{count}</bdi> من <bdi dir="ltr">{total}</bdi></span>;
}

function ReadinessRow({row:r}:{row:TeamReadinessRow}){
  const done=delivered(r);
  const action=done?'معاينة تسليم الفريق':'فتح تسليمات الفريق';
  const dest='/teams?team='+encodeURIComponent(r.id)+(done?'&view=preview':'#deliverables');
  return <tr>
    <th scope="row"><span className="btr-team-number">فريق <bdi dir="ltr">{r.rank}</bdi></span><strong>{r.title}</strong></th>
    {items.map(i=><td key={i.key}><span className="btr-field" aria-hidden="true">{i.title}</span>
      <span className="btr-marker" data-ready={r[i.key]}>{r[i.key]?<Check size={14} aria-hidden="true"/>:<CircleDashed size={14} aria-hidden="true"/>}{r[i.key]?i.yes:i.no}</span>
    </td>)}
    <td><span className="btr-field" aria-hidden="true">بطاقات التحكيم</span>{r.required?<span aria-label={r.submitted+' من '+r.required+' بطاقات تحكيم مكتملة'} className="btr-judging"><CountOf count={r.submitted} total={r.required}/></span>:<span className="btr-muted">لم يُكلّف مقيّم</span>}</td>
    <td className="btr-cta"><a href={dest} aria-label={action+' · '+r.title} className="btr-open">{action}<ArrowLeft size={15} aria-hidden="true"/></a></td>
  </tr>;
}

export default function AdminTeamReadiness({initialRows}:Props){
  const [rows,setRows]=useState<TeamReadinessRow[]|null>(initialRows??null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  const refresh=useCallback(async()=>{
    request.current?.abort();const ctrl=new AbortController();request.current=ctrl;setBusy(true);setError('');
    try{
      const res=await fetch('/api/team-readiness',{cache:'no-store',signal:ctrl.signal});
      if(ctrl.signal.aborted)return;
      if(res.status===401||res.status===403){setRows(null);throw Error('سجّل الدخول بحساب الإدارة لعرض جاهزية الفرق.')}
      if(!res.ok)throw Error('تعذّر تحديث الجاهزية. حاول مجددًا.');
      const data=await res.json() as {rows:TeamReadinessRow[]};if(!ctrl.signal.aborted)setRows(data.rows);
    }catch(e){if(!ctrl.signal.aborted)setError(e instanceof Error?e.message:'تعذّر تحديث الجاهزية. حاول مجددًا.')}
    finally{if(!ctrl.signal.aborted)setBusy(false)}
  },[]);
  useEffect(()=>{
    if(initialRows!=null)setRows(initialRows);else void refresh();
    const active=()=>{if(!document.hidden)void refresh()};
    window.addEventListener('focus',active);document.addEventListener('visibilitychange',active);
    return()=>{request.current?.abort();window.removeEventListener('focus',active);document.removeEventListener('visibilitychange',active)};
  },[initialRows,refresh]);
  const ready=rows?.filter(delivered).length??0;
  return <section className="ba-card btr-panel" aria-label="جاهزية الفرق">
    <header className="btr-head"><div><span className="btr-kicker">متابعة التسليم والتحكيم</span><h2>جاهزية الفرق</h2></div>
      <button type="button" className="ba-btn" onClick={refresh} disabled={busy}><RefreshCw size={15} aria-hidden="true"/>{busy?'جارٍ التحديث…':'تحديث الجاهزية'}</button></header>
    {rows&&rows.length>0&&<div className="btr-snapshot">
      <div><strong>التسليمات المكتملة</strong><b><CountOf count={ready} total={rows.length}/></b></div>
      <progress max={rows.length} value={ready} aria-label="اكتمال تسليمات الفرق" aria-valuetext={ready+' من '+rows.length}/>
      <p>{ready===rows.length?'جميع التسليمات متاحة. افتح معاينة أي فريق لمراجعة ما سيطّلع عليه المقيّم.':'تبيّن القائمة ما ينقص كل فريق. افتح تسليماته للاطّلاع على التفاصيل.'}</p>
    </div>}
    {error&&<p role="alert" className="ba-error">{error}{rows?' تظهر آخر بيانات متاحة.':''}</p>}
    {rows&&rows.length>0?<table className="btr-table" aria-label="تسليمات الفرق وبطاقات التحكيم المكتملة"><thead><tr><th scope="col">الفريق</th>{items.map(i=><th key={i.key} scope="col">{i.title}</th>)}<th scope="col">بطاقات التحكيم</th><th scope="col">الخطوة التالية</th></tr></thead>
      <tbody>{rows.map(r=><ReadinessRow key={r.id} row={r}/>)}</tbody></table>
      :rows?<p className="btr-muted">تظهر جاهزية الفرق هنا بعد إعلان التحديات المرشّحة.</p>
      :!error&&<p role="status" className="btr-muted">نحمّل تسليمات الفرق وحالة التحكيم…</p>}
  </section>;
}
