import {createClient} from '@supabase/supabase-js';
import {packQuestionBanks} from '../../../lib/bank-transport';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
/** Read only the educational payload column. Account records keep their own RLS. */
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return Response.json({error:'문제은행 서버 설정이 없습니다.'},{status:503,headers});
 try{
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.from('shared_cases').select('payload').abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return Response.json(packQuestionBanks(data||[]),{headers});
 }catch{return Response.json({error:'문제은행을 불러오지 못했습니다.'},{status:503,headers});}
}
