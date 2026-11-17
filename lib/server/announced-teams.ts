import {database} from './access';
import type {AnnouncedChallenge} from '../challenges';

// This projection is public only after a team has actually been announced.
// Never use the private selection preview, scores, members or votes on the home page.
export async function announcedChallenges():Promise<AnnouncedChallenge[]>{
 const rows=await database().prepare("SELECT t.id,json_extract(c.payload,'$.title') title,s.rank FROM event_teams t JOIN challenges c ON c.id=t.id JOIN workshop_selection s ON s.challenge_id=t.id ORDER BY s.rank").all<AnnouncedChallenge>();
 return rows.results;
}
