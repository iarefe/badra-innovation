export type MotionPoint={x:number;y:number};
export type CompanionMotion=MotionPoint&{vx:number;vy:number};
/** A critically damped spring retains its velocity when its destination changes. */
export function advanceCompanionMotion(state:CompanionMotion,target:MotionPoint,seconds:number):CompanionMotion{
 const dt=Math.max(0,Math.min(seconds,.04)),omega=8.5,decay=Math.exp(-omega*dt);
 const axis=(position:number,velocity:number,destination:number)=>{
  const offset=position-destination,impulse=(velocity+omega*offset)*dt;
  return [destination+(offset+impulse)*decay,(velocity-omega*impulse)*decay];
 };
 const [x,vx]=axis(state.x,state.vx,target.x),[y,vy]=axis(state.y,state.vy,target.y);
 return {x,y,vx,vy};
}
export function companionAtRest(state:CompanionMotion,target:MotionPoint){
 return Math.hypot(state.x-target.x,state.y-target.y)<.45&&Math.hypot(state.vx,state.vy)<3;
}
