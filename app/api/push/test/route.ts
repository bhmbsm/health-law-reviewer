import {adminClient,authenticatedUser,deliver,koreaDate} from '../../../../lib/push-server';

export const runtime='nodejs';
export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(!user)return Response.json({error:'로그인이 필요합니다.'},{status:401});
    const db=adminClient();
    const {mood='happy'}=await request.json().catch(()=>({mood:'happy'})) as {mood?:string};
    const messages:Record<string,string>={happy:'😊 알림 테스트',neutral:'😐 알림 테스트',sad:'😣 알림 테스트'};
    if(!messages[mood])return Response.json({error:'지원하지 않는 알림 종류입니다.'},{status:400});
    const midnight=new Date(koreaDate(new Date())+'T00:00:00+09:00').toISOString();
    const {data:recent,count,error:historyError}=await db.from('in_app_notifications').select('created_at',{count:'exact'}).eq('user_id',user.id).like('title','%알림 테스트').gte('created_at',midnight).order('created_at',{ascending:false}).limit(1);
    if(historyError)throw historyError;
    if((count||0)>=10||recent?.[0]&&Date.now()-Date.parse(recent[0].created_at)<30000)return Response.json({error:'잠시 후 다시 테스트해 주세요. 하루 최대 10회까지 가능합니다.'},{status:429});
    const result=await deliver(user.id,messages[mood],'보건법규 심사관 알림 연결을 확인했어요.','/?tab=free');
    return Response.json({ok:true,...result});
  }catch(error){return Response.json({error:(error as Error).message},{status:500});}
}
