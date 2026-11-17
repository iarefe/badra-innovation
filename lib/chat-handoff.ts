import {chatFields,missingFields,type ChatDraft} from './ai-challenge';
import type {InterviewState} from './interview-state';

type Message={role:'user'|'assistant';content:string};
function normalize(text:string){
 return text.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
// Identify the conversational action, regardless of which topic the model assigns it.
// A concrete question about an approval/review process at work is not a handoff.
export function isReviewInvitation(message:string){
 const question=message.trim().split(/\n+/).at(-1)||'';
 const text=normalize(question);
 return /(?:هل (?:تريد|تود|ترغب|تحب|ننتقل|نراجع|نبدا|انت|يمكننا|لديك|عندك|هناك)|تحب |تود |تبغي |ننتقل |جاهز)/.test(text)
  &&/(?:مراجع[ةه] (?:البطاق[ةه]|المسود[ةه]|التحدي|ما جمعناه)|نراجع (?:البطاق[ةه]|المسود[ةه])|للمراجع[ةه]|(?:تريد|تود|تحب|ترغب|الانتقال|ننتقل|تنتقل) (?:الي |في )?المراجع[ةه]|(?:تفاصيل|اضافات|اضاف[ةه]|تعديلات) (?:اخري|اضافي[ةه])|تضيف (?:شيئا|شيء|شي|اي شيء)|قبل (?:المراجع[ةه]|النشر))/.test(text);
}

/** Only a short, explicit control reply can bypass another AI request.
 * Compound answers/corrections still go through extraction; "انتهيت من الزيارة" is data.
 */
export function requestsReview(messages:Message[],interview?:InterviewState){
 const last=messages.at(-1);if(last?.role!=='user')return false;
 const text=normalize(last.content);if(!text||text.length>160)return false;
 if(/^(?:خلاص|كفاي[ةه]|انتهي|انتهينا|تم الانتهاء|المعلومات كامل[ةه]|هذا كل شيء)(?: شكرا)?$/.test(text))return true;
 const plain=text.replace(/^(?:(?:نعم|اي|ايوه|اجل|تمام|طيب|حسنا|خلاص|شكرا|شكرا لك)\s+)+/,'').replace(/^لا (?=انتهيت|خلصت|انتهينا|خلصنا)/,'').replace(/^(?:انا|لقد) /,'').replace(/(?:\s+(?:شكرا|شكرا لك|يعطيك العافية|لو سمحت|من فضلك))+$/,'');
 if(/^(?:انتهيت|انتهينا|خلصت|خلصنا)(?: (?:الان|من (?:الاجابات|الاجابه|الاجابة|الكتابه|الكتابة|التحدي|وصف التحدي|كتابة التحدي)|من كل شيء))?$/.test(plain))return true;
 if(/^(?:اكتفي|نكتفي|يكفي|كفاي[ةه]|هذا كل (?:شيء|شي|ما عندي)|(?:ما|ليس) (?:عندي|لدي) (?:اي )?(?:اضاف[ةه]|اضافات|شيء اخر|شي ثاني|شي اضافي)|لا (?:يوجد|توجد) (?:(?:لدي|عندي|لدينا) )?(?:اي )?(?:اضاف[ةه]|اضافات|تفاصيل اخري)|بدون (?:اضاف[ةه]|اضافات)|جاهز(?:[ةه])? للمراجع[ةه])$/.test(plain))return true;
 if(/^(?:(?:اريد|ابغي|ابغى|ابي|اود|خلنا|دعنا) )?(?:اراجع|نراجع|راجع|مراجع[ةه]) (?:البطاق[ةه]|المسود[ةه]|التحدي)(?: الان)?$/.test(plain))return true;
 if(/^(?:انتقل|ننتقل|خلنا ننتقل|ودني|خذني|ابدا)(?: الي)? (?:المراجع[ةه]|مراجع[ةه] (?:البطاق[ةه]|المسود[ةه]))$/.test(plain))return true;
 const previous=messages.slice(0,-1).findLast(m=>m.role==='assistant');
 const offered=interview?.asked.at(-1)==='review'||!!previous&&isReviewInvitation(previous.content);
 if(previous&&/(?:اضاف[ةه]|اضافات|تفاصيل (?:اخري|اضافي[ةه])|شيئا اخر|شيء اخر)/.test(normalize(previous.content))&&/^(?:لا|لا شكرا|لا يوجد|لا توجد)$/.test(text)&&isReviewInvitation(previous.content))return true;
 return offered&&/^(?:نعم|اي|اي نعم|ايوه|اجل|تمام|طيب|موافق|حسنا|خلاص|تم|اكيد|يلا|جاهز)(?: شكرا)?$/.test(text);
}

export function reviewHandoff(draft:ChatDraft,interview?:InterviewState,completion=false){
 const missing=missingFields(draft);
 return {
  message:missing.length?'المتبقي قبل مراجعة بطاقتك: '+missing.map(k=>chatFields[k as keyof ChatDraft]).join('، ')+'. يمكنك إكمال هذه الخانات مباشرة.':completion?'إضافاتك جاهزة للمراجعة. راجعها ثم اختر حفظ الإضافات.':'وصفك جاهز للمراجعة. راجع البطاقة ثم اختر النشر بنفسك.',
  draft,ready:!missing.length,reviewRequested:true,missing:missing.map(k=>chatFields[k as keyof ChatDraft]),
  interview:{version:1 as const,signals:interview?.signals||[],asked:[...(interview?.asked||[]),'review' as const].slice(-18)}
 };
}
