import {supabase} from './supabase';

const decodeKey=(key:string)=>Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(key.length/4)*4,'=')),c=>c.charCodeAt(0));

async function accessToken(){
  if(!supabase)throw Error('먼저 로그인해 주세요.');
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)throw Error('로그인 상태를 확인해 주세요.');
  return data.session.access_token;
}

async function registration(){
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('알림 연결이 지연됩니다. 앱을 다시 열어 주세요.')),10000)),
  ]);
}

export async function subscribeCurrentDevice(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('이 브라우저에서는 알림을 지원하지 않습니다.');
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if(!publicKey)throw Error('알림 서버 연결을 준비 중입니다.');
  const token=await accessToken();
  const worker=await registration();
  const existing=await worker.pushManager.getSubscription();
  const subscription=existing||await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey).buffer as ArrayBuffer});
  const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(subscription.toJSON())});
  if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.error||'알림 연결에 실패했습니다.');}
}

export async function unsubscribeCurrentDevice(){
  if(!('serviceWorker' in navigator))return;
  const worker=await navigator.serviceWorker.getRegistration();
  const subscription=await worker?.pushManager?.getSubscription();
  if(!subscription)return;
  try{
    const token=await accessToken();
    await fetch('/api/push/subscribe',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({endpoint:subscription.endpoint})});
  }finally{await subscription.unsubscribe();}
}

export async function sendTestPush(mood:'happy'|'neutral'|'sad'){
  const token=await accessToken();
  const response=await fetch('/api/push/test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({mood})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'알림 발송에 실패했습니다.');
  return result as {sent:number;inbox:boolean};
}
