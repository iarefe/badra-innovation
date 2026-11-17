import {chatFields,chatDraftSchema,chatResultSchema,emptyChatDraft,missingFields,interviewFieldMinimums,type ChatDraft} from './ai-challenge';
import {completionGreeting,completionKeys,mergeCompletionDraft,nextCompletionQuestion} from './challenge-completion';
import {interviewStateSchema,type InterviewState} from './interview-state';
import {challengeSchema,type Challenge,type Entry} from './challenges';
import {assistantDisplay,challengeChatView,displayValue,fieldOptions,questionParts} from './challenge-chat-view';
import {requestsReview} from './chat-handoff';
import {controlTurn,recoverMetadata,remainingTurn,wasStalled,readCadence,asksForGaps} from './chat-recovery';
export type ChatMessage={role:'user'|'assistant';content:string;field?:keyof ChatDraft;question?:string;source?:'field-edit'};
export type ChatEdit={kind:'field'|'answer';field?:keyof ChatDraft;index?:number;question:string;previousText:string};
export type SessionOptions={participantKey:string;completion?:Entry;initialDraft?:Challenge};
export const chatSessionKey=(actor:string,id?:string)=>id?'badra-ai-completion:'+actor+':'+id:'badra-ai-interview:'+actor;
const greeting='أهلًا، أنا بذرة. ما تحتاج تجي بحلّ جاهز؛ نبدأ من موقف عشته.\n\nتذكّر آخر مرة تعطّل فيها عملك أو واجهت جهة مستفيدة صعوبة: ماذا حدث؟';
export type ChatSnapshot={interview?:InterviewState;editing?:ChatEdit;lastAction?:'answer'|'edit';messages:ChatMessage[];draft:ChatDraft;text:string;pending:string;busy:boolean;error:string;ready:boolean;reviewRequested:boolean;available:boolean|null;restored:boolean;resumed:boolean;saveFailed:boolean;replyVersion:number;updatedKeys:(keyof ChatDraft)[]};
type Runtime={storage:()=>Storage|null;fetch:typeof fetch};
const runtime:Runtime={storage:()=>{try{return typeof window==='undefined'?null:window.sessionStorage}catch{return null}},fetch:(...args)=>fetch(...args)};
/** One request and one draft per conversation, independent of its current presentation. */
export class ChatSession{
 readonly key:string;readonly actor:string;
 private baseline:string;private initialDraft:ChatDraft;private initialGreeting:string;
 private listeners=new Set<()=>void>();private initialized=false;private disposed=false;
 private reviewHandled=false;
 private request:AbortController|null=null;private availability:AbortController|null=null;
 private highlight:ReturnType<typeof setTimeout>|null=null;private state:ChatSnapshot;
 constructor(private options:SessionOptions,private io:Runtime=runtime){
  this.actor=options.participantKey;this.key=chatSessionKey(this.actor,options.completion?.id);
  this.baseline=options.completion?JSON.stringify(options.completion.challenge):'';
  this.initialDraft={...emptyChatDraft,author:'صاحب التحدي',...(options.initialDraft||options.completion?.challenge)};
  this.initialGreeting=options.completion?completionGreeting(this.initialDraft as Challenge):greeting;
  this.state={messages:[{role:'assistant',content:this.initialGreeting}],draft:this.initialDraft,text:'',pending:'',busy:false,error:'',ready:false,reviewRequested:false,available:null,restored:false,resumed:false,saveFailed:false,replyVersion:0,updatedKeys:[]};
 }
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
 private emit(patch:Partial<ChatSnapshot>,save=true){
  if(this.disposed)return;this.state={...this.state,...patch};
  if(save&&this.state.restored){try{const storage=this.io.storage();if(!storage)throw Error();const {messages,draft,ready,text,interview,reviewRequested,editing}=this.state;storage.setItem(this.key,JSON.stringify({messages:messages.slice(-36),draft,ready,text,interview,reviewRequested,editing,baseline:this.baseline,reviewHandled:this.reviewHandled}));this.state.saveFailed=false}catch{this.state.saveFailed=true}}
  this.listeners.forEach(listener=>listener());
 }
 initialize(){
  if(this.initialized||this.disposed)return;this.initialized=true;
  try{const data=JSON.parse(this.io.storage()?.getItem(this.key)||'null');const parsed=chatDraftSchema.safeParse({...emptyChatDraft,...data?.draft});
   if(data&&(!this.options.completion||data.baseline===this.baseline)&&parsed.success&&Array.isArray(data.messages)&&data.messages.length>0&&data.messages.length<=40&&data.messages.every((m:ChatMessage)=>['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=4000)){
    const saved=interviewStateSchema.safeParse(data.interview);
    const interview=saved.success?saved.data:undefined,text=typeof data.text==='string'?data.text.slice(0,4000):'';
    this.reviewHandled=data.reviewHandled===true;
    // Recover a saved conversation stuck after the participant already said they were done.
    const lastUser=data.messages.findLastIndex((m:ChatMessage)=>m.role==='user');
    const messages:ChatMessage[]=data.messages.map((m:ChatMessage)=>({role:m.role,content:m.content,...(m.field&&Object.hasOwn(chatFields,m.field)?{field:m.field}:{}),...(typeof m.question==='string'&&m.question.length<=4000?{question:m.question}:{}),...(m.source==='field-edit'?{source:m.source}:{})}));
    const edit=data.editing;
    const editing:ChatEdit|undefined=edit&&['field','answer'].includes(edit.kind)&&typeof edit.question==='string'&&edit.question.length<=4000&&typeof edit.previousText==='string'&&edit.previousText.length<=4000&&(edit.kind==='field'?Object.hasOwn(chatFields,edit.field)&&edit.field!=='author':Number.isInteger(edit.index)&&data.messages[edit.index]?.role==='user')?{kind:edit.kind,question:edit.question,previousText:edit.previousText,...(edit.field&&Object.hasOwn(chatFields,edit.field)?{field:edit.field}:{}),...(edit.kind==='answer'?{index:edit.index}:{})}:undefined;
    const reviewRequested=!editing&&!this.reviewHandled&&!text.trim()&&(data.reviewRequested===true||lastUser>=0&&requestsReview(data.messages.slice(0,lastUser+1),lastUser===data.messages.length-1?interview:undefined));
    const stalled=wasStalled(messages,interview)||!!(lastUser>=0&&asksForGaps(messages[lastUser].content)&&!this.reviewHandled);
    const draft=stalled?recoverMetadata(parsed.data,messages,this.options.completion?.challenge):parsed.data;
    const recovered=stalled||reviewRequested?remainingTurn(draft,interview):undefined;
    this.emit({interview:recovered?.interview||interview,editing,messages,draft,ready:(!!data.ready||reviewRequested||!!recovered?.ready)&&!missingFields(draft).length,reviewRequested,text,resumed:data.messages.some((m:ChatMessage)=>m.role==='user')||!!text},false);
   }
  }catch{}
  this.emit({restored:true});void this.checkAvailability();
 }
 checkAvailability=async()=>{
  if(this.disposed||this.availability)return;
  const request=new AbortController();this.availability=request;this.emit({available:null},false);
  try{const response=await this.io.fetch('/api/chat',{cache:'no-store',signal:request.signal});if(!response.ok)throw Error();const data=await response.json() as {available?:boolean};if(!request.signal.aborted)this.emit({available:data.available===true},false)}catch{if(!request.signal.aborted)this.emit({available:false},false)}finally{if(this.availability===request)this.availability=null}
 };
 setText=(value:string|((previous:string)=>string))=>{if(!this.state.busy)this.emit({text:(typeof value==='function'?value(this.state.text):value).slice(0,4000)})};
 dismissResumed=()=>this.emit({resumed:false},false);
 canEditField=(field:keyof ChatDraft)=>field!=='author'&&(!this.options.completion||completionKeys(this.options.completion.challenge,this.state.draft).has(field));
 showRemaining=()=>{
  if(this.state.busy||this.state.editing)return;
  const s=this.state,draft=recoverMetadata(s.draft,s.messages,this.options.completion?.challenge),result=remainingTurn(draft,s.interview);
  this.reviewHandled=true;
  this.emit({draft,interview:result.interview,ready:result.ready,reviewRequested:false,error:'',resumed:false,replyVersion:s.replyVersion+1});
 };
 beginFieldEdit=(field:keyof ChatDraft)=>{
  if(this.state.busy||!this.canEditField(field)||!this.state.draft[field]?.trim()&&!missingFields(this.state.draft).includes(field))return false;
  const m=this.state.messages.findLast(x=>x.role==='user'&&x.field===field);
  this.emit({editing:{kind:'field',field,question:this.state.draft[field]?.trim()&&m?.question||assistantDisplay.fieldHelp[field as keyof typeof assistantDisplay.fieldHelp]?.hint||chatFields[field],previousText:this.state.editing?.previousText??this.state.text},text:displayValue(field,this.state.draft[field]),error:'',reviewRequested:false});return true;
 };
 beginAnswerEdit=(index:number)=>{
  const m=this.state.messages[index];if(this.state.busy||m?.role!=='user')return false;
  const question=m.question||questionParts(this.state.messages.slice(0,index).findLast(x=>x.role==='assistant')?.content||'').question;
  this.emit({editing:{kind:'answer',index,field:m.field,question,previousText:this.state.editing?.previousText??this.state.text},text:m.content,error:'',reviewRequested:false});return true;
 };
 cancelEdit=()=>{if(!this.state.busy&&this.state.editing)this.emit({text:this.state.editing.previousText,editing:undefined,error:''})};
 clearError=()=>{if(this.state.error)this.emit({error:''},false)};
 consumeReviewRequest=()=>{if(!this.state.reviewRequested||this.state.busy)return false;this.reviewHandled=true;this.emit({reviewRequested:false});return true};
 replaceDraft=(draft:Challenge)=>{
  if(this.state.busy||this.disposed)return false;
  this.initialize();
  const parsed=chatDraftSchema.safeParse({...emptyChatDraft,...draft});if(!parsed.success)return false;
  const changed=JSON.stringify(this.state.draft)!==JSON.stringify(parsed.data);
  this.reviewHandled=true;
  this.emit({draft:parsed.data,reviewRequested:false,interview:changed?undefined:this.state.interview,ready:missingFields(parsed.data).length===0,messages:changed?[...this.state.messages,{role:'assistant' as const,content:'حُدّث ملخصك من شاشة المراجعة.\n\n'+nextCompletionQuestion(draft)}].slice(-36):this.state.messages});return true;
 };
 restart=()=>{if(!this.state.busy){this.reviewHandled=false;this.emit({interview:undefined,editing:undefined,lastAction:undefined,messages:[{role:'assistant',content:this.initialGreeting}],draft:this.initialDraft,text:'',pending:'',ready:false,reviewRequested:false,error:'',resumed:false,updatedKeys:[],replyVersion:0})}};
 send=async()=>{
  const current=this.state;if(this.disposed||current.busy||!current.text.trim())return;
  const edit=current.editing,sent=current.text.trim();
  if(edit?.kind==='field'&&edit.field){
   const key=edit.field;if(!this.canEditField(key))return;
   const value=fieldOptions(key).find(x=>x.label===sent||x.value===sent)?.value??(key==='frequency'?readCadence(sent,true):undefined)??sent;
   const parsed=challengeSchema.shape[key].safeParse(value),candidate={...current.draft,[key]:value};
   if(!parsed.success||missingFields(candidate).includes(key)){
    const issue=!parsed.success?parsed.error.issues[0]:null;
    const minimum=issue?.code==='too_small'?issue.minimum:interviewFieldMinimums[key as keyof typeof interviewFieldMinimums];
    this.emit({error:issue?.code==='too_big'?`${chatFields[key]}: الحد الأقصى ${issue.maximum} حرف.`:minimum?`${chatFields[key]}: الحد الأدنى لعدد الأحرف هو ${minimum}.`:fieldOptions(key).length?`راجع خانة «${chatFields[key]}»: اختر إحدى الإجابات المعروضة.`:assistantDisplay.feedback.invalidField},false);return;
   }
   if(key==='ownership'&&value==='individual')candidate.coOwners='';
   if(key==='initialSolutionStatus'&&value==='none'){candidate.initialSolution='';candidate.initialSolutionOutcome=''}
   const draft=this.options.completion?chatDraftSchema.parse(mergeCompletionDraft(this.options.completion.challenge,candidate)):candidate;
   const updatedKeys=(Object.keys(draft) as (keyof ChatDraft)[]).filter(k=>draft[k]!==current.draft[k]);
   const messages=[...current.messages],index=messages.findLastIndex(m=>m.role==='user'&&m.field===key&&m.source==='field-edit');
   const message:ChatMessage={role:'user',content:displayValue(key,value),field:key,question:edit.question,source:'field-edit'};
   if(index>=0)messages[index]=message;else messages.splice(Math.max(0,messages.length-1),0,message);
   const focus=current.interview?.asked.at(-1),recovering=focus==='pause'||focus==='review';
   const result=recovering?remainingTurn(draft,current.interview):undefined;
   this.emit({draft,messages:messages.slice(-36),lastAction:'edit',editing:undefined,text:edit.previousText,error:'',interview:result?.interview??current.interview,ready:result?.ready??(current.ready&&!missingFields(draft).length),updatedKeys,replyVersion:current.replyVersion+1});
   if(this.highlight)clearTimeout(this.highlight);this.highlight=setTimeout(()=>this.emit({updatedKeys:[]},false),3200);return;
  }
  const field=challengeChatView(current.draft,current.ready,current.interview?.asked.at(-1),current.messages,!!this.options.completion).current;
  const next:ChatMessage[]=edit?current.messages.map((m,i)=>i===edit.index?{...m,content:sent}:m):[...current.messages,{role:'user',content:sent,field,question:questionParts(current.messages.findLast(m=>m.role==='assistant')?.content||'').question}];
  const direct=!edit?controlTurn({draft:current.draft,messages:next,interview:current.interview,existing:this.options.completion?.challenge}):undefined;
  if(direct){
   const result=direct;this.reviewHandled=false;
   this.emit({draft:result.draft,interview:result.interview,ready:result.ready,reviewRequested:result.reviewRequested,messages:[...next,{role:'assistant' as const,content:result.message}].slice(-36),text:'',error:'',resumed:false,updatedKeys:[],replyVersion:current.replyVersion+1});return;
  }
  if(current.available!==true){this.emit({error:'تعذّر الاتصال بالمساعد. إجابتك باقية في الحقل. يمكنك عرض الخانات المتبقية وإكمالها مباشرة.'},false);return;}
  // Reuse the same extraction endpoint for a transcript correction. Its follow-up
  // question is not adopted: the participant returns to the unchanged current turn.
  const history=(edit?[...next,{role:'assistant' as const,content:edit.question},{role:'user' as const,content:sent}]:next).slice(-36).map(({role,content})=>({role,content}));while(history.length>1&&JSON.stringify({messages:history,draft:current.draft,interview:current.interview}).length>37000)history.shift();
  const request=new AbortController();this.request=request;const timeout=setTimeout(()=>request.abort(),55000);
  this.emit({pending:sent,busy:true,error:''},false);
  try{
   const response=await this.io.fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,draft:current.draft,interview:current.interview,...(this.options.completion?{completionId:this.options.completion.id}:{})}),signal:request.signal});
   const data:any=await response.json();if(!response.ok)throw Error(data.error||'تعذّر الاتصال بالمساعد.');const parsed=chatResultSchema.safeParse(data);if(!parsed.success)throw Error('لم يكتمل الرد بصورة صحيحة. أعد المحاولة.');
   if(this.disposed||request.signal.aborted)return;const result=parsed.data;
   if(!edit)this.reviewHandled=false;
   const editedInterview=edit&&current.interview&&result.interview?{...current.interview,signals:result.interview.signals}:current.interview;
   this.emit({interview:edit?editedInterview:result.interview,lastAction:edit?'edit':'answer',editing:undefined,reviewRequested:edit?false:result.reviewRequested===true,updatedKeys:(Object.keys(result.draft) as (keyof ChatDraft)[]).filter(k=>result.draft[k].trim()&&result.draft[k]!==current.draft[k]),replyVersion:current.replyVersion+1,messages:edit?next:[...next,{role:'assistant',content:result.message}].slice(-36) as ChatMessage[],draft:result.draft,ready:(edit?current.ready:result.ready)&&!missingFields(result.draft).length,text:edit?edit.previousText:'',resumed:false});
   if(this.highlight)clearTimeout(this.highlight);this.highlight=setTimeout(()=>this.emit({updatedKeys:[]},false),3200);
  }catch(error){this.emit({error:error instanceof Error&&error.name==='AbortError'?'تأخر الرد أكثر من المعتاد. إجابتك محفوظة؛ جرّب إرسالها مجددًا.':error instanceof Error?error.message:'تعذّر الاتصال بالمساعد.'},false)}
  finally{clearTimeout(timeout);if(this.request===request)this.request=null;this.emit({pending:'',busy:false},false)}
 };
 dispose(remove=false){this.disposed=true;this.request?.abort();this.availability?.abort();if(this.highlight)clearTimeout(this.highlight);this.listeners.clear();if(remove)try{this.io.storage()?.removeItem(this.key)}catch{}}
}
export class ChatSessionRegistry{
 private sessions=new Map<string,ChatSession>();
 constructor(private io:Runtime=runtime){}
 get(options:SessionOptions){const key=chatSessionKey(options.participantKey,options.completion?.id);let session=this.sessions.get(key);if(!session){session=new ChatSession(options,this.io);this.sessions.set(key,session)}return session}
 remove(actor:string,id?:string){const key=chatSessionKey(actor,id);this.sessions.get(key)?.dispose(true);this.sessions.delete(key);try{this.io.storage()?.removeItem(key)}catch{}}
 clearActor(actor:string){
  for(const [key,session] of this.sessions){if(session.actor===actor){session.dispose(true);this.sessions.delete(key)}}
  try{const storage=this.io.storage();if(storage)for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key&&(key===chatSessionKey(actor)||key.startsWith('badra-ai-completion:'+actor+':')))storage.removeItem(key)}}catch{}
 }
 dispose(){this.sessions.forEach(session=>session.dispose());this.sessions.clear()}
}
