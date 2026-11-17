import type {ChallengeCover} from './challenge-cover';
import type {ParticipantRole} from './participant-roles';
import {z} from 'zod';
export const domains=['العمليات والاجتماعات','المنح والمشاريع','تجربة الجهات المستفيدة','الاستشارات وتأسيس الجهات','المعرفة والبيانات','مجال آخر'] as const;
export const scopes=['داخلي','خارجي','داخلي وخارجي'] as const;
export const frequencies=['يوميًا','أسبوعيًا','شهريًا','ربع سنوي','نصف سنوي','سنويًا','مع كل طلب أو مشروع','موسميًا','غير محدد'] as const;
export const challengeExtras={ownership:'' as ''|'individual'|'shared',coOwners:'',initialSolutionStatus:'' as ''|'none'|'implemented',initialSolution:'',initialSolutionOutcome:'',need:'',assumptions:'',inScope:'',outOfScope:'',criteria:'',question:''};
export const challengeSchema=z.object({ownership:z.enum(['','individual','shared']).default(''),coOwners:z.string().trim().max(500).default(''),initialSolutionStatus:z.enum(['','none','implemented']).default(''),initialSolution:z.string().trim().max(1200).default(''),initialSolutionOutcome:z.string().trim().max(700).default(''),title:z.string().trim().min(8).max(110),scope:z.enum(scopes),domain:z.enum(domains),department:z.string().trim().min(2).max(100),situation:z.string().trim().min(40).max(1200),stakeholders:z.string().trim().min(10).max(500),frequency:z.enum(frequencies),impact:z.string().trim().min(30).max(1000),evidence:z.string().trim().min(15).max(700),workaround:z.string().trim().min(15).max(700),success:z.string().trim().min(15).max(500),author:z.string().trim().min(2).max(60),need:z.string().trim().max(500).default(''),assumptions:z.string().trim().max(700).default(''),inScope:z.string().trim().max(700).default(''),outOfScope:z.string().trim().max(700).default(''),criteria:z.string().trim().max(700).default(''),question:z.string().trim().max(500).default('')});
export type Challenge=z.infer<typeof challengeSchema>;
export type Entry={authorDepartment?:string|null;authorAvatar?:string|null;cover?:ChallengeCover;id:string;challenge:Challenge;status:'draft'|'pending'|'published'|'returned';createdAt:number;publishedAt?:number|null;votes?:number;hasVotes:boolean;voted:boolean;mine:boolean;reviewNote:string;example?:boolean;interestCount?:number;interested?:boolean;voters?:{name:string}[];interestedMembers?:{name:string;roles:ParticipantRole[]}[]};
export function challengeImpactFacts(c:Pick<Challenge,'department'|'frequency'|'scope'>):[string,string][]{return [['الجهات المتأثرة',c.department],['التكرار',c.frequency],['النطاق',c.scope]];}
export function voteLabel(entry:Pick<Entry,'voted'|'hasVotes'>){return entry.voted?'صوّتّ له':entry.hasVotes?'انضم للمصوّتين':'كن أول مصوّت';}
export type Viewer={judge?:boolean;teamMember?:boolean;signedIn:boolean;employee:boolean;manager:boolean;email:string;employeeName?:string;employeeId?:string;employeeNumber?:string;department?:string;roles?:ParticipantRole[];needsProfile?:boolean};
export type AnnouncedChallenge={id:string;title:string;rank:number};
export type Workshop={publishedResults?:import('./published-results').PublishedResults|null;announced?:AnnouncedChallenge[];intake?:import('./hackathon-intake').IntakeSnapshot;title:string;count:number;open:boolean;joiningOpen:boolean;finalized:boolean;rankedIds?:string[];selected:any[];revision:number};
export const blank:Challenge={...challengeExtras,title:'',scope:'داخلي',domain:domains[0],department:'',situation:'',stakeholders:'',frequency:'أسبوعيًا',impact:'',evidence:'',workaround:'',success:'',author:''};
export function completeness(c:Challenge){return [c.title.trim().length>=8,c.situation.trim().length>=40,c.stakeholders.trim().length>=10,c.impact.trim().length>=30,c.evidence.trim().length>=15,c.workaround.trim().length>=15,c.success.trim().length>=15,(c.need||'').trim().length>=10].filter(Boolean).length;}
export function howMightWe(c:Challenge){if(c.question?.trim())return c.question.trim();return `كيف يمكننا مساعدة ${c.stakeholders} على تجاوز تحدي «${c.title}»، بحيث ${c.success.replace(/[.؟]$/,'')}؟`;}
export type Direction={name:string;description:string;question:string};
export function directions(c:Challenge):Direction[]{const map:Record<string,Direction[]>={
'العمليات والاجتماعات':[{name:'مسار موحّد للعمل',description:'استكشف نقطة واحدة لاستقبال العمل وتحضير مواده وإسناد مسؤولياته ومتابعة حالته.',question:'أين تنقطع المعلومة بين الأشخاص أو المراحل؟'},{name:'متابعة القرارات والالتزامات',description:'جرّب سجلًا يربط كل قرار بمسؤول وموعد ودليل إنجاز واضح.',question:'ما أقل بيانات تكفي لمنع ضياع الالتزام؟'},{name:'تبسيط الإجراء قبل رقمنته',description:'اختبر قالبًا موحّدًا وأدوارًا واضحة وخطوة مراجعة قصيرة قبل بناء أي أداة.',question:'أي خطوة يمكن إلغاؤها أو دمجها؟'}],
'المنح والمشاريع':[{name:'وضوح مسار الطلب',description:'استكشف عرضًا مبسّطًا لحالة الطلب والمتطلبات الناقصة والخطوة التالية.',question:'ما أكثر معلومة يسأل عنها أصحاب الطلبات؟'},{name:'فحص مبكر للاكتمال',description:'جرّب قائمة تحقق تساعد على اكتشاف النواقص قبل الدراسة أو الاعتماد.',question:'ما النقص المتكرر الذي يسبب إعادة العمل؟'},{name:'تنسيق نقاط التسليم',description:'اختبر آلية تربط تسليم العمل بين المنح والمالية والجهة المستفيدة بمخرج واضح.',question:'أي انتقال بين الفرق يحتاج اتفاقًا أوضح؟'}],
'تجربة الجهات المستفيدة':[{name:'رحلة واضحة للمستفيد',description:'استكشف إرشادات سياقية تشرح المطلوب ومتى ولماذا عند كل خطوة.',question:'أين يتوقف المستفيد أو يحتاج إلى السؤال؟'},{name:'قناة متابعة موحّدة',description:'جرّب نقطة لاستقبال الاستفسار وتصنيفه ومعرفة المسؤول عن الرد.',question:'كيف يعرف المستفيد أن طلبه وصل ومن يتابعه؟'},{name:'اختبار مبكر مع المستفيدين',description:'اعرض نموذجًا بسيطًا على عدد محدود من المستفيدين وسجّل مواطن الالتباس.',question:'ما الذي يمكن اختباره دون بناء نظام كامل؟'}],
'الاستشارات وتأسيس الجهات':[{name:'استقبال منظّم للاستشارات',description:'استكشف صفحة تجمع مرحلة التأسيس وموضوع الاستشارة ووسيلة المتابعة لتوجيه الطلب.',question:'ما المعلومات اللازمة لتوجيه الاستشارة من أول مرة؟'},{name:'مسار إرشادي للتأسيس',description:'جرّب محتوى متدرجًا يجيب عن الأسئلة المتكررة بحسب مرحلة الجهة.',question:'ما السؤال المتكرر الذي يمكن خدمته ذاتيًا؟'},{name:'تنسيق الحجز والإحالة',description:'اختبر تصنيف الاحتياج وربطه بموعد أو مختص مناسب مع حفظ ملخص المتابعة.',question:'كيف نضمن وصول كل استشارة إلى الشخص المناسب؟'}],
'المعرفة والبيانات':[{name:'مصدر موحّد للمعلومة',description:'استكشف تنظيم المعلومة بمصدر وتاريخ تحديث ومالك واضح.',question:'كيف نميّز المعلومة الأحدث والأوثق؟'},{name:'بحث موجّه بالسؤال',description:'جرّب تجربة وصول تبدأ من سؤال الموظف وتعرض المصدر الأصلي للإجابة.',question:'ما الأسئلة التي تتكرر ويصعب الوصول لإجابتها؟'},{name:'جودة البيانات من البداية',description:'اختبر حقولًا واضحة وقواعد تحقق بسيطة عند الإدخال بدل تصحيح البيانات لاحقًا.',question:'أي خطأ متكرر يمكن منعه لحظة التسجيل؟'}],
'مجال آخر':[{name:'تبسيط رحلة العمل',description:'ارسم الوضع الحالي وحدّد خطوة واحدة تسبب التأخير ثم جرّب تغييرها.',question:'أين يقع أكبر احتكاك في الرحلة؟'},{name:'تمكين المستفيد من الخدمة',description:'استكشف معلومة أو إجراءً يمكن للمستفيد إتمامه بنفسه بسهولة.',question:'ما الذي يحتاجه المستفيد ليستقل بهذه الخطوة؟'},{name:'تنظيم المتابعة والقياس',description:'جرّب سجلًا صغيرًا يوضح الحالة والمسؤول وقياس التحسن.',question:'ما المؤشر الذي يثبت أن التحدي بدأ ينحسر؟'}]};return map[c.domain]||map['مجال آخر'];}
export function explorationQuestions(c:Challenge){return [
 `ما الذي يحتاجه المتأثرون فعلًا، وكيف نتحقق منه معهم في سياق «${c.title}»؟`,
 c.assumptions?.trim()?'أي تفسير محتمل سنختبره أولًا؟ وما الملاحظة التي قد تثبته أو تنفيه؟':'ما الأسباب المحتملة للتعثر، وما الذي نحتاج ملاحظته قبل اعتبارها أسبابًا مؤكدة؟',
 'ما أصغر تجربة يمكن أن تُظهر تحسنًا في النتيجة المطلوبة؟ وكيف نقيسها مع المتأثرين؟'
 ];}
export const workshopOutputs=[
 {title:'فهم موثّق',description:'ملاحظة أو مقابلة مع المتأثرين، وما تأكد وما بقي فرضية.'},
 {title:'سؤال متفق عليه',description:'سؤال تحدٍ محدد، وحدود واضحة، ومعايير نجاح قابلة للتحقق.'},
 {title:'بدائل واختيار',description:'عدة حلول ممكنة ومبرر اختيار أحدها وفق الاحتياج والمعايير.'},
 {title:'نموذج وتجربة',description:'نموذج أولي بسيط، ومَن سيجرّبه، وما الذي سنلاحظه لقياس التحسن.'}
 ];
export function challengeBrief(c:Challenge){return `التحدي: ${c.title}\nنطاق المشروع وجمهوره: ${c.scope} | المجال: ${c.domain}\nالفريق المرتبط: ${c.department}\nصاحب التحدي: ${c.author}\nالشركاء في التحدي: ${c.ownership==='shared'?c.coOwners:c.ownership==='individual'?'صاحب التحدي بمفرده':'لم تُحدد بعد'}\n\nالحل الأولي المجرّب:\n${c.initialSolutionStatus==='implemented'?c.initialSolution:c.initialSolutionStatus==='none'?'لم يُنفّذ حل أولي بعد.':'لم تُذكر تجربة سابقة بعد.'}\nنتائج التجربة وما بقي من التحدي:\n${c.initialSolutionOutcome||'لم تُذكر نتائج بعد.'}\n\nسؤال التحدي:\n${howMightWe(c)}\n\nالمشهد الحالي:\n${c.situation}\n\nالمتأثرون:\n${c.stakeholders}\n\nما الذي يحاولون إنجازه؟\n${c.need||'لم يُستكمل وصف الاحتياج بعد.'}\n\nالتكرار: ${c.frequency}\n\nالأهمية والأثر:\n${c.impact}\n\nالشواهد المتاحة:\n${c.evidence}\n\nالتعامل الحالي:\n${c.workaround}\n\nفرضيات تحتاج تحققًا:\n${c.assumptions||'تُستكشف مع أصحاب العلاقة في الهاكاثون.'}\n\nالنتيجة المطلوبة وعلامة التحسن:\n${c.success}\n\nحدود العمل — يشمل:\n${c.inScope||'لم تحدد بعد.'}\n\nحدود العمل — لا يشمل:\n${c.outOfScope||'لم تحدد بعد.'}\n\nمعايير قبول الحلول المقترحة:\n${c.criteria||'تُحدد مع الفريق بناءً على الاحتياج والنتيجة المطلوبة.'}\n\nأسئلة الاستكشاف:\n${explorationQuestions(c).map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\nمخرجات الهاكاثون:\n${workshopOutputs.map(x=>`${x.title}: ${x.description}`).join('\n')}\n\nالتصويت يحدد أولوية الاستكشاف. تُراجع الفرضيات والشواهد مع أصحاب العلاقة؛ الحل غير محسوم مسبقًا.`;}
const samples:Challenge[]=[
 {...challengeExtras,title:'تتأخر الطلبات الداخلية دون وضوح مرحلة الاعتماد',scope:'داخلي',domain:'العمليات والاجتماعات',department:'الإدارات الطالبة والمالية والخدمات المساندة',
  situation:'يرسل موظف طلب شراء أو صرف مرتبطًا بأحد برامج المؤسسة، ثم يتابع عبر البريد والرسائل لمعرفة من ينتظر إجراءه. وعند انتقال الطلب بين الإدارات، لا تتضح له الملاحظات المطلوبة أو الخطوة التالية.',
  stakeholders:'الموظف صاحب الطلب، والمراجعون والمعتمدون، وفرق المالية والخدمات المساندة وتنفيذ البرامج.',
  need:'معرفة أين وصل الطلب، ومن يتولى الخطوة الحالية، وما المطلوب لاستكماله.',frequency:'مع كل طلب أو مشروع',
  impact:'قد تتأخر احتياجات البرامج وأعمال الفرق، ويُستهلك وقت الموظفين في الاستفسار وإعادة إرسال المستندات بدل إنجاز العمل.',
  evidence:'مثال افتراضي للاستلهام، وليس حالة موثّقة في المؤسسة. للتحقق من وجود التحدي، تتبّع طلبًا فعليًا وسجّل مراحل انتظاره والاستفسارات اللازمة لمعرفة حالته.',
  workaround:'السؤال الفردي عبر البريد والرسائل، وإعداد قوائم متابعة شخصية قد لا تُحدّث عند انتقال الطلب.',
  success:'يستطيع صاحب الطلب معرفة حالته والمسؤول عن الخطوة التالية، مع انخفاض الاستفسارات المتكررة ومدة الانتظار مقارنة بالوضع الحالي.',
  assumptions:'قد يكون سبب التأخير غموض المسؤوليات أو تشتّت تحديثات الحالة، وليس عدد الموافقات وحده؛ نتحقق من ذلك مع أصحاب العلاقة.',
  inScope:'تتبّع نوع واحد من الطلبات الداخلية، وملاحظاته، وانتقاله بين الإدارات.',outOfScope:'تغيير الصلاحيات المالية أو تجاوز ضوابط الاعتماد المعتمدة.',
  criteria:'وضوح الحالة والمسؤول والخطوة التالية.\nتقليل الوقت اللازم للاستفسار عن الطلب مع حفظ صلاحيات الاطلاع.',
  question:'كيف يمكننا مساعدة الموظف على متابعة طلبه الداخلي واستكماله دون اتصالات متكررة بين الإدارات؟',author:'مثال افتراضي للاستلهام'},
 {...challengeExtras,title:'يستغرق إعداد تقارير المنح وقتًا في جمع البيانات ومطابقتها',scope:'داخلي',domain:'المنح والمشاريع',department:'المنح والمالية وقياس الأثر',
  situation:'عند إعداد تقرير دوري عن المنح، يجمع الموظف بيانات الإنجاز والصرف والمخرجات من ملفات ورسائل لدى عدة فرق. وقد تختلف تواريخ التحديث أو أسماء المشاريع، فيحتاج إلى مطابقة النسخ قبل إعداد صورة واضحة عن التقدم.',
  stakeholders:'موظفو المنح والمالية وقياس الأثر، ومديرو البرامج، والإدارة التي تعتمد على التقرير في المتابعة واتخاذ القرار.',
  need:'إعداد تقرير موثوق عن حالة المنح، مع معرفة مصدر كل معلومة وتاريخ تحديثها.',frequency:'شهريًا',
  impact:'ينشغل الموظفون بتجميع البيانات وتصحيح الاختلافات، ويتأخر الوقت المتاح لفهم التعثرات ودعم الجهات المستفيدة واتخاذ القرار.',
  evidence:'سيناريو افتراضي للاستلهام. يمكن التحقق منه بمراجعة إعداد تقرير سابق ورصد مصادر البيانات، والوقت اللازم للمطابقة، والاختلافات التي احتاجت إلى استيضاح.',
  workaround:'دمج الجداول يدويًا، وطلب تحديثات من كل فريق، والاتصال بأصحاب الملفات للتأكد من النسخة الأحدث.',
  success:'يُعد التقرير في وقت أقل وباختلافات أقل بين المصادر، ويمكن الرجوع إلى مصدر كل معلومة وتاريخها.',
  assumptions:'قد تنشأ الاختلافات من تعريفات غير موحّدة أو تأخر التحديث؛ تُختبر هذه الفرضيات قبل اختيار الحل.',
  inScope:'بيانات تقرير دوري واحد لمجموعة محدودة من المنح، ومصادرها ومسؤولية تحديثها.',outOfScope:'استبدال النظام المالي أو تغيير معايير اعتماد المنح.',
  criteria:'إمكانية تتبّع مصدر البيانات وتاريخها.\nتقليل خطوات الجمع والمطابقة مع احترام سرية بيانات الجهات.',
  question:'كيف يمكننا تمكين فرق المؤسسة من إعداد تقرير موثوق عن المنح بجهد أقل في جمع البيانات ومطابقتها؟',author:'مثال افتراضي للاستلهام'},
 {...challengeExtras,title:'تتعثر متابعة المهام عند غياب الموظف المسؤول',scope:'داخلي',domain:'العمليات والاجتماعات',department:'فرق البرامج والمنح والخدمات المساندة',
  situation:'يتولى زميل متابعة مهمة أثناء إجازة المسؤول عنها، لكنه يجد الملفات دون سياق الاتفاقات السابقة أو آخر إجراء أو الموعد القادم. فيبحث في الرسائل ويسأل عدة أشخاص، وقد يحتاج إلى التواصل مع زميله أثناء إجازته.',
  stakeholders:'الموظف المسؤول عن المهمة، وزميله البديل، ومدير الفريق، والجهات أو الفرق التي تنتظر إنجازها.',
  need:'استلام المهمة بسياق واضح يبيّن ما أُنجز وما تبقى والالتزامات المقبلة والملفات اللازمة.',frequency:'مع كل طلب أو مشروع',
  impact:'قد تتأخر الردود أو تفوت متابعة التزامات مرتبطة بالمنح والبرامج، ويُعاد بعض العمل لعدم وضوح ما أُنجز سابقًا.',
  evidence:'مثال افتراضي لا يصف واقعة محددة في المؤسسة. للتحقق، راجع حالة تسليم مهمة بين زميلين وحدّد المعلومات التي اضطر المستلم إلى طلبها بعد التسليم.',
  workaround:'شرح شفهي أو رسائل تسليم مختصرة، ثم الرجوع إلى صاحب المهمة كلما ظهرت تفاصيل غير موثّقة.',
  success:'يستطيع الزميل البديل تحديد الخطوة التالية وتنفيذها دون إعادة جمع سياق المهمة أو تفويت موعد متفق عليه.',
  assumptions:'قد يكون السياق محفوظًا لدى شخص واحد أو موزّعًا بين قنوات متعددة؛ نتحقق من الحد الأدنى اللازم لاستمرار العمل.',
  inScope:'تسليم نوع محدد من المهام عند الإجازة أو انتقال المسؤولية داخل الفريق.',outOfScope:'تقييم أداء الأفراد أو مشاركة مراسلاتهم الخاصة أو تغيير صلاحياتهم الوظيفية.',
  criteria:'وضوح آخر إجراء والموعد التالي والمسؤول البديل.\nسهولة التسليم والاستلام مع مشاركة الملفات اللازمة فقط.',
  question:'كيف يمكننا مساعدة الزميل البديل على مواصلة المهمة بثقة عند غياب المسؤول عنها؟',author:'مثال افتراضي للاستلهام'}
];
export const exampleChallenges:Entry[]=samples.map((challenge,i)=>({id:`example-${i+1}`,challenge:{...challenge,ownership:'individual',initialSolutionStatus:'none'},status:'published',createdAt:0,hasVotes:false,voted:false,mine:false,reviewNote:'',example:true}));

/** Published challenges come first; inspiration cards remain visible alongside them. */
export function challengeFeed(entries:Entry[],maxPublished=Infinity){
 const published=entries.filter(e=>e.status==='published'&&!e.example).sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id));
 return [...published.slice(0,maxPublished),...exampleChallenges];
}
