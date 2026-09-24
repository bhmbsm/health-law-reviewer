import {adminClient,authenticatedUser,parseSubscription} from '../../../../lib/push-server';

export const runtime='nodejs';
export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
    const subscription=parseSubscription(await request.json());
    const db=adminClient();
    const {error}=await db.from('push_subscriptions').upsert({endpoint:subscription.endpoint,user_id:user.id,p256dh:subscription.keys.p256dh,auth_secret:subscription.keys.auth,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
    if(error)throw error;
    return Response.json({ok:true});
  }catch(error){return Response.json({error:(error as Error).message},{status:400});}
}

export async function DELETE(request:Request){
  const user=await authenticatedUser(request);
  if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
  try{
    const endpoint=(await request.json() as {endpoint?:string}).endpoint;
    if(!endpoint)return Response.json({error:'푸시 주소가 필요합니다.'},{status:400});
    const {error}=await adminClient().from('push_subscriptions').delete().eq('endpoint',endpoint).eq('user_id',user.id);
    if(error)throw error;
    return Response.json({ok:true});
  }catch(error){return Response.json({error:(error as Error).message},{status:400});}
}
