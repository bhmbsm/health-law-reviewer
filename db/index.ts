/**
 * The initial Vercel release stores guest progress in the browser. A hosted
 * database will be added with the member-login release.
 */
export function getDb(): never {
  throw new Error("이 배포에서는 브라우저 저장소를 사용합니다.");
}
