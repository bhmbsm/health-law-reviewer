import {requireStudyMember,privateStudyHeaders} from '../../../lib/study-access-server';
export async function GET(request:Request){
 const access=await requireStudyMember(request);
 if(access.response)return access.response;
 return Response.json({ok:true},{headers:privateStudyHeaders});
}
