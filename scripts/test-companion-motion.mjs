import assert from 'node:assert/strict';
import {load,sql} from './test-fixture.mjs';
const {advanceCompanionMotion:advance,companionAtRest:atRest}=await load('lib/companion-motion.ts');
const {placeCompanion}=await load('lib/companion-position.ts');
const start={x:18,y:700,vx:0,vy:0},target={x:1100,y:100};
const states=[];
for(const rate of [30,60,120]){
 let s={...start},distance=Infinity;
 for(let frame=0;frame<rate*3;frame++){
  const next=advance(s,target,1/rate),remaining=Math.hypot(next.x-target.x,next.y-target.y);
  assert(remaining<=distance+1e-8,'A stationary destination is approached without bouncing');
  assert(next.x>=start.x&&next.x<=target.x&&next.y>=target.y&&next.y<=start.y);
  assert(Object.values(next).every(Number.isFinite));s=next;distance=remaining;
  if(frame===rate-1)states.push(s);
 }
 assert(atRest(s,target),'Both position and velocity settle before explanation');
}
for(const s of states)assert(Math.abs(s.x-states[0].x)<1e-8&&Math.abs(s.y-states[0].y)<1e-8,'Motion is independent of refresh rate');
let moving={...start};for(let frame=0;frame<12;frame++)moving=advance(moving,target,1/60);
const reversed={x:18,y:700},first=advance(moving,reversed,1/60),reset=advance({...moving,vx:0,vy:0},reversed,1/60);
assert(first.vx>reset.vx,'A retarget preserves momentum instead of abruptly resetting velocity');
assert(Math.hypot(first.x-moving.x,first.y-moving.y)<Math.hypot(target.x-start.x,target.y-start.y)*.06,'Retargeting never teleports');
assert.deepEqual(advance(moving,reversed,4),advance(moving,reversed,.04),'A suspended frame cannot create a visible jump');
assert.deepEqual(advance(moving,reversed,0),moving);
const rect=(top)=>({left:500,right:680,top,bottom:top+44,width:180,height:44});
const card={width:350,height:180},viewport={width:1280,height:900,header:80};
const low=placeCompanion(rect(670),card,viewport);assert(low);assert.notEqual(low.side,'bottom');
const moved=placeCompanion(rect(600),card,viewport,[],low);assert(moved);assert.equal(moved.side,low.side,'The current side remains stable when another side becomes available');
const obstacle={left:moved.left,top:moved.top,right:moved.left+350,bottom:moved.top+180,width:350,height:180};
const rerouted=placeCompanion(rect(600),card,viewport,[obstacle],moved);
assert(rerouted);assert(rerouted.left+350<=obstacle.left||rerouted.left>=obstacle.right||rerouted.top+180<=obstacle.top||rerouted.top>=obstacle.bottom,'Stability never overrides collision avoidance');
sql.close();console.log('PASS: smooth settling without bounce; refresh-rate consistency; velocity-preserving retarget; stalled-frame safety; stable placement with obstacle avoidance.');
