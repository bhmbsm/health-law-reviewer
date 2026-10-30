import { createClient } from '@supabase/supabase-js';
import { isRegisteredStudyUser, LOGIN_REQUIRED_MESSAGE } from './study-access';

export const privateStudyHeaders = { 'Cache-Control': 'no-store', Vary: 'Authorization' };

/** Validate the bearer with Auth before accessing any question or study data. */
export async function requireStudyMember(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const denied = () => Response.json({ error: LOGIN_REQUIRED_MESSAGE }, { status: 401, headers: privateStudyHeaders });
  if (!token) return { response: denied() };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response: Response.json({ error: '회원 서버 설정이 없습니다.' }, { status: 503, headers: privateStudyHeaders }) };
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !isRegisteredStudyUser(data.user)) return { response: denied() };
  return { client, user: data.user };
}
