import {adminClient,authenticatedUser,deliver,koreaDate} from '../../../../lib/push-server';

export const runtime='nodejs';
export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
    const db=adminClient();
    const {data,error}=await db.from('notification_deliveries').insert({user_id:user.id,study_day:koreaDate(new Date()),kind:'test'}).select('user_id').single();
    if(error||!data)return Response.json({error:'알림 테스트는 하루 한 번만 할 수 있습니다.'},{status:429});
    const result=await deliver(user.id,'😊 알림 테스트','보건법규 심사관 알림 연결을 확인했어요.','/?tab=free');
    return Response.json({ok:true,...result});
  }catch(error){return Response.json({error:(error as Error).message},{status:500});}
}
