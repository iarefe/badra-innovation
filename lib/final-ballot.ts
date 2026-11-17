export type BallotPhase='not_open'|'open'|'closed';
export type FinalBallotTeam={id:string;title:string;rank:number};
export type FinalBallotPerson={id:string;name:string;attending:boolean};
export type FinalBallotView={
 phase:BallotPhase;signedIn:boolean;attending:boolean;
 teams:FinalBallotTeam[];vote:{team:string;title:string}|null;
};
export type FinalBallotAdmin={
 phase:BallotPhase;people:FinalBallotPerson[];
 teams:(FinalBallotTeam&{votes:number})[];cast:number;
};
