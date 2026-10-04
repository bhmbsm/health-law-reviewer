'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BellRing, Send, X } from 'lucide-react';
import { DAILY_STUDY_TARGET, loadMockNudgeDashboard, sendMockNudge, type NudgeDashboard } from '../../lib/nudge';

type Props = { groupCode: string; completedToday: boolean; onGoToday: () => void; compact?: boolean };
const day = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

export default function NudgeScreen({ groupCode, completedToday, onGoToday, compact = false }: Props) {
  const [dashboard, setDashboard] = useState<NudgeDashboard | null>(null);
  const [today, setToday] = useState('');
  const [notice, setNotice] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDay = day();
      setToday(currentDay);
      setDashboard(loadMockNudgeDashboard(groupCode, currentDay));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [groupCode]);

  function send(friendId: string) {
    if (!completedToday || !today) return;
    const sentToday = sendMockNudge(friendId, today);
    setDashboard((current) => current ? { ...current, sentToday } : current);
    setNotice('예시 체험을 완료했습니다. 실제 친구에게 알림이 발송되지는 않습니다.');
  }

  if (!dashboard) return compact ? null : <section className="panel" aria-busy="true">Nudge 정보를 불러오는 중…</section>;
  if (compact) return <div className="nudge-home-bar">
    {dashboard.received.length > 0 && !dismissed && <div className="received-nudges compact-received" aria-label="받은 Nudge"><div className="compact-received-heading"><h2><BellRing size={16} /> 받은 Nudge <small>예시 데이터</small></h2><button className="nudge-dismiss" aria-label="받은 Nudge 숨기기" onClick={() => setDismissed(true)}><X size={17} /></button></div>{dashboard.received.map((nudge) => <button className="received-nudge" key={nudge.id} onClick={onGoToday}><span><b>{nudge.senderName}</b>님의 Nudge <small>{nudge.message}</small></span><ArrowRight size={16} /></button>)}</div>}
    {completedToday && <button className="primary nudge-open" onClick={() => window.dispatchEvent(new Event('open-nudge-screen'))}><Send size={15} /> 친구에게 Nudge 보내기</button>}
  </div>;
  return <section className={`nudge-screen${compact ? ' compact' : ''}`}>
    <div className="nudge-heading"><div><span className="eyebrow">FRIEND NUDGE</span>{!compact && <h1>친구에게 Nudge 보내기</h1>}</div><small>예시 데이터</small></div>
    {dashboard.received.length > 0 && <div className="received-nudges" aria-label="받은 Nudge"><h2><BellRing size={18} /> 받은 Nudge</h2>{dashboard.received.map((nudge) => <button className="received-nudge" key={nudge.id} onClick={onGoToday}><span><b>{nudge.senderName}</b>님의 Nudge <small>{nudge.message}</small></span><ArrowRight size={17} /></button>)}</div>}
    {!compact && <>
      {!groupCode ? <section className="panel nudge-empty"><h2>친구 그룹을 연결해 주세요</h2><p>같은 그룹의 친구에게 Nudge를 보낼 수 있습니다. 이 화면의 친구와 Nudge는 예시 데이터입니다.</p></section> : completedToday ? <section className="panel nudge-friends"><div className="section-heading"><h2>오늘 아직 학습하지 않은 친구</h2><span>같은 그룹 · {groupCode}</span></div>{dashboard.friends.filter((friend) => !friend.studiedToday).length ? dashboard.friends.filter((friend) => !friend.studiedToday).map((friend) => { const sent = dashboard.sentToday.includes(friend.id); return <div className="nudge-friend" key={friend.id}><div><strong>{friend.nickname}</strong><small>오늘 학습 전</small></div><button className={sent ? 'secondary' : 'primary'} disabled={sent} onClick={() => send(friend.id)}>{sent ? '보냄' : 'Nudge 보내기'}{!sent && <Send size={15} />}</button></div>; }) : <p>오늘 학습 전인 친구가 없습니다.</p>}</section> : <section className="panel nudge-empty"><h2>오늘 학습을 완료하면 Nudge를 보낼 수 있어요</h2><p>오늘의 학습 {DAILY_STUDY_TARGET}건을 마치면 같은 그룹 친구에게 응원을 보낼 수 있습니다.</p><button className="secondary" onClick={onGoToday}>오늘 학습으로 이동</button></section>}
      {notice && <p className="nudge-notice" role="status">{notice}</p>}
      <p className="small">이 화면은 예시 데이터로 동작합니다.</p>
    </>}
  </section>;
}
