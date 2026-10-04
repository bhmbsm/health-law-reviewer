'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { Case } from '../../lib/cases';
import { applyStoryResult, initialStoryStats, lawSearchUrl, randomChapterCases, storyChapters, type StoryStats } from '../../lib/story';
import { loadStoryProgress, saveStoryProgress, type StoryProgress } from '../../lib/story-progress';

type Props = { bank: Case[]; onExit: () => void };
type Stage = 'campaign' | 'briefing' | 'case' | 'incident' | 'summary';

function CountUp({ from, to, suffix = '' }: { from: number; to: number; suffix?: string }) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let frame = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = window.requestAnimationFrame(() => setValue(to));
      return () => window.cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 320);
      setValue(Math.round(from + (to - from) * progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [from, to]);
  return <b>{value}{suffix}</b>;
}

export default function StoryCampaign({ bank, onExit }: Props) {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [chapter, setChapter] = useState(0);
  const [stage, setStage] = useState<Stage>('campaign');
  const [queue, setQueue] = useState<Case[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [incidentSeen, setIncidentSeen] = useState(false);
  const [chapterStartStats, setChapterStartStats] = useState<StoryStats>(initialStoryStats);
  useEffect(() => { const timer = window.setTimeout(() => setProgress(loadStoryProgress()), 0); return () => window.clearTimeout(timer); }, []);
  const selected = queue[index];
  const selectedDecision = selected && choice !== null ? (choice ? selected.answer : !selected.answer) : null;
  const available = useMemo(() => bank.filter((item) => storyChapters.some((entry) => entry.law && entry.law === item.law)), [bank]);
  function persist(next: StoryProgress) { setProgress(next); saveStoryProgress(next); }
  function startChapter(ch: number) {
    if (!progress || ch > progress.unlockedThrough) return;
    const cases = randomChapterCases(bank, ch);
    setChapterStartStats(progress.stats);
    setChapter(ch); setQueue(cases); setIndex(0); setCorrectCount(0); setChoice(null); setIncidentSeen(false);
    setStage(cases.length ? 'briefing' : 'briefing');
  }
  function submit(answer: boolean) {
    if (!selected || choice !== null || !progress) return;
    const correct = selected.answer === answer;
    setChoice(correct);
    if (correct) setCorrectCount((n) => n + 1);
    persist({ ...progress, stats: applyStoryResult(progress.stats, correct) });
  }
  function nextCase() {
    if (!incidentSeen && queue.length > 1 && index + 1 >= Math.ceil(queue.length / 2)) { setStage('incident'); return; }
    if (index + 1 < queue.length) { setIndex((n) => n + 1); setChoice(null); return; }
    finishChapter();
  }
  function finishChapter() {
    if (!progress) return;
    const completed = [...new Set([...progress.completed, chapter])];
    persist({ ...progress, completed, unlockedThrough: Math.max(progress.unlockedThrough, Math.min(11, chapter + 1)) });
    setStage('summary');
  }
  if (!progress) return <section className="panel" aria-busy="true">스토리 진행 상태를 불러오는 중…</section>;
  const active = storyChapters[chapter];
  const promoted = progress.stats.rank !== chapterStartStats.rank;
  return <section className="story-campaign">
    <header className="story-top"><div><span className="eyebrow">HEALTH LAW CAMPAIGN</span><h1>심사관의 업무일지</h1></div><button className="secondary" onClick={onExit}>나가기</button></header>
    <div className="story-stats"><span><small>직급</small><b>{progress.stats.rank}</b></span><span><small>경험치</small><b>{progress.stats.experience} EXP</b></span><span><small>판단력</small><b>{progress.stats.judgment}</b></span><span><small>신뢰도</small><b>{progress.stats.trust}</b></span></div>
    {stage === 'campaign' && <><p>챕터 상태는 플레이 가능 여부와 문항 준비 여부로 나뉩니다.</p><div className="story-chapters">{storyChapters.map((entry, i) => { const ready = !!entry.law && bank.some((item) => item.law === entry.law); const unlocked = i <= progress.unlockedThrough; const status = !ready ? '🕓 준비 중' : unlocked ? '🔓 플레이 가능' : '🔒 잠김'; const statusClass = !ready ? 'preparing' : unlocked ? 'unlocked' : 'locked'; return <article className={`panel story-chapter ${statusClass}`} key={entry.title}><div className="story-chapter-heading"><small>CHAPTER {i + 1} · {entry.rank}</small><span className={`story-status ${statusClass}`}>{status}</span></div><h2>{entry.title}</h2><p>{ready ? `${entry.law} · ${bank.filter((item) => item.law === entry.law).length}개 문항` : '법령 및 문항 준비 중'}</p><button className="primary" disabled={!ready || !unlocked} onClick={() => startChapter(i)}>{!ready ? '준비 중' : unlocked ? (progress.completed.includes(i) ? '다시 플레이' : '시작') : '이전 챕터 완료 필요'}</button></article>; })}</div><p className="small">현재 출제 가능한 법령: {Array.from(new Set(available.map((item) => item.law))).join(' · ') || '없음'}</p></>}
    {stage === 'briefing' && <article className="panel story-paper"><small>CHAPTER {chapter + 1} · {active.law}</small><h2>{active.title}</h2><p>{active.briefing}</p><p>이 챕터의 기존 문항 {queue.length}개를 무작위 순서로 심사합니다.</p><button className="primary" onClick={() => setStage(queue.length ? 'case' : 'summary')}>{queue.length ? '심사 시작' : '문항 없음 · 결산 보기'}</button></article>}
    {stage === 'case' && selected && <div className={`panel story-case-document ${choice !== null ? 'case-filed' : ''} ${choice === true ? 'case-correct' : choice === false ? 'case-incorrect' : ''}`}><small>{selected.law} · {selected.article} · {index + 1}/{queue.length}</small><h2>{selected.title}</h2><p>{selected.body}</p><ul>{selected.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{choice !== null && <><div className={`ink-stamp story-ink-stamp ${selectedDecision ? 'ink-green' : 'ink-red'}`} aria-hidden="true">{selectedDecision ? '승인' : '반려'}</div><span className={`decision-verdict story-verdict ${choice?'is-correct':'is-incorrect'}`} role="img" aria-label={choice?'정답':'오답'}>{choice?<Check size={18}/>:<X size={18}/>}</span><div className="story-feedback"><strong>{choice ? '정답입니다' : '오답입니다'} · 정답은 {selected.answer ? '승인' : '반려'}</strong><p>{selected.explanation}</p><a href={selected.source || lawSearchUrl(selected.law)} target="_blank" rel="noreferrer">법전에서 {selected.law} {selected.article} 확인 ↗</a></div></>}<div className="decision-buttons"><button className="approve" disabled={choice !== null} onClick={() => submit(true)}>승인</button><button className="reject" disabled={choice !== null} onClick={() => submit(false)}>반려</button></div>{choice !== null && <button className="primary" onClick={nextCase}>{index + 1 < queue.length ? '다음 사례' : incidentSeen ? '결산' : '중간 사건'}</button>}</div>}
    {stage === 'incident' && <article className="panel"><small>중간 사건 · 정답 무관</small><h2>{active.title}</h2><p>{active.incident}</p><p>캐릭터의 대사와 사건은 정답 및 능력치 판정에 영향을 주지 않습니다.</p><button className="primary" onClick={() => { setIncidentSeen(true); setStage('case'); }}>사례 계속 심사</button></article>}
    {stage === 'summary' && <article className="panel story-summary">
      <div className="promotion-document">
        <span className="eyebrow">인사 발령 · CHAPTER {chapter + 1}</span>
        <h2>승진 발령장</h2>
        <p>{active.title} 임무를 완료했습니다. {promoted ? '새 직급으로 발령합니다.' : '현재 직급을 유지합니다.'}</p>
        <div className="promotion-ranks"><span>이전 직급 <b>{chapterStartStats.rank}</b></span><span>발령 직급 <b>{progress.stats.rank}</b></span></div>
        <div className={`promotion-seal ${promoted ? 'is-promotion' : ''}`}>{promoted ? '승진' : '완료'}<small>심사실 인사과</small></div>
      </div>
      <p>{queue.length ? `${queue.length}건 중 ${correctCount}건 정답` : '출제 가능한 기존 문항이 없습니다.'}</p>
      <div className="story-stats summary-stats"><span><small>직급</small><b>{progress.stats.rank}</b></span><span><small>경험치</small><CountUp from={chapterStartStats.experience} to={progress.stats.experience} suffix=" EXP" /></span><span><small>판단력</small><CountUp from={chapterStartStats.judgment} to={progress.stats.judgment} /></span><span><small>신뢰도</small><CountUp from={chapterStartStats.trust} to={progress.stats.trust} /></span></div>
      <p>다음 챕터 잠금 해제</p><button className="primary" onClick={() => setStage('campaign')}>챕터 목록</button>
    </article>}
  </section>;
}
