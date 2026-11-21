import {packQuestionBanks} from '../../../lib/bank-transport';
import {requireStudyMember,privateStudyHeaders} from '../../../lib/study-access-server';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 const access=await requireStudyMember(request);
 if(access.response)return access.response;
 try{
  const {data,error}=await access.client.from('shared_cases').select('payload').abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return Response.json(packQuestionBanks(data||[]),{headers:privateStudyHeaders});
 }catch{return Response.json({error:'문제은행을 불러오지 못했습니다.'},{status:503,headers:privateStudyHeaders});}
}
