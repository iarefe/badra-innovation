'use client';
import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {ChatSessionRegistry,type SessionOptions} from '@/lib/client-chat-session';
const Context=createContext<ChatSessionRegistry|null>(null);
export function ChatSessionProvider({children,registry:provided}:{children:ReactNode;registry?:ChatSessionRegistry}){
 const [registry]=useState(()=>provided||new ChatSessionRegistry());
 const generation=useRef(0);
 useEffect(()=>{const current=++generation.current;return()=>{queueMicrotask(()=>{if(generation.current===current)registry.dispose()})}},[registry]);
 return <Context.Provider value={registry}>{children}</Context.Provider>;
}
export function useChatRegistry(){const registry=useContext(Context);if(!registry)throw Error('ChatSessionProvider is required');return registry}
export function useChatSession(options:SessionOptions){
 const registry=useChatRegistry(),session=registry.get(options);
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
 useEffect(()=>{session.initialize()},[session]);
 return {session,...state};
}
