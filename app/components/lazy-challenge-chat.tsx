'use client';
import {Component,lazy,Suspense,type ComponentProps,type ReactNode} from 'react';
import type Chat from './challenge-chat';
const ChatView=lazy(()=>import('./challenge-chat'));
class ChatBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<div className="notice" role="alert"><p>تعذّر فتح المحادثة. النص المحفوظ في هذا التبويب يبقى عند إعادة التحميل.</p><button className="text-link" onClick={()=>location.reload()}>أعد تحميل الصفحة</button></div>:this.props.children}
}
export default function LazyChallengeChat(props:ComponentProps<typeof Chat>){return <ChatBoundary><Suspense fallback={<div className="assistant-opening" role="status">نفتح مساحة المحادثة…</div>}><ChatView {...props}/></Suspense></ChatBoundary>}
