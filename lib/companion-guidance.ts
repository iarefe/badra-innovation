import {engagementFocus} from './hackathon-intake';
import type {Entry,Viewer,Workshop} from './challenges';
import {canSupplement,challengeGaps} from './challenge-completion';

export type GuideStep={id:string;target:string;title:string;text:string};
export type GuideContext={route:string;viewer:Viewer;entries:Entry[];workshop:Workshop|null;loading:boolean};
const anchor=(name:string)=>`[data-badra-anchor="${name}"]`;
const step=(id:string,target:string,title:string,text:string):GuideStep=>({id,target,title,text});
/** Ordered, opt-in page tours. Steps only explain; they never perform a participant action. */
function openTour({route,viewer,entries,workshop,loading}:GuideContext):GuideStep[]{
 if(loading||['admin','archive','not-found'].includes(route))return [];
 const registration=[
  step('register:phone',anchor('login-phone'),'ابدأ بجوالك','أدخل رقمك ليصلك رمز التحقق. يُحفظ دخولك على هذا الجهاز بعد إكمال التسجيل.'),
  step('register:department',anchor('profile-department'),'عرّف زملاءك بإدارتك','اكتب اسم الإدارة التي تعمل بها. ستظهر تحت اسمك في صفحة تحدّيك.'),
  step('register:roles','.role-picker legend','لك أكثر من دور','اختر ما تستطيع تقديمه للفريق. يمكنك الجمع بين الأدوار وتعديلها لاحقًا.')
 ];
 if(route==='login'||(['account','new'].includes(route)||route.startsWith('complete/'))&&(!viewer.employee||viewer.needsProfile))return registration;
 if(route==='account')return [step('account:roles',anchor('edit-roles'),'مهاراتك تساعد فريقك','حدّث أدوارك هنا؛ يطّلع عليها المدير عند توزيع المشاركين على الفرق.'),step('account:participate',anchor('account-participate'),'حان دور مشاركتك','ابدأ بتحدٍ من واقع عملك، أو استكشف التحديات التي طرحها زملاؤك.')];
 if(route==='new'||route.startsWith('complete/'))return [
  step('write:progress',anchor('challenge-progress'),'تابع اكتمال بطاقتك','كل إجابة تكمل بطاقتك. بعدها تراجعها قبل الإرسال.'),
  step('write:input',anchor('challenge-write'),'اكتب إجابتك هنا','اكتب إجابتك ثم اضغط «إرسال»، أو استخدم «تحدث بصوتك» وراجع النص.'),
  step('write:start',anchor('manual-challenge-start'),'احكِ موقفًا واحدًا','صف ما يحدث ومن يتأثر به. لا تحتاج إلى حل جاهز لتبدأ.'),
  step('write:scope',anchor('challenge-scope'),'لمن سيظهر المشروع؟','النطاق يصف جمهور المشروع: داخل المؤسسة أو خارجها أو كليهما.'),
  step('write:partners',anchor('challenge-partners'),'التحدي قد يكون مشتركًا','وثّق زملاءك وما سبق أن جرّبتموه، ليعرف الفريق ما يمكن البناء عليه.'),
  step('write:review',anchor('review-challenge'),'راجعها بعين صاحب التحدي','تأكد من الصياغة والأثر وأسماء الشركاء قبل إرسال البطاقة.')
 ];
 const incomplete=entries.some(e=>e.mine&&!e.example&&e.status!=='pending'&&challengeGaps(e.challenge).length&&(e.status!=='published'||canSupplement(e.challenge)));
 const completion=viewer.employee&&incomplete&&!workshop?.finalized?[step('participate:complete',anchor('complete-challenge'),'بقيت تفاصيل تُظهر أهمية تحدّيك','استكمل الناقص من هنا؛ وصف الأشخاص المتأثرين والأثر يساعد زملاءك على فهمه.')]:[];
 const selected=entries.find(e=>route==='challenge/'+e.id);
 const hasPublished=entries.some(e=>!e.example&&e.status==='published');
 if(selected){
  if(selected.example)return [step('challenge:example',anchor('challenge-title'),'هذا مثال تستلهم منه','تعرّف على طريقة وصف التحدي وأثره. المثال لا يدخل في التصويت أو تكوين الفرق.')];
  if(selected.status!=='published')return completion;
  return [
   step('challenge:read',anchor('challenge-title'),'افهم التحدي أولًا','اقرأ الموقف والأثر والشواهد؛ بعدها قرّر إن كان أولوية للمؤسسة.'),
   step('challenge:evidence',anchor('challenge-evidence'),'هنا تتضح أهمية التحدي','الأثر والشواهد يساعدانك على تقييم الأولوية وفهم ما يستحق المعالجة.'),
   ...(!selected.mine&&workshop?.open&&!selected.voted?[step('challenge:vote','[data-companion-target="vote"]','صوتك يحدد الأولوية',viewer.employee?'إذا رأيت التحدي أولوية، صوّت له من هذا الزر. يمكنك التصويت لأكثر من تحدٍ.':'هذا زر التصويت. ستسجّل دخولك أولًا، ثم تختار التحديات التي تراها أولوية.')]:[]),
   ...(!selected.mine&&!selected.interested?[step('challenge:join','[data-companion-target="interest"]',selected.voted?'صوتك مسجّل. وتقدر تشارك بمهاراتك':'تود العمل على هذا التحدي؟','سجّل رغبتك بالانضمام هنا. هذه رغبة في المشاركة، ولا تضيف صوتًا للترشيح.')]:[]),
   ...completion
  ];
 }
 if(route==='mine')return [...completion,step('mine:status',anchor('challenge-status'),'تابع الخطوة التالية','تظهر هنا مسوداتك وتحدياتك المنشورة، مع تنبيه إلى التفاصيل التي يمكنك استكمالها.'),step('participate:create',anchor('participate'),'ملاحظتك بداية التغيير','أضف تحديًا من واقع عملك. يمكنك طرحه بمفردك أو مع زملائك.')];
 if(route==='wall'&&!hasPublished)return [
  step('library:examples',anchor('example-open'),'ابدأ بمثال قريب من عملك','هذه أمثلة للاستلهام. افتح البطاقة لتتعرف على وصف المشكلة وأثرها، ثم أضف تحديك من واقعك. الأمثلة لا تدخل في التصويت أو الانضمام.'),
  step('participate:create',anchor('participate'),'ملاحظتك هي البداية','اختر موقفًا يتكرر في عملك أو في خدمة الجهات المستفيدة، وصف التحدي الذي يستحق التحسين.')
 ];
 if(route==='wall')return [
  step('library:read',anchor('challenge-open'),'من هنا تقرأ التحدي كاملًا','افتح «عرض التحدي» لتعرف الموقف وأثره وما جُرّب لمعالجته. ويمكنك أيضًا فتحه من الصورة أو العنوان.'),
  ...(entries.some(e=>e.example)?[step('library:examples',anchor('example-open'),'وهنا أمثلة للاستلهام','هذه البطاقات تساعدك على وصف تحديك، ولا تقبل التصويت أو الانضمام.')]:[]),
  ...(workshop?.open&&entries.some(e=>!e.example&&e.status==='published'&&!e.mine&&!e.voted)?[step('library:vote',anchor('library-vote')+':not([aria-pressed="true"])','أي تحدٍ يستحق الأولوية؟','اضغط زر التصويت للتحدي الذي تراه مهمًا. لك صوت واحد لكل تحدٍ، ويمكنك التصويت لأكثر من تحدٍ.')]:[]),
  ...(entries.some(e=>!e.example&&e.status==='published'&&!e.mine&&!e.interested)?[step('library:join',anchor('library-join')+':not([aria-pressed="true"])','تحب تشتغل مع فريق هذا التحدي؟','اضغط «أرغب بالانضمام» لتسجيل رغبتك وأدوارك لدى المدير. الانضمام مستقل عن التصويت.')]:[]),
  step('participate:create',anchor('participate'),'لديك تحدٍ آخر؟','اطرح ما تتمنى تغييره في عملك أو في تجربة المستفيدين. لا يشترط أن تعرف الحل.')
 ];
 return [
  step('home:welcome',anchor('participate'),'أهلًا بك، أنا بذرة 🌱',viewer.employee?'عندك تحدٍ من واقع عملك؟ من «اطرح تحدّيك» تبدأ وصفه معي، خطوة بخطوة. تنقّل في الجولة بـ«التالي» و«السابق»، وأنهِها متى أحببت.':'عندك تحدٍ من واقع عملك؟ ابدأ من «اطرح تحدّيك»، وسجّل دخولك بجوالك. تنقّل في الجولة بـ«التالي» و«السابق»، وأنهِها متى أحببت.'),
  step('home:roles','#bh-role-guide-title','لك دور في الفريق','لا تحتاج إلى خبرة برمجية لتشارك. تعرّف على الأدوار، واختر ما تستطيع تقديمه عند التسجيل، ويمكنك تعديله من حسابك.'),
  step('home:journey',anchor('journey'),'هذه محطات مشاركتك','لاحظ تاريخ كل مرحلة: تطرح تحدّيك وتصوّت وتسجّل رغبتك، ثم تُحسم الترشيحات، وتبتكر وتبني وتعرض مع فريقك.'),
  step('home:program',anchor('home-program'),'جهّز نفسك ليومي الهاكاثون','افتح برنامج كل يوم لتعرف الأنشطة ومواعيد التسليم وما ستقدّمه مع فريقك.'),
  step('home:evaluation',anchor('evaluation'),'اعرف كيف يُقيَّم حلّك','هذه معايير تقييم الحلول النهائية. تصويت الحضور في الختام مستقل عن تصويت اختيار التحديات.'),
  step('home:explore','#bh-challenges-title',hasPublished?'اكتشف تحديات زملائك':'تجد هنا ما يلهم مشاركتك',hasPublished?'افتح بطاقة التحدي لفهمه. صوّت لما تراه أولوية، وسجّل رغبتك في التحدي الذي تودّ العمل على حلّه؛ ويمكنك الجمع بينهما.':'استعرض أمثلة من العمل التشغيلي، واستفد منها في وصف تحديك. الأمثلة للقراءة فقط، وتظهر التحديات الحقيقية هنا عند نشرها.'),
  ...(workshop?.open&&entries.some(e=>!e.example&&e.status==='published'&&!e.mine&&!e.voted)?[step('home:vote',anchor('home-vote')+':not([aria-pressed="true"])','صوتك يحدد الأولوية','من هذا الزر تصوّت للتحدي الذي تراه أولوية. التصويت مستقل عن رغبتك في العمل على التحدي، ويمكنك سحب صوتك لاحقًا.')]:[]),
  ...(entries.some(e=>!e.example&&e.status==='published'&&!e.mine&&!e.interested)?[step('home:join',anchor('home-join')+':not([aria-pressed="true"])','شارك بمهاراتك','سجّل رغبتك بالانضمام من هنا. يطّلع المنظمون على رغبتك وأدوارك لتوزيع الفرق لاحقًا. تسجيل الرغبة لا يضيف صوتًا.')]:[]),
  step('home:faq','#bh-faq-title','إجابات قبل أن تبدأ','افتح السؤال الذي يشغلك لتتعرف على المشاركة والتصويت وتسجيل الرغبة والأدوات المتاحة.'),
  step('home:participate','#bh-invite-title','اختر بداية مشاركتك','اطرح تحدّيك أو اختر تحديًا تودّ العمل عليه. انتهت جولتنا؛ تستطيع العودة إليها من زر «جولة مع بذرة» متى احتجت.')
 ];
}

export function getCompanionSteps(ctx:GuideContext):GuideStep[]{
 if(!ctx.loading&&ctx.route==='home'&&ctx.workshop?.announced?.length)return [
  step('home:finalists','#bh-results-title','من التحدي إلى الحل','تعمل الفرق الآن على التحديات المتأهلة من واقع المؤسسة.'),
  step('home:workspace',anchor('finalist-workspace'),ctx.viewer.manager?'جاهزية الفرق':ctx.viewer.judge?'بطاقات التقييم':ctx.viewer.teamMember?'مساحة فريقك':'استكشف التحديات المتأهلة',ctx.viewer.manager?'استعرض تسليمات الفرق وما ينقصها من لوحة الإدارة.':ctx.viewer.judge?'من هنا تفتح بطاقة التقييم الخاصة بك لكل فريق.':ctx.viewer.teamMember?'افتح مساحة فريقك لتجد زملاءك وتسليماتكم.':'انتقل إلى البطاقات، ثم افتح التحدي الذي تريد التعرّف عليه.'),
  step('home:program',anchor('home-program'),'برنامج الهاكاثون','راجع برنامج اليوم ووقت تسليم النموذج والعرض.'),
  step('home:evaluation',anchor('evaluation'),'كيف يُقيّم الحل؟','اطّلع على معايير لجنة التحكيم ووزن تصويت الحضور على الحلول النهائية.')
 ];
 const w=ctx.workshop?.intake,steps=openTour(ctx);
 if(!w||w.phase==='open'||!steps.length)return steps;
 const focus=engagementFocus(w);
 if(ctx.route==='new')return []; // No tour of a closed composer.
 const list=steps.filter(s=>s.id!=='participate:create'&&!(focus==='browse'&&/:(vote|join)$/.test(s.id))).map(s=>{
  if(s.id==='home:welcome')return step(s.id,anchor(focus==='vote-join'?'focus-vote':focus==='join'?'focus-join':'browse-challenges'),'تعرّف على تحديات زملائك',focus==='vote-join'?'انتهى استقبال التحديات. من هنا تستعرض البطاقات، وتصوّت لما تراه أولوية أو تسجّل رغبتك بالانضمام.':focus==='join'?'اختر من هنا التحدي الذي تودّ العمل على حلّه وسجّل رغبتك.':'استكشف التحديات التي شاركها زملاؤك.');
  if(s.id==='account:participate')return {...s,text:'تصفّح تحديات زملائك، واختر التحدّي الذي يناسب اهتماماتك.'};
  if(s.id==='home:participate')return {...s,title:'استكشف التحديات',text:'من هنا تعود إلى التحديات المنشورة.'};
  if(s.id==='library:examples'||s.id==='home:explore'&&!ctx.entries.some(e=>!e.example&&e.status==='published'))return {...s,text:'هذه أمثلة للاستلهام والقراءة فقط. تُتاح المشاركة على التحديات التي طرحها الزملاء.'};
  return s;
 });
 if(ctx.route==='home'&&focus!=='browse'){const head=list.filter(s=>['home:welcome','home:explore','home:vote','home:join'].includes(s.id));return [...head,...list.filter(s=>!head.includes(s))]}
 return list;
}
