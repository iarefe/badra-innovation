export const eventLogoVideo='/placeholder.svg';
export const eventStageVideo='/placeholder.svg';
export const eventLogoStill='/placeholder.svg';
export const wordmarkHoldMs=2000;
export type LogoPlacement='masthead'|'presentation';

// A browser can decode VP9 but discard its alpha plane. The clip has a known
// transparent margin; expose the video only if the decoded corner is clear.
function transparentFrame(video:HTMLVideoElement){
 try{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return false;
  ctx.drawImage(video,0,0,1,1,0,0,1,1);
  return ctx.getImageData(0,0,1,1).data[3]<16;
 }catch{return false;}
}
export function runEventLogo(video:HTMLVideoElement,placement:LogoPlacement,show:(moving:boolean)=>void){
 const home=placement==='masthead',motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
 if(!video.canPlayType('video/webm; codecs="vp9"'))return;
 let disposed=false,blocked=false,inView=true,active=false,cycle=0,transparent=false;
 let waiting:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
 const eligible=()=>!disposed&&!blocked&&!document.hidden&&inView&&!motion.matches&&!connection?.saveData;
 const clear=()=>{clearTimeout(waiting);clearTimeout(deadline)};
 function rest(){
  cycle++;active=false;clear();show(false);video.pause();
 }
 function fail(){if(disposed)return;blocked=true;rest();}
 function play(){
  if(!eligible())return;
  active=true;const token=++cycle;video.muted=true;
  if(!video.hasAttribute('src'))video.src=home?eventLogoVideo:eventStageVideo;
  else if(home&&video.readyState>=1)video.currentTime=0;
  video.defaultPlaybackRate=video.playbackRate=home?1.5:1;
  // Never replace the wordmark with an empty/broken player.
  deadline=setTimeout(fail,12000);
  try{video.play()?.catch(()=>{if(active&&token===cycle)fail()});}
  catch{if(token===cycle)fail();}
 }
 function schedule(){
  rest();if(!eligible())return;
  if(home)waiting=setTimeout(play,wordmarkHoldMs);else play();
 }
 function playing(){
  if(!active||!eligible())return;
  if(!transparent&&!transparentFrame(video)){fail();return;}
  transparent=true;clearTimeout(deadline);show(true);
  if(home){const seconds=Number.isFinite(video.duration)?video.duration-video.currentTime:10;
   deadline=setTimeout(()=>{if(active)fail()},Math.max(1,seconds/(video.playbackRate||1))*1000+2500);}
 }
 function ended(){if(home&&active)schedule();}
 function stalled(){if(!active)return;clearTimeout(deadline);deadline=setTimeout(fail,8000);}
 const changes=()=>schedule();
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>{
  if(!entry||entry.isIntersecting===inView)return;inView=entry.isIntersecting;schedule();
 }):undefined;
 observer?.observe(video);
 video.loop=!home;
 video.addEventListener('playing',playing);video.addEventListener('ended',ended);video.addEventListener('error',fail);video.addEventListener('waiting',stalled);
 document.addEventListener('visibilitychange',changes);motion.addEventListener('change',changes);connection?.addEventListener('change',changes);
 schedule();
 return ()=>{disposed=true;active=false;cycle++;clear();observer?.disconnect();
  video.removeEventListener('playing',playing);video.removeEventListener('ended',ended);video.removeEventListener('error',fail);video.removeEventListener('waiting',stalled);
  document.removeEventListener('visibilitychange',changes);motion.removeEventListener('change',changes);connection?.removeEventListener('change',changes);
  video.pause();if(video.hasAttribute('src')){video.removeAttribute('src');video.load();}
 };
}
