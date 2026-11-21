export type StudyUser = { id: string; is_anonymous?: boolean; email_confirmed_at?: string | null };
export const LOGIN_REQUIRED_MESSAGE='회원가입과 이메일 인증을 완료한 뒤 로그인해야 문제를 풀 수 있습니다.';
export const EMAIL_CONFIRMATION_GUIDE='입력한 이메일의 메일함을 열고, 가입 인증 메일 안의 Confirm(이메일 인증) 링크를 눌러 주세요. 인증을 마친 뒤 이 앱에서 로그인하면 문제를 풀 수 있습니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.';

/** Only registered identities may load or save account-owned records. */
export function isRegisteredStudyUser(user: StudyUser | null | undefined): user is StudyUser {
  return !!user?.id && user.is_anonymous !== true && !!user.email_confirmed_at;
}
