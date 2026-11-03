export async function GET(){
 return Response.json({message:'로그인 없이 학습할 수 있습니다. 게스트 기록은 이 브라우저에 저장됩니다.'},{headers:{'Cache-Control':'no-store'}});
}
