'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {EmployeeReach} from '@/lib/employee-reach';
import type {ParticipationData} from '@/lib/admin-dashboard';
import type {ProspectiveEmployee} from '@/lib/prospective-employees';
type Resource='participation'|'prospects'|'reach';
type ReadState<T>={data:T|null;error:string;loading:boolean};
const initial=<T,>():ReadState<T>=>({data:null,error:'',loading:true});
// Instantiated only while an authenticated manager is on the admin page. No private browser cache.
export function useAdminDirectory(onAccessLost:()=>void){
 const [participation,setParticipation]=useState<ReadState<ParticipationData>>(initial);
 const [reach,setReach]=useState<ReadState<EmployeeReach>>(initial);
 const [prospects,setProspects]=useState<ReadState<ProspectiveEmployee[]>>(initial);
 const mounted=useRef(false);
 const requests=useRef<Partial<Record<Resource,AbortController>>>({}),lost=useRef(onAccessLost);lost.current=onAccessLost;
 const read=useCallback(async(kind:Resource)=>{
  if(!mounted.current)return;requests.current[kind]?.abort();const controller=new AbortController();requests.current[kind]=controller;
  if(kind==='participation')setParticipation(s=>({...s,error:'',loading:true}));else if(kind==='reach')setReach(s=>({...s,error:'',loading:true}));else setProspects(s=>({...s,error:'',loading:true}));
  try{const r=await fetch(kind==='participation'?'/api/participation':kind==='reach'?'/api/admin/employee-reach':'/api/prospective-employees',{cache:'no-store',signal:controller.signal});const d=await r.json() as {error?:string};if(controller.signal.aborted)return;
   if(!r.ok){if(r.status===401||r.status===403)lost.current();throw Error(d.error||'تعذّر تحميل البيانات.')}
   if(kind==='participation')setParticipation({data:d as ParticipationData,error:'',loading:false});else if(kind==='reach')setReach({data:d as EmployeeReach,error:'',loading:false});else setProspects({data:(d as {prospects:ProspectiveEmployee[]}).prospects,error:'',loading:false});
  }catch(e){if(controller.signal.aborted)return;const error=e instanceof Error?e.message:'تعذّر تحميل البيانات.';if(kind==='participation')setParticipation({data:null,error,loading:false});else if(kind==='reach')setReach({data:null,error,loading:false});else setProspects({data:null,error,loading:false})}
 },[]);
 const reload=useCallback(async(scope:Resource|'both'='both')=>{if(scope==='both')await Promise.all([read('participation'),read('prospects'),read('reach')]);else if(scope==='reach')await read(scope);else await Promise.all([read(scope),read('reach')])},[read]);
 useEffect(()=>{mounted.current=true;void reload();return()=>{mounted.current=false;Object.values(requests.current).forEach(c=>c.abort())}},[reload]);
 return {participation,prospects,reach,reload};
}
export type AdminDirectory=ReturnType<typeof useAdminDirectory>;
