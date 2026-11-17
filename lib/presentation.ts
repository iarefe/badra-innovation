// Permanent visitor-facing links: a kiosk or preview must never encode an admin/session URL.
export const displayOrigin='https://example.invalid';
export const displayPath='/presentation';
export const displayUrl=displayOrigin+displayPath;
export const submitUrl=displayOrigin+'/submit';
export const cardPath=(id:string)=>'/challenge/'+encodeURIComponent(id);
export const slideDurationMs=(id:string|null)=>id===null?5_000:20_000;
export const refreshMs=30_000;
export type DisplaySlide={id:string;title:string;summary:string;author:string;department:string;team:string;domain:string;scope:string;avatarUrl:string|null;coverUrl:string};
export type DisplayFeed={intake?:import('./hackathon-intake').IntakeSnapshot;title:string;votingOpen:boolean;slides:DisplaySlide[]};
export type DisplayState={feed:DisplayFeed|null;id:string|null};
export type DisplayAction={type:'refresh';feed:DisplayFeed}|{type:'move';offset:number};
export function excerpt(source:string,limit=220){
 const value=source.replace(/\s+/gu,' ').trim();
 if(value.length<=limit)return value;
 const slice=value.slice(0,limit);
 const end=Math.max(slice.lastIndexOf('؟ '),slice.lastIndexOf('. '),slice.lastIndexOf('! '));
 if(end>=limit*0.55)return slice.slice(0,end+1);
 const space=slice.lastIndexOf(' ');
 return (space>=limit/2?slice.slice(0,space):slice).trimEnd()+'…';
}
// null is the opening slide, not a challenge ID or an entry in the public feed.
export function displayState(feed:DisplayFeed|null):DisplayState{return {feed,id:null};}
export function displayReducer(state:DisplayState,action:DisplayAction):DisplayState{
 const old=state.feed?.slides??[],index=old.findIndex(s=>s.id===state.id);
 if(action.type==='move'){
  if(!old.length)return state;
  const count=old.length+1,position=((index+1+action.offset)%count+count)%count;
  return {...state,id:position?old[position-1].id:null};
 }
 const {feed}=action,ids=new Set(feed.slides.map(s=>s.id));
 if(state.id===null||ids.has(state.id))return {feed,id:state.id};
 // Keep the next surviving challenge, or return to the opening at the end of the round.
 const next=old.slice(index+1).find(s=>ids.has(s.id));
 return {feed,id:next?.id??null};
}
