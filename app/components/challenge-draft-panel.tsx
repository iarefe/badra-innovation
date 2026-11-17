'use client';
import {useEffect,useId,useState} from 'react';
import {ArrowLeft,Check,ChevronDown} from 'lucide-react';
import {chatFields,type ChatDraft} from '@/lib/ai-challenge';
import {assistantDisplay,displayValue,latinDigits,sectionProgress,type ChatView} from '@/lib/challenge-chat-view';
import type {Entry} from '@/lib/challenges';

type Props={id:string;mobileOpen:boolean;view:ChatView;draft:ChatDraft;completion?:Entry;updated:(keyof ChatDraft)[];replyVersion:number;blocked:boolean;writing:boolean;editing:boolean;canEdit:(key:keyof ChatDraft)=>boolean;onEdit:(key:keyof ChatDraft)=>void;onManual:()=>void;onReview:()=>void};
export default function ChallengeDraftPanel({id,mobileOpen,view,draft,completion,updated,replyVersion,blocked,writing,editing,canEdit,onEdit,onManual,onReview}:Props){
 const base=useId(),[open,setOpen]=useState<Set<string>>(()=>new Set());
 const {activeGroup,current}=view,progress=sectionProgress(view);
 useEffect(()=>{
  const targets=view.sections.filter(s=>updated.some(k=>s.keys.includes(k))).map(s=>s.id);
  if(activeGroup&&(writing||editing))targets.push(activeGroup);
  if(targets.length)setOpen(old=>new Set([...old,...targets]));
 },[activeGroup,writing,editing,replyVersion]);
 function toggle(key:string){setOpen(old=>{const next=new Set(old);if(next.has(key))next.delete(key);else next.add(key);return next})}
 return <aside id={id} className="bsa-card" aria-label="بطاقة تحدّيك" data-mobile-open={mobileOpen}>
  <div className="bsa-card-head" data-badra-anchor="challenge-progress">
   <p className="bsa-card-kicker">بطاقة تحدّيك · تُبنى من إجاباتك</p>
   <h2 data-placeholder={!draft.title}>{latinDigits(draft.title||assistantDisplay.titlePlaceholder)}</h2>
   <p className="bsa-tally">اكتمل {progress.done} من {progress.total} أقسام</p>
  </div>
  <div className="bsa-card-scroll">
   {view.sections.map((s,i)=>{
    const isOpen=open.has(s.id),done=s.done===s.total,active=s.id===activeGroup;
    return <section className="bsa-group" key={s.id} data-group={s.id}>
     <h3><button type="button" className="bsa-group-toggle" data-active={active} aria-expanded={isOpen} aria-controls={base+'-'+s.id} onClick={()=>toggle(s.id)}>
      <span className="bsa-group-no" data-complete={done} data-active={active} aria-hidden="true">{done?<Check size={15}/>:i+1}</span>
      <span className="bsa-group-title">{s.title}</span><span className="bsa-group-count" data-complete={done} data-active={active}>{done?'مكتمل':active?'يسأل عنه الآن':s.done+' من '+s.total}</span><ChevronDown size={15} aria-hidden="true"/>
     </button></h3>
     <div className="bsa-fields" id={base+'-'+s.id} hidden={!isOpen}>{s.keys.map(k=>{
      const activeField=current===k,filled=!!draft[k]?.trim();
      return <div key={k} className="bsa-field" data-field={k} data-state={activeField?'current':view.complete(k)?'complete':'empty'} data-current-field={activeField} data-flash={updated.includes(k)?replyVersion%2?'a':'b':undefined}>
       <div className="bsa-field-label"><b>{chatFields[k]}</b>{filled&&canEdit(k)?<button type="button" className="bsa-edit" disabled={blocked} aria-label={'تعديل '+chatFields[k]} onClick={()=>onEdit(k)}>تعديل</button>:!s.optional&&!view.required.includes(k)?<small>اختياري</small>:null}</div>
       {filled&&<p dir="auto">{latinDigits(displayValue(k,draft[k]))}</p>}
       {activeField&&!filled?<p className="bsa-field-hint">بانتظار إجابتك…</p>:!filled?<p className="bsa-field-hint">لم يُذكر بعد</p>:null}
      </div>})}</div>
    </section>;
   })}
  </div>
  <div className="bsa-card-foot">
   {view.canReview&&<button type="button" className="bsa-review" data-badra-anchor="review-challenge" aria-disabled={blocked||editing} onClick={()=>{if(!blocked&&!editing)onReview()}}>{completion?'مراجعة الإضافات':'إرسال البطاقة'}<ArrowLeft size={16} aria-hidden="true"/></button>}
   <button type="button" className="bsa-text-action" onClick={onManual} disabled={blocked}>{completion?'مراجعة التفاصيل يدويًا':'تعديل المسودة بالنموذج'}</button>
  </div>
 </aside>;
}
