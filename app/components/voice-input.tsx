'use client';
import {useEffect,useRef,useState} from 'react';
import {Mic,Square,X,LoaderCircle,RotateCcw} from 'lucide-react';
export default function VoiceInput({disabled,onTranscript,onBusyChange,remaining,compact=false,latinNumbers=false}:{compact?:boolean;latinNumbers?:boolean;disabled:boolean;onTranscript:(text:string)=>void;onBusyChange:(busy:boolean)=>void;remaining:number}){
 const [supported,setSupported]=useState<boolean|null>(null),[phase,setPhase]=useState<'idle'|'permission'|'recording'|'transcribing'>('idle'),[seconds,setSeconds]=useState(0),[error,setError]=useState(''),[recording,setRecording]=useState<Blob|null>(null);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),cancelled=useRef(false),mounted=useRef(true),abort=useRef<AbortController|null>(null),remainingRef=useRef(remaining),sequence=useRef(0);
 remainingRef.current=remaining;
 function release(){if(timer.current)clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}
 useEffect(()=>{mounted.current=true;setSupported(!!navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined');return()=>{mounted.current=false;cancelled.current=true;sequence.current++;if(recorder.current?.state==='recording')recorder.current.stop();release();abort.current?.abort();}},[]);
 function change(next:typeof phase){if(!mounted.current)return;setPhase(next);onBusyChange(next!=='idle');}
 async function transcribe(blob:Blob){
  if(!mounted.current)return;setRecording(blob);setError('');change('transcribing');const controller=new AbortController();abort.current=controller;
  try{const body=new FormData();body.append('audio',blob,blob.type.includes('mp4')?'recording.mp4':blob.type.includes('ogg')?'recording.ogg':'recording.webm');const r=await fetch('/api/transcribe',{method:'POST',body,signal:controller.signal});const d:any=await r.json();if(!r.ok)throw Error(d.error||'تعذّر تحويل الصوت.');if(d.text.length>remainingRef.current)throw Error('لا يتسع مربع الإجابة للنص كاملًا. اختصر الإجابة المكتوبة ثم أعد تحويل التسجيل.');if(mounted.current&&abort.current===controller){onTranscript(d.text);setRecording(null);}}
  catch(e){if(mounted.current&&abort.current===controller&&!controller.signal.aborted)setError(e instanceof Error?e.message:'تعذّر تحويل الصوت.');}
  finally{if(mounted.current&&abort.current===controller)change('idle');}
 }
 async function start(){
  if(disabled||phase!=='idle')return;setError('');setRecording(null);cancelled.current=false;const attempt=++sequence.current;change('permission');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!mounted.current||cancelled.current||attempt!==sequence.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;const type=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   if(!type)throw Error('صيغة التسجيل في هذا المتصفح غير مدعومة. استخدم متصفحًا أحدث أو تابع بالكتابة.');
   const rec=new MediaRecorder(media,{mimeType:type});recorder.current=rec;const chunks:BlobPart[]=[];let size=0;
   rec.ondataavailable=e=>{if(e.data.size){size+=e.data.size;chunks.push(e.data);if(size>3.5*1024*1024){cancelled.current=true;if(rec.state==='recording')rec.stop();setError('التسجيل كبير. جرّب مقطعًا أقصر.');}}};
   rec.onerror=()=>{if(attempt!==sequence.current)return;cancelled.current=true;release();change('idle');setError('تعذّر التسجيل. تحقق من الميكروفون وحاول مجددًا.');};
   rec.onstop=()=>{if(attempt!==sequence.current||recorder.current!==rec)return;release();if(cancelled.current||!mounted.current){change('idle');return;}const blob=new Blob(chunks,{type:rec.mimeType});if(!blob.size){setError('التسجيل فارغ. حاول مجددًا.');change('idle');return;}void transcribe(blob);};
   rec.start(1000);setSeconds(0);change('recording');let elapsed=0;timer.current=setInterval(()=>{elapsed++;setSeconds(elapsed);if(elapsed>=90&&rec.state==='recording')rec.stop();},1000);
  }catch(e){if(attempt!==sequence.current)return;release();change('idle');if(mounted.current)setError(e instanceof DOMException&&e.name==='NotAllowedError'?'لم يُسمح باستخدام الميكروفون. فعّله من إعدادات المتصفح أو تابع بالكتابة.':e instanceof Error?e.message:'تعذّر تشغيل الميكروفون.');}
 }
 function cancel(){cancelled.current=true;sequence.current++;if(recorder.current?.state==='recording')recorder.current.stop();release();abort.current?.abort();abort.current=null;setRecording(null);setError('');change('idle');}
 return <div className={'voice-input '+(compact?'compact':'')}><div className="voice-actions">{phase==='recording'?<><span className="recording-time" role="status"><i/>{latinNumbers?seconds:seconds.toLocaleString('ar-SA')} / {latinNumbers?'90':'٩٠'} ثانية</span><button type="button" className="button ghost small" onClick={()=>recorder.current?.stop()}><Square size={14}/> إيقاف وتحويل إلى نص</button><button type="button" className="icon-button" onClick={cancel} aria-label="إلغاء التسجيل"><X size={17}/></button></>:phase==='transcribing'||phase==='permission'?<><span role="status"><LoaderCircle className="spin" size={16}/> {phase==='permission'?'بانتظار السماح بالميكروفون…':'نحوّل كلامك إلى نص…'}</span><button type="button" className="text-link" onClick={cancel}>إلغاء</button></>:<><button type="button" className="button ghost small" onClick={start} disabled={disabled||supported!==true||remaining<1}><Mic size={17}/> تحدث بصوتك</button>{recording&&<button type="button" className="text-link" disabled={disabled} onClick={()=>transcribe(recording)}><RotateCcw size={15}/> إعادة تحويل التسجيل</button>}</>}</div>{supported===false?<p className="fine muted">التسجيل غير مدعوم في هذا المتصفح. يمكنك استخدام إملاء لوحة المفاتيح أو الكتابة.</p>:!compact&&<p className="fine muted">حتى ٩٠ ثانية، ثم يُحوّل التسجيل إلى نص عبر OpenAI. راجع النص قبل إرسال إجابتك؛ لا نحفظ التسجيل في المنصة.</p>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}
