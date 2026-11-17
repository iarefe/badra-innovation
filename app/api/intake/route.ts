import {reply,fail} from '@/lib/server/access';
import {currentIntake} from '@/lib/server/submission-intake';
export const dynamic='force-dynamic';
export async function GET(){try{return reply(await currentIntake())}catch{return fail('تعذّر تحديث حالة استقبال التحديات.',503)}}
