// The deadline is monotonic. Late callbacks update to actual elapsed time; a
// suspended tab never accumulates time or advances through unseen slides.
export function makeSlideClock(duration:number,tick:(seconds:number)=>void,end:()=>void,now=()=>performance.now()){
 let remaining=duration,deadline:number|null=null,handle:ReturnType<typeof setTimeout>|undefined,done=false,shown=-1;
 function report(ms:number){const seconds=Math.ceil(Math.max(0,ms)/1000);if(seconds!==shown){shown=seconds;tick(seconds)}}
 function step(){
  if(deadline===null||done)return;
  const ms=Math.max(0,deadline-now());report(ms);
  if(ms===0){done=true;remaining=0;deadline=null;end();return;}
  handle=setTimeout(step,Math.max(1,ms-(Math.ceil(ms/1000)-1)*1000));
 }
 return {
  resume(){if(deadline!==null||done)return;deadline=now()+remaining;step();},
  pause(){clearTimeout(handle);if(deadline!==null){remaining=Math.max(0,deadline-now());deadline=null;report(remaining);}},
 };
}
