import {z} from 'zod';
export const axes=['scene','friction','people','impact','success'] as const;
export type Axis=typeof axes[number];
export const topics=[...axes,'verify','evidence','workaround','frequency','scope','domain','department','ownership','coOwners','trialStatus','trialDetail','trialOutcome','review','pause'] as const;
export type Topic=typeof topics[number];
export const topicLabel:Record<Topic,string>={
 scene:'موقف من الواقع',friction:'موضع التعثّر',people:'من يتأثر وما الذي يحاول إنجازه',impact:'أثر التعثّر',success:'علامة التحسّن',
 verify:'ما نعرفه وما يحتاج تحققًا',evidence:'الشاهد من الواقع',workaround:'كيف تمضي الأمور اليوم',frequency:'متى يتكرر الموقف',scope:'الجمهور المقصود',domain:'مجال التحدي',department:'الفرق المعنية',ownership:'صاحب التحدي',coOwners:'شركاء التحدي',trialStatus:'التجارب السابقة',trialDetail:'ما جُرّب بالفعل',trialOutcome:'ما تغيّر بعد التجربة',review:'مراجعة وصف التحدي',pause:'ما بقي غير واضح'
};
export const signalSchema=z.object({axis:z.enum(axes),status:z.enum(['observed','tentative','unknown']),quote:z.string().trim().min(1).max(260)});
export type Signal=z.infer<typeof signalSchema>;
export const interviewStateSchema=z.object({version:z.literal(1),signals:z.array(signalSchema).max(5),asked:z.array(z.enum(topics)).max(18),noProgress:z.number().int().min(0).max(3).optional()});
export type InterviewState=z.infer<typeof interviewStateSchema>;
