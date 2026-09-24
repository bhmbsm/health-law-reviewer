import {adminClient,deliver,koreaDate} from '../../../../lib/push-server';

export const runtime='nodejs';
export async function GET(request:Request){
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:'Unauthorized'},{status:401});
  try{
    const db=adminClient(),now=new Date(),today=koreaDate(now);
    const midnight=new Date(today+'T00:00:00+09:00').toISOString();
    const tomorrow=new Date(Date.parse(midnight)+86400000).toISOString();
    const {data:users,error:usersError}=await db.from('profiles').select('id').limit(1000);
    if(usersError)throw usersError;
    let processed=0,delivered=0;
    for(const user of users||[]){
      const {error:claimed}=await db.from('notification_deliveries').insert({user_id:user.id,study_day:today,kind:'daily'});
      if(claimed)continue;
      processed++;
      const {count}=await db.from('attempts').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created',midnight).lt('created',tomorrow);
      const {data:last}=await db.from('attempts').select('created').eq('user_id',user.id).order('created',{ascending:false}).limit(1).maybeSingle();
      const inactive=!last||Date.now()-Date.parse(last.created)>3*86400000;
      const title=(count||0)>=5?'😊 오늘의 심사 5건을 완료했어요!':inactive?'😣 오래 쉬고 있어요. 오답 3건으로 다시 시작해 볼까요?':'😐 오늘 아직 심사 목표를 완료하지 않았어요.';
      const url=(count||0)>=5?'/?tab=story':'/?tab=free';
      const result=await deliver(user.id,title,'보건법규 심사관에서 오늘의 학습을 확인하세요.',url);
      delivered+=result.sent;
    }
    return Response.json({processed,delivered});
  }catch(error){return Response.json({error:(error as Error).message},{status:500});}
}
