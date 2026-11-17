import {createClient} from '@supabase/supabase-js';
import {packQuestionBanks} from '../../../lib/bank-transport';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
// The bank is public course content shared by every student. Let the CDN answer repeat loads
// instantly: fresh for 60s, then served stale for up to 10 more minutes while it refetches.
// Browsers always revalidate with the CDN, and admins bypass it with ?fresh= after an upload.
const cachedHeaders={'Cache-Control':'public, max-age=0, s-maxage=60, stale-while-revalidate=600'};
/** Read only the educational payload column. Account records keep their own RLS. */
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return Response.json({error:'문제은행 서버 설정이 없습니다.'},{status:503,headers});
 try{
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.from('shared_cases').select('payload').abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return Response.json(packQuestionBanks(data||[]),{headers:cachedHeaders});
 }catch{return Response.json({error:'문제은행을 불러오지 못했습니다.'},{status:503,headers});}
}
