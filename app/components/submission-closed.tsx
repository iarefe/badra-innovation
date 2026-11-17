'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Download,CalendarCheck2} from 'lucide-react';
import {closedIntakeText,engagementFocus,participationLinks,type IntakeSnapshot} from '@/lib/hackathon-intake';
import {chatSessionKey,type ChatSnapshot} from '@/lib/client-chat-session';
import {chatFields} from '@/lib/ai-challenge';
import {useChatRegistry} from './chat-session-context';
import type {Challenge} from '@/lib/challenges';
function backupText(s:Partial<ChatSnapshot>){
 const lines=(s.messages??[]).filter(m=>m.role==='user').map(m=>m.content);if(s.pending||s.text)lines.push(s.pending||s.text||'');
 return lines.join('\n\n');
}
export default function SubmissionClosed({window:w,actor,draft}:{window:IntakeSnapshot;actor?:string;draft?:Challenge}){
 const focus=engagementFocus(w),registry=useChatRegistry(),[backup,setBackup]=useState('');
 useEffect(()=>{if(!actor){setBackup('');return}
  const s=registry.get({participantKey:actor}).getSnapshot();
  let text=backupText(s);
  if(!text)try{const stored=JSON.parse(sessionStorage.getItem(chatSessionKey(actor))||'null');if(stored)text=backupText(stored)}catch{}
  if(draft&&(draft.title||draft.situation||draft.impact||draft.stakeholders)){const fields=Object.entries(draft).filter(([k,v])=>typeof v==='string'&&v.trim()&&k in chatFields).map(([k,v])=>chatFields[k as keyof typeof chatFields]+': '+v);text=[fields.join('\n\n'),text].filter(Boolean).join('\n\n')}
  setBackup(text);
 },[actor,draft,registry]);
 function download(){const url=URL.createObjectURL(new Blob(['\ufeff'+backup],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='مسودة-التحدي.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
 return <section className="intake-closed" aria-labelledby="intake-title"><span className="intake-icon"><CalendarCheck2 aria-hidden="true"/></span><span className="eyebrow">هاكاثون الابتكار الرقمي</span><h1 id="intake-title">{w.phase==='before'?'لم يبدأ استقبال التحديات بعد':'أُغلق استقبال التحديات الجديدة'}</h1>
  <p>{closedIntakeText(w).split('. ').slice(1).join('. ')}</p><div className="intake-actions">{focus==='vote-join'&&<a className="button orange" href={participationLinks.vote}>استعرض التحديات وصوّت <ArrowLeft size={17}/></a>}
  {focus!=='browse'?<a className={'button '+(focus==='join'?'orange':'ghost')} href={participationLinks.join}>اختر تحديًا للانضمام</a>:<a className="button dark" href="/challenges">استعرض التحديات <ArrowLeft size={17}/></a>}</div>
  {backup&&<button className="text-link" onClick={download}><Download size={15}/>تنزيل نسخة مما كتبته</button>}</section>;
}
