import {intakeStartsAt,intakeClosesAt,intakeWindow,closedIntakeText} from '../hackathon-intake';
import {database,settings,reply} from './access';
// SQLite evaluates its own UTC clock at the write, including for requests that were open or queued at midnight.
export const withinIntakeSQL=`unixepoch('now')>=${intakeStartsAt/1000} AND unixepoch('now')<${intakeClosesAt/1000}`;
export const acceptSubmissionSQL=`(NOT EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND (intake_paused=1 OR finalized=1)) AND (${withinIntakeSQL} OR EXISTS(SELECT 1 FROM workshop_settings WHERE id=1 AND intake_paused=2)))`;
export async function currentIntake(){return intakeWindow(await settings())}
export async function intakeDenied(){
 const row=await database().prepare("SELECT s.intake_paused,s.finalized,s.joining_open,COALESCE(s.open,1) open,unixepoch('now')*1000 clock FROM (SELECT 1) t LEFT JOIN workshop_settings s ON s.id=1").first<{joining_open:number;intake_paused:number;finalized:number;open:number;clock:number}>();
 const intake=intakeWindow(row??{},Math.max(Date.now(),row?.clock??0));return reply({code:'INTAKE_CLOSED',error:intake.phase==='open'?'تغيّرت حالة الاستقبال. حدّث الصفحة ثم حاول مجددًا.':closedIntakeText(intake),intake},409);
}
