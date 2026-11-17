import {acceptSubmissionSQL} from './submission-intake';
import {database} from './access';
// The owner removed the approval stage. Publish only previously submitted cards;
// never change private drafts or cards returned to their authors for completion.
export async function publishSubmittedChallenges(){
 await database().prepare(`UPDATE challenges SET status='published',review_note='',published_at=COALESCE(published_at,updated_at,created_at) WHERE status='pending' AND ${acceptSubmissionSQL}`).run();
}
let publication:Promise<void>|undefined;
export function ensureDirectPublication(){
 if(!publication)publication=publishSubmittedChallenges().catch(error=>{publication=undefined;throw error});
 return publication;
}
