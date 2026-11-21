'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export default function AppDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=ref.current;dialog?.showModal();
  return()=>dialog?.close();
 },[]);
 return createPortal(<dialog ref={ref} className="app-dialog" aria-label={title} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>event.stopPropagation()}>
  <div className="dialog-heading"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="닫기">닫기</button></div>
  {children}
 </dialog>,document.body);
}
