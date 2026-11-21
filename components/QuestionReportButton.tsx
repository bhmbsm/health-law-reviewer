'use client';
import {useRef,useState,type FormEvent} from 'react';
import {Flag} from 'lucide-react';
import AppDialog from './AppDialog';
import {supabase} from '../lib/supabase';
import {submitQuestionReport} from '../lib/question-reports';
import {createUUID} from '../lib/uuid';
import type {Case} from '../lib/cases';

export default function QuestionReportButton({item,disabled=false}:{item:Case;disabled?:boolean}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const requestId=useRef(''),lock=useRef(false);
 async function send(event:FormEvent){
  event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   if(!supabase)throw Error('신고 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
   requestId.current ||= createUUID();
   await submitQuestionReport(supabase,item,message,requestId.current);
   setSent(true);setMessage('');
  }catch(error){setError((error as Error).message);}finally{setBusy(false);lock.current=false;}
 }
 return <>
  <button type="button" className="report-button" disabled={disabled} onClick={()=>setOpen(true)}><Flag size={16} aria-hidden="true"/>문제 신고</button>
  {open&&<AppDialog title="문제 신고" onClose={()=>{if(!busy)setOpen(false);}}>
   {sent?<div role="status"><p>관리자에게 신고를 전달했습니다.</p><p>신고 내용은 관리자만 확인할 수 있습니다.</p><button className="primary" onClick={()=>setOpen(false)}>확인</button></div>:<>
    <p><strong>{item.law} {item.article}</strong></p><p>이상한 부분을 적어 주세요. 현재 문제·정답·해설도 함께 전달되며, 신고 내용은 관리자만 확인할 수 있습니다.</p>
    <form onSubmit={send} className="dialog-form"><label>신고 내용<textarea autoFocus required maxLength={2000} rows={6} disabled={busy} value={message} onChange={e=>setMessage(e.target.value)} placeholder="예: 제시된 조건과 정답이 맞지 않는 것 같습니다."/></label><small>{message.length} / 2,000자</small>
     {error&&<p className="dialog-error" role="alert">{error}</p>}
     <button type="submit" className="primary" disabled={busy||!message.trim()}>{busy?'전송 중…':'관리자에게 신고 보내기'}</button>
    </form>
   </>}
  </AppDialog>}
 </>;
}
