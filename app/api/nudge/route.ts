import {adminClient,authenticatedUser,pushToDevices} from '../../../lib/push-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(!user)return reply({error:'로그인 후 이용해 주세요.'},401);
    const {data,error}=await adminClient().rpc('nudge_dashboard',{p_user_id:user.id});
    if(error)throw error;
    return reply(data);
  }catch{
    console.error('Nudge dashboard query failed');
    return reply({error:'친구 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
}

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(!user)return reply({error:'로그인 후 이용해 주세요.'},401);
    const body=await request.json().catch(()=>null);
    if(typeof body?.recipientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.recipientId))return reply({error:'친구를 다시 선택해 주세요.'},400);
    const {data,error}=await adminClient().rpc('send_friend_nudge',{p_sender:user.id,p_recipient:body.recipientId});
    if(error)throw error;
    if(data.error)return reply({error:data.error},409);
    // The inbox is committed even when OS notifications are disabled or unreachable.
    let sent=0;
    try{sent=await pushToDevices(body.recipientId,data.title,data.body,'/?screen=today');}
    catch{console.error('Nudge push unavailable; inbox delivery retained');}
    return reply({sent,inbox:true});
  }catch{
    console.error('Nudge send transaction failed');
    return reply({error:'찌르기를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
  }
}
