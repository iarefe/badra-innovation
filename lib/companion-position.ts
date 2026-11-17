type Rect={left:number;top:number;right:number;bottom:number;width:number;height:number};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
type Side='top'|'bottom'|'left'|'right';
export type GuidePosition={left:number;top:number;width:number;mascotLeft:number;mascotTop:number;figure:'left'|'right';facing:'left'|'right';pose:'up'|'down';side:Side;path:string;endX:number;endY:number};
/** Keep the guide outside its target and inside the visible viewport, including zoom. */
export function placeCompanion(target:Rect,card:{width:number;height:number},viewport:{width:number;height:number;top?:number;left?:number;header?:number},obstacles:Rect[]=[],previous?:GuidePosition|null):GuidePosition|null{
 const left=viewport.left||0,top=viewport.top||0,pad=12,gap=viewport.width<=760?16:24,minY=top+(viewport.header??84),maxY=top+viewport.height-pad;
 const x=clamp(target.left+target.width/2-card.width/2,left+pad,left+viewport.width-pad-card.width);
 const y=clamp(target.top+target.height/2-card.height/2,minY,maxY-card.height);
 const candidates:[number,number,Side][]=viewport.width>760?[[x,target.bottom+gap,'bottom'],[target.left-gap-card.width,y,'left'],[target.right+gap,y,'right'],[x,target.top-gap-card.height,'top']]:[[x,target.bottom+gap,'bottom'],[x,target.top-gap-card.height,'top']];
 // Adjacent vote/join controls can block all four immediate positions.
 // Try the nearest free space beside that group before skipping the hint.
 if(viewport.width>760){const alternatives=obstacles.flatMap(r=>[[r.left-gap-card.width,y,'left'],[r.right+gap,y,'right']] as [number,number,Side][]).sort((a,b)=>Math.abs(a[0]+card.width/2-target.left-target.width/2)-Math.abs(b[0]+card.width/2-target.left-target.width/2));candidates.push(...alternatives)}
 const available=candidates.filter(([cx,cy])=>cx>=left+pad&&cx+card.width<=left+viewport.width-pad&&cy>=minY&&cy+card.height<=maxY&&!(cx<target.right+4&&cx+card.width>target.left-4&&cy<target.bottom+4&&cy+card.height>target.top-4)&&!obstacles.some(r=>cx<r.right+4&&cx+card.width>r.left-4&&cy<r.bottom+4&&cy+card.height>r.top-4));
 // Keep the same side while it is safe, instead of flipping at every scroll boundary.
 const sameSide=previous?available.filter(p=>p[2]===previous.side).sort((a,b)=>Math.hypot(a[0]-previous.left,a[1]-previous.top)-Math.hypot(b[0]-previous.left,b[1]-previous.top)):[];
 const match=sameSide[0]||available[0];
 if(!match)return null;
 const [cx,cy,side]=match,center=target.left+target.width/2,figure=cx+card.width<target.left?'right':cx>target.right?'left':center>cx+card.width/2?'right':'left';
 const figureX=figure==='right'?cx+card.width-84:cx,figureY=cy+card.height-99;
 const facing=center>figureX+42?'right':'left',pose=target.top+target.height/2>cy+card.height/2?'down':'up';
 const sx=figureX+(facing==='right'?81:3),sy=figureY+(pose==='up'?23:74);
 let ex=clamp(sx+(facing==='right'?24:-24),target.left+8,target.right-8),ey=pose==='up'?target.bottom+7:target.top-7;
 if(cx+card.width<target.left){ex=target.left-7;ey=clamp(sy,target.top+8,target.bottom-8)}else if(cx>target.right){ex=target.right+7;ey=clamp(sy,target.top+8,target.bottom-8)}
 return {left:cx,top:cy,width:card.width,mascotLeft:figureX,mascotTop:figureY,figure,facing,pose,side,path:`M ${sx} ${sy} Q ${sx+(ex-sx)*.6} ${sy+(pose==='up'?-20:20)} ${ex} ${ey}`,endX:ex,endY:ey};
}
