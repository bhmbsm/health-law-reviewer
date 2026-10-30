export const LOGIN_REQUIRED_MESSAGE = '로그인 후 사용 가능합니다';

export type StudyUser = { id: string; is_anonymous?: boolean };

/** Anonymous Supabase accounts also have the authenticated role. */
export function isRegisteredStudyUser(user: StudyUser | null | undefined): user is StudyUser {
  return !!user?.id && user.is_anonymous !== true;
}
