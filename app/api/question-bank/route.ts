import {packQuestionBanks} from '../../../lib/bank-transport';
import {privateStudyHeaders,requireStudyMember} from '../../../lib/study-access-server';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const access=await requireStudyMember(request);
  if(access.response)return access.response;
  const client=access.client!;
  const {data,error}=await client.from('shared_cases').select('payload').abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return Response.json(packQuestionBanks(data||[]),{headers:privateStudyHeaders});
 }catch{return Response.json({error:'문제은행을 불러오지 못했습니다.'},{status:503,headers:privateStudyHeaders});}
}
