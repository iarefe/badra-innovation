'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpLeft,Check,ChevronDown,RotateCcw,X} from 'lucide-react';
import {useChatSession} from './chat-session-context';
import VoiceInput from './voice-input';
import ChallengeDraftPanel from './challenge-draft-panel';
import ChallengeRemaining from './challenge-remaining';
import {chatFields,type ChatDraft} from '@/lib/ai-challenge';
import {assistantDisplay,challengeChatView,conversationAnswers,fieldOptions,latinDigits,questionParts,sectionProgress} from '@/lib/challenge-chat-view';
import type {Challenge,Entry} from '@/lib/challenges';

type Props={participantKey:string;completion?:Entry;initialDraft?:Challenge;onReview:(draft:Challenge)=>void;onManual:(draft:Challenge)=>void};
export default function ChallengeChat({onReview,onManual,participantKey,completion,initialDraft}:Props){
 const {session,messages,draft,text,pending,busy,error,ready,reviewRequested,available,resumed,saveFailed,replyVersion,updatedKeys,interview,editing,lastAction}=useChatSession({participantKey,completion,initialDraft});
 const [voiceBusy,setVoiceBusy]=useState(false),[why,setWhy]=useState(false),[allHistory,setAllHistory]=useState(false),[cardOpen,setCardOpen]=useState(false),[restartOpen,setRestartOpen]=useState(false),[emptyError,setEmptyError]=useState(false),[restartVersion,setRestartVersion]=useState(0);
 const input=useRef<HTMLTextAreaElement>(null),privacy=useRef<HTMLDialogElement>(null),cancelRestart=useRef<HTMLButtonElement>(null),base=useId(),lastReply=useRef(replyVersion);
 const view=challengeChatView(draft,ready,interview?.asked.at(-1),messages,!!completion),progress=sectionProgress(view);
 const field=editing?.field||view.current,activeGroup=view.sections.find(s=>field&&s.keys.includes(field)),groupIndex=view.sections.findIndex(s=>s.id===activeGroup?.id);
 const panelView=editing?{...view,current:field,activeGroup:activeGroup?.id}:view;
 const latest=questionParts(messages.findLast(m=>m.role==='assistant')?.content||'');
 const question=editing?.question||latest.question,help=field?assistantDisplay.fieldHelp[field as keyof typeof assistantDisplay.fieldHelp]:undefined;
 const stage=interview?.asked.at(-1),remaining=!editing&&!view.canReview&&(stage==='pause'||stage==='review');
 const answers=conversationAnswers(messages),visibleAnswers=answers.filter(m=>!editing||m.index!==editing.index&&m.question!==question),history=allHistory?visibleAnswers:remaining||view.canReview?[]:visibleAnswers.slice(-2),blocked=busy||voiceBusy;
 const filling=editing?.kind==='field'&&!!field&&!view.complete(field);
 const options=editing?.kind==='field'||(!editing&&!view.canReview&&!remaining)?fieldOptions(field):[];
 const starters=options.length?options.map(o=>({label:o.label,text:o.label})):!completion&&!view.started?assistantDisplay.starters:[];
 const feedback=assistantDisplay.feedback;
 const currentToken=editing?editing.kind+':'+(editing.field||editing.index):messages.length+':'+latest.question;
 function focusInput(){requestAnimationFrame(()=>{const target=document.querySelector<HTMLElement>('.bsa-remaining #q-text,.bsa-complete-label + #q-text')||input.current||document.getElementById('q-text');target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',behavior:'instant'})})}
 useEffect(()=>{
  if(!reviewRequested||blocked||editing||!session.consumeReviewRequest())return;
  if(view.canReview)onReview({...draft} as Challenge);else focusInput();
 },[reviewRequested,blocked,editing,session,view.canReview,draft,onReview,onManual]);
 useEffect(()=>{setWhy(false);setEmptyError(false)},[currentToken]);
 useEffect(()=>{if(replyVersion!==lastReply.current){lastReply.current=replyVersion;focusInput()}},[replyVersion]);
 useEffect(()=>{if(restartOpen)cancelRestart.current?.focus()},[restartOpen]);
 function manual(){if(editing)session.cancelEdit();onManual({...draft} as Challenge)}
 function review(){if(view.canReview&&!blocked&&!editing)onReview(draft as Challenge)}
 function update(value:string){session.setText(value);session.clearError();setEmptyError(false)}
 function send(){if(blocked)return;if(!text.trim()){setEmptyError(true);focusInput();return}setEmptyError(false);void session.send()}
 function startEdit(key:keyof ChatDraft){if(session.beginFieldEdit(key)){setCardOpen(false);setEmptyError(false);focusInput()}}
 function pickGap(key:keyof ChatDraft,value:string){if(blocked||!session.beginFieldEdit(key))return;session.setText(value);setEmptyError(false);void session.send();focusInput()}
 function editAnswer(index:number){if(session.beginAnswerEdit(index)){setCardOpen(false);setEmptyError(false);focusInput()}}
 function restart(){session.restart();setRestartVersion(v=>v+1);setRestartOpen(false);setWhy(false);setAllHistory(false);setCardOpen(false);setEmptyError(false);focusInput()}
 const arrive=replyVersion%2?'a':'b',notice=emptyError?feedback.empty:latinDigits(error);
 return <div className="badra-assistant bsa-studio" lang="ar" dir="rtl" data-badra-busy={blocked}>
  <header className="bsa-heading"><h1 data-badra-anchor="challenge-start">مساعد بذرة <span>· {completion?'أكمل صورة تحدّيك':'تحدّيك يبدأ من هنا'}</span></h1>
   <p>{completion?assistantDisplay.completionIntro:assistantDisplay.intro} <button type="button" className="bsa-text-action bsa-switch" onClick={manual} disabled={blocked}>{completion?'مراجعة التفاصيل يدويًا':'تفضّل النموذج؟ اكتب البطاقة مباشرة'} <ArrowLeft size={15} aria-hidden="true"/></button></p>
  </header>
  {resumed&&<div className="bsa-resumed" role="status"><RotateCcw size={15} aria-hidden="true"/><span>محادثتك محفوظة. أكمل من حيث توقفت.</span><button type="button" className="bsa-icon" onClick={session.dismissResumed} aria-label="إخفاء تنبيه استعادة المحادثة"><X size={16} aria-hidden="true"/></button></div>}
  <div className="bsa-columns">
   <button type="button" className="bsa-mobile-card" aria-expanded={cardOpen} aria-controls={base+'-card'} onClick={()=>setCardOpen(v=>!v)}><b>بطاقتك</b><span>اكتمل {progress.done} من {progress.total} أقسام</span><span>{cardOpen?'إخفاء':'عرض'} <ChevronDown size={15} aria-hidden="true"/></span></button>
   <section className="bsa-conversation" aria-label="المحادثة مع بذرة">
    <div className="bsa-conversation-head">
     <div className="bsa-identity"><span className="bsa-avatar"><img src="/placeholder.svg" width={32} height={32} alt=""/></span><h2>بذرة</h2></div>
     <div className="bsa-head-actions"><span className="bsa-save-state" role="status" data-failed={saveFailed}>{saveFailed?'تعذّر الحفظ المؤقت':view.started&&!busy?<><Check size={14} aria-hidden="true"/>{feedback.saved}</>:available===null?'جارٍ التجهيز…':null}</span>
      <div className="bsa-section-progress" role="progressbar" aria-label="تقدّم البطاقة" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-valuetext={`اكتمل ${progress.done} من ${progress.total} أقسام`}>{view.sections.filter(s=>!s.optional).map(s=><span key={s.id} data-state={s.done===s.total?'complete':s.id===panelView.activeGroup?'current':'empty'}/>)}</div>
      <button type="button" className="bsa-icon" disabled={blocked} onClick={()=>setRestartOpen(v=>!v)} aria-label="ابدأ من جديد" aria-expanded={restartOpen} aria-controls={base+'-restart'}><RotateCcw size={17} aria-hidden="true"/></button>
     </div>
    </div>
    {restartOpen&&<div className="bsa-restart" id={base+'-restart'} role="alertdialog" aria-labelledby={base+'-restart-text'} onKeyDown={e=>{if(e.key==='Escape'){setRestartOpen(false);focusInput()}}}><p id={base+'-restart-text'}>{completion?feedback.restartCompletion:feedback.restart}</p><div><button type="button" ref={cancelRestart} onClick={()=>{setRestartOpen(false);focusInput()}}>إلغاء</button><button type="button" className="bsa-danger" onClick={restart}>امسح وابدأ</button></div></div>}
    <div className="bsa-conversation-body">
     {!!answers.length&&<div className="bsa-history"><button type="button" className="bsa-text-action" aria-expanded={allHistory} aria-controls={base+'-history'} onClick={()=>setAllHistory(v=>!v)}>{allHistory?'إخفاء المحادثة السابقة':`عرض المحادثة كاملة (${answers.length})`}</button>
      <ol id={base+'-history'} aria-label="إجاباتك السابقة">{history.map(m=><li key={m.index}><p className="bsa-history-question">{latinDigits(m.question)}</p><div><p dir="auto">{latinDigits(m.answer)}</p><button type="button" className="bsa-edit" disabled={blocked} aria-label={'تعديل إجابة: '+(m.field?chatFields[m.field]:m.question||feedback.previousAnswer)} onClick={()=>editAnswer(m.index)}>تعديل</button></div></li>)}</ol>
     </div>}
     {editing&&<div className="bsa-editing" role="status"><strong>{filling?assistantDisplay.recovery.editHeading:'تعدّل إجابة سابقة'}</strong><button type="button" className="bsa-text-action" disabled={blocked} onClick={()=>{session.cancelEdit();setEmptyError(false);focusInput()}}>إلغاء التعديل</button></div>}
     {remaining?<ChallengeRemaining draft={draft} blocked={blocked} onFill={startEdit} onPick={pickGap} onManual={manual}/>:<div className="bsa-current" aria-live="polite" aria-atomic="true" aria-busy={busy} data-arrive={replyVersion?arrive:undefined}>
      {view.canReview&&!editing?<><p className="bsa-complete-label"><Check size={16} aria-hidden="true"/>اكتملت أقسام البطاقة</p><h2 id="q-text" tabIndex={-1}>{feedback.completionTitle}</h2><p className="bsa-question-context">{feedback.completionHint}</p><button type="button" className="bsa-ready-review" disabled={blocked} onClick={review}>{completion?'راجع الإضافات':assistantDisplay.recovery.review}<ArrowLeft size={17} aria-hidden="true"/></button></>:<>
       {activeGroup&&<p className="bsa-step">{!activeGroup.optional&&<>الخطوة {groupIndex+1} من {progress.total} · </>}{activeGroup.title} · {field&&chatFields[field]}</p>}
       {!view.started&&!editing&&latest.context&&<p className="bsa-question-context">{latinDigits(latest.context)}</p>}
       {view.started&&!busy&&!editing&&<p className="bsa-confirmed"><Check size={15} aria-hidden="true"/>{latinDigits(lastAction==='edit'?feedback.edited:latest.context||feedback.answerSaved)}</p>}
       <h2 id="q-text">{latinDigits(question||feedback.loading)}</h2>
      </>}
     </div>}
     {!remaining&&help&&(!view.canReview||editing)&&<div className="bsa-why"><button type="button" className="bsa-text-action" aria-expanded={why} aria-controls={base+'-why'} onClick={()=>setWhy(v=>!v)}>لماذا نسأل هذا؟</button><p id={base+'-why'} hidden={!why}>{help.why}</p></div>}
     {busy&&<div className="bsa-writing" role="status" aria-label="بذرة تكتب"><i aria-hidden="true"/><i aria-hidden="true"/><i aria-hidden="true"/><span className="sr-only">بذرة تكتب</span></div>}
     {!remaining&&!busy&&!!starters.length&&<div className="bsa-starters"><p>{options.length?field==='domain'?assistantDisplay.recovery.domainHint:assistantDisplay.recovery.chooseThenSend:assistantDisplay.quickStartIntro}</p><div>{starters.map(s=><button type="button" key={s.label} disabled={blocked} onClick={()=>{update(s.text);focusInput()}}>{s.label}</button>)}</div></div>}
     {!remaining&&<form className="bsa-composer" onSubmit={e=>{e.preventDefault();send()}}>
      <div className="bsa-input-box">
       <label className="sr-only" htmlFor="bsa-answer">إجابتك عن السؤال</label>
       <textarea data-badra-anchor="challenge-write" id="bsa-answer" ref={input} value={text} onChange={e=>update(e.target.value)} rows={3} maxLength={4000} readOnly={blocked} aria-invalid={!!notice} aria-describedby={'q-text'+(notice?' '+base+'-error':'')}
        placeholder={view.canReview&&!editing?assistantDisplay.composer.afterReview:help?.hint||(completion?assistantDisplay.composer.completionHint:assistantDisplay.composer.replyHint)}
        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
       <div className="bsa-controls"><VoiceInput compact latinNumbers disabled={busy||available!==true} remaining={Math.max(0,4000-text.length-(text.trim()?1:0))} onBusyChange={setVoiceBusy} onTranscript={value=>{session.setText(previous=>previous.trim()?previous+'\n'+value:value);session.clearError();setEmptyError(false);focusInput()}}/>
        {text.length>3500&&<span className="bsa-char-count"><bdi dir="ltr">{text.length} / 4000</bdi></span>}
        <button className="bsa-send" type="submit" aria-disabled={blocked||!text.trim()} data-empty={!text.trim()}>{filling?assistantDisplay.recovery.save:editing?'حفظ التعديل':'إرسال'}<ArrowUpLeft size={16} aria-hidden="true"/></button>
       </div>
      </div>
      {notice&&<p className="bsa-error" id={base+'-error'} role="alert">{notice}</p>}
      {!view.started&&<p className="bsa-help"><bdi>Enter</bdi> للإرسال · <bdi>Shift + Enter</bdi> لسطر جديد · تُحفظ إجاباتك تلقائيًا</p>}
      <div className="bsa-help bsa-private-help"><span data-failed={saveFailed}>{saveFailed?'تعذّر الحفظ المؤقت في هذا المتصفح؛ احتفظ بنسخة من إجاباتك.':feedback.savedNote}</span><button type="button" className="bsa-privacy-link" aria-haspopup="dialog" onClick={()=>privacy.current?.showModal()}>الخصوصية</button></div>
     </form>}
     {!editing&&!remaining&&!view.canReview&&(view.started||available===false)&&<button type="button" className="bsa-text-action bsa-show-gaps" disabled={blocked} onClick={()=>{session.showRemaining();focusInput()}}>{assistantDisplay.recovery.link}</button>}
     {available===false&&!remaining&&<div className="bsa-notice" role="status"><p>تعذّر تجهيز المساعد. يمكنك المحاولة مجددًا أو إكمال ما جمعناه بالنموذج.</p><div><button type="button" className="bsa-text-action" onClick={()=>session.checkAvailability()}>إعادة الاتصال</button><button type="button" className="bsa-text-action" disabled={blocked} onClick={manual}>أكمل بالنموذج</button></div></div>}
    </div>
   </section>
   <ChallengeDraftPanel key={restartVersion} id={base+'-card'} mobileOpen={cardOpen} view={panelView} draft={draft} completion={completion} updated={updatedKeys} replyVersion={replyVersion} blocked={blocked} writing={!!text.trim()} editing={!!editing} canEdit={session.canEditField} onEdit={startEdit} onManual={manual} onReview={review}/>
  </div>
  <dialog className="bsa-privacy" ref={privacy} aria-labelledby={base+'-privacy'} onClick={e=>{if(e.target===e.currentTarget){const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.currentTarget.close()}}}>
   <div><h2 id={base+'-privacy'}>{assistantDisplay.privacyTitle}</h2><button type="button" className="bsa-icon" onClick={()=>privacy.current?.close()} aria-label="إغلاق الخصوصية"><X size={18} aria-hidden="true"/></button></div><p>{assistantDisplay.privacyText}</p>
  </dialog>
 </div>;
}
