export type IconFrames={images:string[];steps:number[][]};
export function attachTabIcon(loadFrames:()=>Promise<IconFrames>){
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
 let link:HTMLLinkElement|null=null,frames:IconFrames|null=null,pending:Promise<IconFrames>|null=null;
 let stopped=false,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
 const allowed=()=>!stopped&&!motion.matches&&!connection?.saveData;
 function remove(){link?.remove();link=null}
 function draw(index:number,animate:boolean){
  if(!frames||!allowed())return;
  const [source,delay]=frames.steps[index];
  if(!link){link=document.createElement('link');link.rel='icon';link.type='image/png';link.sizes.value='32x32';link.dataset.eventTabIcon='true';link.href=frames.images[source];document.head.appendChild(link);}
  else link.href=frames.images[source];
  if(animate)timer=setTimeout(()=>{if(allowed()&&!document.hidden)draw((index+1)%frames!.steps.length,true)},delay);
 }
 function sync(){
  clearTimeout(timer);const attempt=++generation;
  if(!allowed()){remove();return;}
  if(document.hidden){if(link&&frames)draw(0,false);return;}
  if(frames){draw(0,true);return;}
  pending??=loadFrames();pending.then(data=>{
   if(stopped||generation!==attempt||!allowed()||document.hidden||!data.steps.length)return;
   frames=data;draw(0,true);
  }).catch(()=>{pending=null;}); // Native icon links remain available.
 }
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);connection?.addEventListener('change',sync);sync();
 return ()=>{stopped=true;generation++;clearTimeout(timer);document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);connection?.removeEventListener('change',sync);remove();};
}
