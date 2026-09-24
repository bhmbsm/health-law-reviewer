import {createClient} from '@supabase/supabase-js';
import {sendWebPush,validatePushEndpoint,type PushSubscriptionData} from './web-push';

export function adminClient(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error('Supabase 서버 설정이 없습니다.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function authenticatedUser(request:Request){
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return null;
  const {data,error}=await adminClient().auth.getUser(token);
  return error?null:data.user;
}

export function parseSubscription(value:unknown):PushSubscriptionData{
  if(!value||typeof value!=='object')throw Error('푸시 구독 정보가 필요합니다.');
  const data=value as Partial<PushSubscriptionData>;
  if(typeof data.endpoint!=='string'||data.endpoint.length>2048||
    typeof data.keys?.p256dh!=='string'||typeof data.keys?.auth!=='string'||
    !/^[A-Za-z0-9_-]+$/.test(data.keys.p256dh)||!/^[A-Za-z0-9_-]+$/.test(data.keys.auth))throw Error('푸시 구독 형식이 잘못되었습니다.');
  validatePushEndpoint(data.endpoint);
  if(Buffer.from(data.keys.p256dh,'base64url').length!==65||Buffer.from(data.keys.auth,'base64url').length!==16)throw Error('푸시 구독 키가 잘못되었습니다.');
  return data as PushSubscriptionData;
}

export async function deliver(userId:string, title:string,body:string,url:string){
  const db=adminClient();
  const {error:inboxError}=await db.from('in_app_notifications').insert({user_id:userId,title,body,url});
  if(inboxError)throw inboxError;
  const {data:subscriptions,error}=await db.from('push_subscriptions').select('endpoint,p256dh,auth_secret').eq('user_id',userId);
  if(error)throw error;
  let sent=0;
  for(const row of subscriptions||[]){
    try{
      await sendWebPush({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_secret}},{title,body,url});
      sent++;
    }catch(reason){
      if([404,410].includes((reason as {status?:number}).status||0))await db.from('push_subscriptions').delete().eq('endpoint',row.endpoint).eq('user_id',userId);
    }
  }
  return {sent,inbox:true};
}

export const koreaDate=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
