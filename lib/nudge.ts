import {supabase} from './supabase';

export const DAILY_STUDY_TARGET = 5;
export type NudgeFriend = {id:string; nickname:string; solvedToday:number};
export type NudgeRecord = {id:string; senderName:string; message:string; createdAt:string};
export type NudgeDashboard = {
  groupCode:string;
  completedToday:boolean;
  friends:NudgeFriend[];
  received:NudgeRecord[];
  sentToday:string[];
};

async function request(method:'GET'|'POST', recipientId?:string, signal?:AbortSignal){
  if(!supabase)throw Error('로그인 후 이용해 주세요.');
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)throw Error('로그인 후 이용해 주세요.');
  const response=await fetch('/api/nudge',{
    method, signal, cache:'no-store',
    headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},
    ...(method==='POST'?{body:JSON.stringify({recipientId})}:{}),
  });
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'친구 알림을 처리하지 못했습니다. 다시 시도해 주세요.');
  return result;
}
export const loadNudgeDashboard=(signal?:AbortSignal):Promise<NudgeDashboard>=>request('GET',undefined,signal);
export const sendNudge=(recipientId:string):Promise<{sent:number;inbox:boolean}>=>request('POST',recipientId);
