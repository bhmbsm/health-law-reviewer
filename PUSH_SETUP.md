# 로그인 및 Android PWA 알림 배포 점검

1. Supabase SQL Editor에서 기존 `schema.sql`, `admin-migration.sql`, `20260924_auth_progress.sql` 적용 상태를 확인하고 `20260924_push.sql`을 실행한다.
2. Vercel 환경변수를 등록한다. 값은 GitHub에 넣지 않는다.
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 브라우저용 공개 키
   - `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용 키
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 및 `VAPID_PUBLIC_KEY`: 동일한 P-256 공개 키
   - `VAPID_PRIVATE_KEY`: 대응하는 비밀 키
   - `VAPID_SUBJECT`: `mailto:관리자이메일` 형식
   - `CRON_SECRET`: Vercel Cron 인증용 임의 비밀 값
3. VAPID 키 한 쌍을 생성한다. 아래 명령의 출력 중 비밀 키는 Vercel 서버 환경변수에만 넣는다.

```bash
node -e "const {createECDH}=require('node:crypto');const k=createECDH('prime256v1');k.generateKeys();console.log('PUBLIC='+k.getPublicKey().toString('base64url'));console.log('PRIVATE='+k.getPrivateKey().toString('base64url'))"
```

4. Vercel에 이 브랜치를 미리보기로 배포한다. Android Chrome에서 HTTPS 주소를 열어 새 계정 가입 → 이메일 인증(필요 시) → 로그인 → 새로고침 유지 → 로그아웃을 확인한다.
5. 다시 로그인한 뒤 **알림 받기**를 탭하고 Android의 앱 알림 권한을 허용한다. **알림 테스트**를 순서대로 탭하여 OS 알림창에 😊, 😐, 😣 메시지가 표시되는지 확인한다. 각 발송 사이 30초 이상 기다린다. 앱 안 알림 목록에도 기록이 남는다.
6. 설치된 PWA에서도 같은 테스트를 하고 알림을 눌러 자유 심사 화면으로 이동하는지 확인한다. 배포 후 서비스 워커를 갱신하려면 앱을 완전히 닫고 다시 연다.
7. Vercel Cron은 매일 12:00 UTC(한국 시간 21:00)에 실행된다. 하루 학습 5건 이상 😊, 최근 3일 이상 휴식 😣, 나머지 😐로 분류한다.

로그인에 실패하면 브라우저 오류 문구와 Supabase Auth 로그를 함께 확인한다. 구독 저장은 되지만 OS 알림이 오지 않으면 `/api/push/test` 응답의 `sent` 값과 Vercel 서버 로그를 확인한다. 테스트 발송은 계정당 한국 날짜 기준 하루 최대 10회이며 최소 30초 간격이다.
