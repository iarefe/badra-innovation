'use client';
import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {CheckCircle2,Send} from 'lucide-react';
import {inquiryMinLength,inquiryMaxLength} from '@/lib/faq-inquiries';

function newRequestId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export default function FaqInquiry(){
 const base=useId(),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const requestId=useRef(''),pending=useRef<AbortController|null>(null),mounted=useRef(false),receipt=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current?.abort()}},[]);
 useEffect(()=>{if(sent)receipt.current?.focus()},[sent]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending.current)return;
  if(question.trim().length<inquiryMinLength){setError('اكتب سؤالك بتفصيل أكثر ليتمكن الفريق من فهمه.');input.current?.focus();return}
  const controller=new AbortController();pending.current=controller;setBusy(true);setError('');
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
   requestId.current||=newRequestId();
   const r=await fetch('/api/faq-inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId.current,question:question.trim()}),signal:controller.signal});
   const data=await r.json() as {ok?:boolean;error?:string};if(!r.ok||!data.ok)throw Error(data.error||'تعذّر إرسال السؤال الآن. حاول مجددًا.');
   if(mounted.current){setSent(true);setQuestion('');requestId.current=''}
  }catch(e){if(mounted.current)setError(e instanceof Error&&e.name!=='AbortError'?e.message:'لم نتمكن من تأكيد الإرسال. سؤالك ما زال هنا؛ حاول مجددًا.')}
  finally{clearTimeout(timeout);pending.current=null;if(mounted.current)setBusy(false)}
 }
 return <details className="bh-faq-inquiry" id="home-inquiry">
  <summary>لديك استفسار لم تجد إجابته؟<span aria-hidden="true"/></summary>
  {sent?<div className="bh-inquiry-receipt" ref={receipt} tabIndex={-1} role="status">
   <CheckCircle2 size={24} aria-hidden="true"/><strong>وصل سؤالك إلى فريق التنظيم.</strong><p>شكرًا لك، سيطّلع الفريق على استفسارك.</p>
   <button type="button" className="bh-link" onClick={()=>{setSent(false);requestAnimationFrame(()=>input.current?.focus())}}>إرسال سؤال آخر</button>
  </div>:<form className="bh-inquiry-form" onSubmit={submit} aria-busy={busy}>
   <p id={base+'-help'}>اكتب استفسارك عن الهاكاثون. يصل سؤالك إلى فريق التنظيم فقط، ولا يُنشر للزوار.</p>
   <label htmlFor={base+'-question'}>سؤالك</label>
   <textarea ref={input} id={base+'-question'} name="question" placeholder="ما الذي تودّ معرفته عن الهاكاثون؟" rows={4} required minLength={inquiryMinLength} maxLength={inquiryMaxLength} value={question} disabled={busy} aria-invalid={!!error} aria-describedby={base+'-help '+base+'-count'+(error?' '+base+'-error':'')} onChange={e=>{setQuestion(e.target.value);setError('');requestId.current=''}}/>
   {error&&<div className="bh-inquiry-error" id={base+'-error'} role="alert">{error}</div>}
   <div className="bh-inquiry-actions"><small id={base+'-count'}><bdi>{question.length.toLocaleString('ar-SA')} / {inquiryMaxLength.toLocaleString('ar-SA')}</bdi> حرف</small><button className="bh-button bh-orange" type="submit" disabled={busy||!question.trim()}><Send size={16} aria-hidden="true"/>{busy?'جارٍ الإرسال…':'إرسال السؤال'}</button></div>
  </form>}
 </details>
}
