export type StudyUser = { id: string; is_anonymous?: boolean };

/** Only registered identities may load or save account-owned records. */
export function isRegisteredStudyUser(user: StudyUser | null | undefined): user is StudyUser {
  return !!user?.id && user.is_anonymous !== true;
}
