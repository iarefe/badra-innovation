import type {ParticipantRole} from './participant-roles';
import type {Entry,Viewer,Workshop} from './challenges';
import type {SuggestedProfile} from './prospective-employees';
export type AccountState={employee:{name:string;phone:string|null;number:string|null;department:string;roles:ParticipantRole[];avatarUrl?:string|null}|null;pendingProfile:{phone:string|null;name:string;department:string;roles:ParticipantRole[];avatarUrl?:string|null}|null;suggestedProfile?:SuggestedProfile|null;otpReady:boolean;channel:'sms'|'whatsapp'};
export type SiteData={homeVoteOrder:string[];entries:Entry[];viewer:Viewer;workshop:Workshop;account:AccountState};
