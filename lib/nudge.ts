import {supabase} from './supabase';
import {requestNudgeJSON} from './nudge-request';

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
  let sessionResult;
  try{sessionResult=await supabase.auth.getSession();}
  catch{throw Error('로그인 서버 연결이 잠시 끊겼습니다. 인터넷 연결을 확인한 뒤 친구 알림을 다시 연결하세요.');}
  const {data,error}=sessionResult;
  if(error||!data.session)throw Error('로그인 후 이용해 주세요.');
  return requestNudgeJSON(method,data.session.access_token,recipientId,signal);
}
export const loadNudgeDashboard=(signal?:AbortSignal):Promise<NudgeDashboard>=>request('GET',undefined,signal);
export const sendNudge=(recipientId:string):Promise<{sent:number;inbox:boolean}>=>request('POST',recipientId);
