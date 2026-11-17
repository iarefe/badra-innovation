// The programme's last day is inclusive in Riyadh. The boundary is the next local midnight.
import {deadlineLabel,journeyStages,participationDeadlineLabel} from './hackathon-event';
const midnight=(day:string)=>Date.parse(day+'T00:00:00+03:00');
export const intakeStartsAt=midnight(journeyStages[0].start);
export const intakeClosesAt=midnight(journeyStages[0].end)+86_400_000;
export const engagementEndsAt=midnight(journeyStages[1].end)+86_400_000;
export type IntakePhase='before'|'open'|'paused'|'ended'|'final';
export type IntakeSnapshot={phase:IntakePhase;manualOpen?:boolean;manualPause:boolean;finalized:boolean;votingOpen:boolean;joiningOpen:boolean;serverNow:number;opensAt:number;closesAt:number;engagementEndsAt:number};
type Stored={joining_open?:number|boolean;intake_paused?:number|boolean;open?:number|boolean;finalized?:number|boolean};
export function intakeWindow(s:Stored={},now=Date.now()):IntakeSnapshot{
 const finalized=!!s.finalized,manualOpen=s.intake_paused===2,manualPause=Number(s.intake_paused)===1;
 const phase:IntakePhase=finalized?'final':manualOpen?'open':manualPause?'paused':now>=intakeClosesAt?'ended':now<intakeStartsAt?'before':'open';
 return {phase,manualOpen,manualPause,finalized,votingOpen:!finalized&&s.open!==0&&s.open!==false,joiningOpen:!finalized&&!!s.joining_open,serverNow:now,opensAt:intakeStartsAt,closesAt:intakeClosesAt,engagementEndsAt};
}
export function advanceWindow(seed:IntakeSnapshot,now:number){
 return intakeWindow({intake_paused:seed.manualOpen?2:seed.manualPause,finalized:seed.finalized,open:seed.votingOpen,joining_open:seed.joiningOpen},now);
}
export const intakeLabels={open:'الاستقبال مفتوح',paused:'أوقف المدير الاستقبال',before:'لم يبدأ الاستقبال',ended:'أُغلق الاستقبال وفق الجدول',final:'القائمة معتمدة'} as const;
export const intakeDeadline='نهاية يوم '+deadlineLabel+' بتوقيت الرياض';
export function engagementFocus(w:IntakeSnapshot){
 return w.phase!=='before'&&!w.finalized&&w.serverNow<w.engagementEndsAt?(w.votingOpen?(w.joiningOpen?'vote-join':'vote'):w.joiningOpen?'join':'browse'):'browse';
}
export function closedIntakeText(w:IntakeSnapshot){
 if(w.phase==='before')return 'لم يبدأ استقبال التحديات بعد. يمكنك استعراض مكتبة التحديات.';
 const f=engagementFocus(w);
 return f==='vote-join'?'أُغلق استقبال التحديات الجديدة. صوّت لما تراه أولوية وسجّل رغبتك في العمل على حلّه حتى '+participationDeadlineLabel+'.'
  :f==='vote'?'أُغلق استقبال التحديات الجديدة والانضمام. يمكنك التصويت للتحديات المنشورة حتى '+participationDeadlineLabel+'.'
  :f==='join'?'أُغلق استقبال التحديات الجديدة. التصويت موقوف حاليًا، ويمكنك تسجيل رغبتك في الانضمام حتى '+participationDeadlineLabel+'.'
  :'أُغلق استقبال التحديات الجديدة. يمكنك استعراض البطاقات المنشورة.';
}
export const participationLinks={vote:'/challenges?participate=vote',join:'/challenges?participate=join',browse:'/challenges'} as const;
