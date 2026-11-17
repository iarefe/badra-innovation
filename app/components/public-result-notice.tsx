'use client';
import {useEffect,useState} from 'react';
import {Trophy,ArrowLeft} from 'lucide-react';
import {champions,numberLabel,type PublishedResults} from '@/lib/published-results';

export function usePublicResults(initial?:PublishedResults|null){
 const [current,setCurrent]=useState<PublishedResults|null>(initial??null);
 useEffect(()=>{if(initial)setCurrent(c=>!c||initial.revision>=c.revision?initial:c)},[initial]);
 useEffect(()=>{let live=true,pending=false;const controller=new AbortController();
  async function read(){if(!live||document.hidden||pending)return;pending=true;try{
   const r=await fetch('/api/results',{cache:'no-store',signal:controller.signal});if(!r.ok)return;
   const {publication}=await r.json() as {publication:PublishedResults|null};
   if(live&&publication)setCurrent(c=>!c||publication.revision>=c.revision?publication:c);
  }catch{/* Keep the last published edition on a network interruption. */}finally{pending=false}}
  if(initial===undefined)void read();
  const id=window.setInterval(read,30000);window.addEventListener('focus',read);document.addEventListener('visibilitychange',read);
  return()=>{live=false;controller.abort();clearInterval(id);window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',read)};
 },[initial===undefined]);
 return current;
}

export function Congratulations({publication}:{publication:PublishedResults}){
 const first=champions(publication.standings),tie=first.length>1;
 return <>{tie?'نبارك للفرق ': 'نبارك لفريق '}{first.map((t,i)=><span key={t.id}>{i>0?' و':''}<strong>«{t.title}»</strong></span>)}{tie?' تقاسمها المركز الأول':' حصوله على المركز الأول'} بدرجة <bdi>{numberLabel(first[0].score)}</bdi> من {numberLabel(100)}.</>;
}
export function HomeWinner({publication}:{publication:PublishedResults}){
 return <><h1 id="bh-results-title">مبارك <em>للمركز الأول!</em></h1>
  <p><Congratulations publication={publication}/></p>
  <div className="bh-results-actions"><a href="/results" className="bh-button bh-primary"><Trophy size={18} aria-hidden="true"/>عرض الترتيب النهائي <ArrowLeft size={16} aria-hidden="true"/></a></div></>;
}
