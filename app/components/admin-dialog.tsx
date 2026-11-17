'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export default function AdminDialog({open,title,busy,close,children}:{open:boolean;title:string;busy:boolean;close:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const d=ref.current;if(!d)return;if(open&&!d.open)d.showModal();if(!open&&d.open)d.close()},[open]);
 return <dialog className="ba-dialog" ref={ref} aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)close()}}><div className="ba-dialog-head"><h2 id={id}>{title}</h2><button type="button" className="ba-btn ba-icon" disabled={busy} onClick={close} aria-label="إغلاق"><X size={17}/></button></div>{children}</dialog>;
}
