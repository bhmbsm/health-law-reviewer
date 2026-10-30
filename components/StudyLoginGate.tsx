import { LOGIN_REQUIRED_MESSAGE } from '../lib/study-access';

export default function StudyLoginGate({ onLogin, busy = false }: { onLogin: () => void; busy?: boolean }) {
  return <section className="panel study-login-gate" aria-labelledby="study-login-title">
    <div className="eyebrow">회원 전용 학습</div>
    <h1 id="study-login-title">{LOGIN_REQUIRED_MESSAGE}</h1>
    <p>회원가입 후 로그인하면 모든 학습 모드를 이용할 수 있습니다.</p>
    <button className="primary" disabled={busy} onClick={onLogin}>로그인 · 회원가입</button>
  </section>;
}
