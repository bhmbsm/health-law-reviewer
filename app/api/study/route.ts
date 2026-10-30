import { privateStudyHeaders, requireStudyMember } from '../../../lib/study-access-server';

export async function GET(request: Request) {
  try {
    const access = await requireStudyMember(request);
    if (access.response) return access.response;
    return Response.json({ message: '학습 기록은 로그인한 계정에 저장됩니다.' }, { headers: privateStudyHeaders });
  } catch {
    return Response.json({ error: '로그인 상태를 확인하지 못했습니다.' }, { status: 503, headers: privateStudyHeaders });
  }
}
