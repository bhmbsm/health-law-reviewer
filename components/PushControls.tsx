'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

const decodeKey=(key:string)=>Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(key.length/4)*4,'=')),c=>c.charCodeAt(0));
async function token(){const {data}=await supabase!.auth.getSession();return data.session?.access_token;}

export async function unsubscribeCurrentDevice(){
  if(!supabase||!('serviceWorker' in navigator))return;
  const registration=await navigator.serviceWorker.getRegistration();
  if(!registration)return;
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription)return;
  const accessToken=await token();
  if(accessToken)await fetch('/api/push/subscribe',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({endpoint:subscription.endpoint})});
  await subscription.unsubscribe();
}

type Notice={id:number;title:string;body:string;url:string};
export default function PushControls({userId}:{userId:string|null}){
  const [status,setStatus]=useState(''),[enabled,setEnabled]=useState(false),[notices,setNotices]=useState<Notice[]>([]);
  useEffect(()=>{
    if(!userId||!supabase){setNotices([]);return;}
    supabase.from('in_app_notifications').select('id,title,body,url').eq('user_id',userId).order('id',{ascending:false}).limit(5).then(({data})=>setNotices((data||[]) as Notice[]));
    if('Notification' in window&&Notification.permission==='granted'&&'serviceWorker' in navigator){navigator.serviceWorker.getRegistration().then(r=>r?.pushManager.getSubscription()).then(s=>setEnabled(!!s)).catch(()=>setEnabled(false));}
  },[userId]);
  async function subscribe(){
    try{
      if(!supabase||!userId)throw Error('먼저 로그인해 주세요.');
      if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('이 브라우저에서는 웹 푸시를 지원하지 않습니다.');
      const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if(!publicKey)throw Error('푸시 공개키가 배포 환경에 설정되지 않았습니다.');
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw Error('Android 설정에서 이 앱의 알림 권한을 허용해 주세요.');
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(publicKey)});
      const accessToken=await token();
      if(!accessToken)throw Error('로그인 세션이 만료되었습니다.');
      const response=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify(subscription.toJSON())});
      const result=await response.json();if(!response.ok)throw Error(result.error||'푸시 구독 저장에 실패했습니다.');
      setEnabled(true);setStatus('알림을 연결했어요. 테스트 알림을 보내 확인해 보세요.');
    }catch(error){setStatus((error as Error).message);}
  }
  async function test(){
    try{
      const accessToken=await token();if(!accessToken)throw Error('로그인이 필요합니다.');
      const response=await fetch('/api/push/test',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`}});
      const result=await response.json();if(!response.ok)throw Error(result.error||'알림 발송에 실패했습니다.');
      setStatus(result.sent?'테스트 푸시를 발송했어요. Android 알림창을 확인해 주세요.':'앱 안 알림에 저장했어요. 푸시 구독과 배포 키를 확인해 주세요.');
      if(supabase&&userId){const {data}=await supabase.from('in_app_notifications').select('id,title,body,url').eq('user_id',userId).order('id',{ascending:false}).limit(5);setNotices((data||[]) as Notice[]);}
    }catch(error){setStatus((error as Error).message);}
  }
  return <div style={{display:'inline-flex',flexDirection:'column',gap:4,alignItems:'flex-start'}}>
    <div style={{display:'flex',gap:4}}><button className="install-button" onClick={subscribe} disabled={!userId}>{enabled?'알림 다시 연결':'알림 받기'}</button>{enabled&&<button className="install-button" onClick={test}>알림 테스트</button>}</div>
    {status&&<small role="status">{status}</small>}
    {notices.length>0&&<details><summary>앱 안 알림 {notices.length}건</summary>{notices.map(n=><p key={n.id}><a href={n.url}>{n.title}</a><br/>{n.body}</p>)}</details>}
  </div>;
}
