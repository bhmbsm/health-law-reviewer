'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Badge, BadgeCheck, Brain, Crown, Gem, Handshake, Landmark, Medal, Shield, ShieldCheck, Sparkles, Star, Trophy, Zap } from 'lucide-react';
import type { Case } from '../../lib/cases';
import { applyStoryResult, initialStoryStats, lawSearchUrl, randomChapterCases, storyChapters, type StoryStats } from '../../lib/story';
import { loadStoryProgress, saveStoryProgress, type StoryProgress } from '../../lib/story-progress';

type Props = { bank: Case[]; onExit: () => void; experience: number; storyAttemptedCaseIds: string[]; onAttempt: (item: Case, choice: boolean, correct: boolean, duration: number) => Promise<void> };
type Stage = 'campaign' | 'briefing' | 'case' | 'incident' | 'summary';

const rankIcons = { badge: Badge, shield: Shield, badgeCheck: BadgeCheck, shieldCheck: ShieldCheck, medal: Medal, award: Award, star: Star, crown: Crown, trophy: Trophy, gem: Gem, landmark: Landmark, sparkles: Sparkles };

function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function CountUp({ from, to, prefix = '', suffix = '' }: { from: number; to: number; prefix?: string; suffix?: string }) {
  const [value, setValue] = useState(from);
  const currentValue = useRef(from);
  const previousFrom = useRef(from);
  useEffect(() => {
    let frame = 0;
    const startValue = previousFrom.current === from ? currentValue.current : from;
    previousFrom.current = from;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame = window.requestAnimationFrame(() => { currentValue.current = to; setValue(to); });
      return () => window.cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 320);
      const nextValue = Math.round(startValue + (to - startValue) * progress);
      currentValue.current = nextValue;
      setValue(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [from, to]);
  return <span>{prefix}{value}{suffix}</span>;
}

function AnimatedBar({ value }: { value: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const target = Math.max(0, Math.min(100, safeNumber(value)));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = window.requestAnimationFrame(() => setWidth(target));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setWidth(target));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <div className="story-exp-track" role="progressbar" aria-label="다음 승진까지 이번 챕터 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(safeNumber(value))}><span style={{ width: `${width}%` }} /></div>;
}

function FloatingDelta({ value }: { value: number }) {
  const previous = useRef(value);
  const [delta, setDelta] = useState(0);
  useEffect(() => {
    const next = safeNumber(value);
    const change = next - previous.current;
    previous.current = next;
    if (!change) return;
    setDelta(change);
    const timer = window.setTimeout(() => setDelta(0), 360);
    return () => window.clearTimeout(timer);
  }, [value]);
  if (!delta) return null;
  return <span key={`${value}-${delta}`} className={`story-floating-delta ${delta > 0 ? 'increase' : 'decrease'}`} aria-hidden="true">{delta > 0 ? '+' : '−'}{Math.abs(delta)}</span>;
}

export default function StoryCampaign({ bank, onExit, experience, storyAttemptedCaseIds, onAttempt }: Props) {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [chapter, setChapter] = useState(0);
  const [stage, setStage] = useState<Stage>('campaign');
  const [queue, setQueue] = useState<Case[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [incidentSeen, setIncidentSeen] = useState(false);
  const [chapterStartStats, setChapterStartStats] = useState<StoryStats>(initialStoryStats);
  const safeExperience = Math.max(0, safeNumber(experience));
  const [chapterStartExperience, setChapterStartExperience] = useState(safeExperience);
  const [chapterStartRank, setChapterStartRank] = useState(storyChapters[0].rank);
  const [chapterStartUnlockedThrough, setChapterStartUnlockedThrough] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [attemptedThisRun, setAttemptedThisRun] = useState<Set<string>>(new Set());
  const [chapterCaseCount, setChapterCaseCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const caseStartedAt = useRef(Date.now());
  useEffect(() => { const timer = window.setTimeout(() => setProgress(loadStoryProgress()), 0); return () => window.clearTimeout(timer); }, []);
  const selected = queue[index];
  const selectedDecision = selected && choice !== null ? (choice ? selected.answer : !selected.answer) : null;
  const available = useMemo(() => bank.filter((item) => storyChapters.some((entry) => entry.law && entry.law === item.law)), [bank]);
  function persist(next: StoryProgress) { setProgress(next); saveStoryProgress(next); }
  function startChapter(ch: number) {
    if (!progress || ch > progress.unlockedThrough) return;
    const attempted = new Set(storyAttemptedCaseIds);
    const cases = randomChapterCases(bank, ch, attempted);
    const wasCompleted = progress.completed.includes(ch);
    setChapterStartStats(progress.stats);
    setChapterStartExperience(safeExperience);
    setChapterStartRank(wasCompleted
      ? storyChapters[Math.max(0, Math.min(progress.unlockedThrough, storyChapters.length - 1))].rank
      : storyChapters[ch].rank);
    setChapterStartUnlockedThrough(progress.unlockedThrough);
    setAttemptedIds(attempted);
    setAttemptedThisRun(new Set());
    setChapterCaseCount(bank.filter((item) => item.law === storyChapters[ch].law).length);
    setChapter(ch); setQueue(cases); setIndex(0); setCorrectCount(0); setChoice(null); setIncidentSeen(false);
    caseStartedAt.current = Date.now();
    setStage('briefing');
  }
  async function submit(answer: boolean) {
    if (!selected || choice !== null || !progress || saving) return;
    const correct = selected.answer === answer;
    setSaving(true);
    try {
      await onAttempt(selected, answer, correct, Math.floor((Date.now() - caseStartedAt.current) / 1000));
      setChoice(correct);
      if (correct) setCorrectCount((n) => n + 1);
      setAttemptedIds((old) => new Set([...old, selected.id]));
      setAttemptedThisRun((old) => new Set([...old, selected.id]));
      persist({ ...progress, stats: applyStoryResult(progress.stats, correct) });
    } catch { /* 저장 오류는 상위 화면의 공통 오류 영역에 표시됩니다. */ }
    finally { setSaving(false); }
  }
  function nextCase() {
    if (saving) return;
    if (!incidentSeen && queue.length > 1 && index + 1 >= Math.ceil(queue.length / 2)) { setStage('incident'); return; }
    if (index + 1 < queue.length) { setIndex((n) => n + 1); setChoice(null); caseStartedAt.current = Date.now(); return; }
    const law = storyChapters[chapter].law;
    const pending = bank.filter((item) => item.law === law && !attemptedIds.has(item.id));
    if (pending.length) {
      setQueue(randomChapterCases(bank, chapter, attemptedIds)); setIndex(0); setChoice(null); setStage('briefing'); caseStartedAt.current = Date.now(); return;
    }
    finishChapter();
  }
  function finishChapter() {
    if (!progress) return;
    const completed = [...new Set([...progress.completed, chapter])];
    persist({ ...progress, completed, unlockedThrough: Math.max(progress.unlockedThrough, Math.min(11, chapter + 1)) });
    setStage('summary');
  }
  if (!progress) return <section className="panel" aria-busy="true">스토리 진행 상태를 불러오는 중…</section>;
  const active = storyChapters[Math.max(0, Math.min(chapter, storyChapters.length - 1))];
  const rankEntry = storyChapters[Math.max(0, Math.min(progress.unlockedThrough, storyChapters.length - 1))];
  const RankIcon = rankIcons[rankEntry.rankIcon];
  const promoted = progress.unlockedThrough > chapterStartUnlockedThrough;
  const currentJudgment = Math.max(0, Math.min(100, safeNumber(progress.stats.judgment, initialStoryStats.judgment)));
  const currentTrust = Math.max(0, Math.min(100, safeNumber(progress.stats.trust, initialStoryStats.trust)));
  const startJudgment = Math.max(0, Math.min(100, safeNumber(chapterStartStats.judgment, initialStoryStats.judgment)));
  const startTrust = Math.max(0, Math.min(100, safeNumber(chapterStartStats.trust, initialStoryStats.trust)));
  const currentExperience = safeExperience;
  const experienceGain = currentExperience - Math.max(0, safeNumber(chapterStartExperience));
  const judgmentChange = currentJudgment - startJudgment;
  const trustChange = currentTrust - startTrust;
  const chapterTotal = Math.max(0, Math.floor(safeNumber(chapterCaseCount)));
  const recordedIds = new Set([...attemptedIds, ...attemptedThisRun]);
  const chapterDone = Math.min(chapterTotal, bank.filter((item) => item.law === active.law && recordedIds.has(item.id)).length);
  const chapterProgress = chapterTotal ? Math.round(chapterDone / chapterTotal * 100) : 0;
  return <section className="story-campaign">
    <header className="story-top"><div><span className="eyebrow">스토리 캠페인</span><h1>심사관의 업무일지</h1></div><button className="secondary" onClick={onExit}>나가기</button></header>
    <div className="story-statusbar">
      <div className="story-status-items">
        <span className="story-status-item story-rank-stat" role="group" tabIndex={0} aria-label={`직급: ${rankEntry.rank}`} title={`직급: ${rankEntry.rank}`}><RankIcon aria-hidden="true"/><small className="story-status-label">직급</small><b>{rankEntry.rank}</b></span>
        <span className="story-status-item" role="group" tabIndex={0} aria-label={`경험치: ${currentExperience} EXP`} title="경험치"><Zap aria-hidden="true"/><b><CountUp from={chapterStartExperience} to={currentExperience}/><FloatingDelta value={currentExperience}/></b><small className="story-status-label">EXP</small></span>
        <span className="story-status-item" role="group" tabIndex={0} aria-label={`판단력: ${currentJudgment}`} title="판단력"><Brain aria-hidden="true"/><b><CountUp from={startJudgment} to={currentJudgment}/><FloatingDelta value={currentJudgment}/></b><small className="story-status-label">판단력</small></span>
        <span className="story-status-item" role="group" tabIndex={0} aria-label={`신뢰도: ${currentTrust}`} title="신뢰도"><Handshake aria-hidden="true"/><b><CountUp from={startTrust} to={currentTrust}/><FloatingDelta value={currentTrust}/></b><small className="story-status-label">신뢰도</small></span>
      </div>
      <div className="chapter-promotion-progress"><small>승진까지 <b>{chapterDone} / {chapterTotal}</b></small><AnimatedBar value={chapterProgress}/></div>
    </div>
    {stage === 'campaign' && <><p>챕터 상태는 플레이 가능 여부와 문항 준비 여부로 나뉩니다.</p><div className="story-chapters">{storyChapters.map((entry, i) => { const ready = !!entry.law && bank.some((item) => item.law === entry.law); const unlocked = i <= progress.unlockedThrough; const status = !ready ? '🕓 준비 중' : unlocked ? '🔓 플레이 가능' : '🔒 잠김'; const statusClass = !ready ? 'preparing' : unlocked ? 'unlocked' : 'locked'; return <article className={`panel story-chapter ${statusClass}`} key={entry.title}><div className="story-chapter-heading"><small>제{i + 1}장 · {entry.rank}</small><span className={`story-status ${statusClass}`}>{status}</span></div><h2>{entry.title}</h2><p>{ready ? `${entry.law} · ${bank.filter((item) => item.law === entry.law).length}개 문항` : '법령 및 문항 준비 중'}</p><button className="primary" disabled={!ready || !unlocked} onClick={() => startChapter(i)}>{!ready ? '준비 중' : unlocked ? (progress.completed.includes(i) ? '다시 플레이' : '시작') : '이전 챕터 완료 필요'}</button></article>; })}</div><p className="small">현재 출제 가능한 법령: {Array.from(new Set(available.map((item) => item.law))).join(' · ') || '없음'}</p></>}
    {stage === 'briefing' && <article className="panel story-paper"><small>제{chapter + 1}장 · {active.law}</small><h2>{active.title}</h2><p>{active.briefing}</p><p>이번 심사 묶음 {queue.length}개 · 승진까지 {chapterDone} / {chapterTotal}</p><button className="primary" onClick={() => { setStage(queue.length ? 'case' : 'summary'); caseStartedAt.current = Date.now(); }}>{queue.length ? '심사 시작' : '문항 없음 · 결산 보기'}</button></article>}
    {stage === 'case' && selected && <div className={`panel story-case-document ${choice !== null ? 'case-filed' : ''} ${choice === true ? 'case-correct' : choice === false ? 'case-incorrect' : ''}`}><small>{selected.law} · {selected.article} · {index + 1}/{queue.length}</small><h2>{selected.title}</h2><p>{selected.body}</p><ul>{selected.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{choice !== null && <><div className={`ink-stamp story-ink-stamp ${selectedDecision ? 'ink-green' : 'ink-red'}`} role="img" aria-label={choice ? '정답' : '오답'}>{selectedDecision ? '승인' : '반려'}</div><div className="story-feedback"><strong>{choice ? `정답입니다 · ${selected.answer ? '승인' : '반려'}` : `오답입니다 · 정답은 ${selected.answer ? '승인' : '반려'}`}</strong><p>{selected.explanation}</p><a href={selected.source || lawSearchUrl(selected.law)} target="_blank" rel="noreferrer">법전에서 {selected.law} {selected.article} 확인 ↗</a></div></>}<div className="decision-buttons"><button className="approve" disabled={choice !== null || saving} onClick={() => submit(true)}>승인</button><button className="reject" disabled={choice !== null || saving} onClick={() => submit(false)}>반려</button></div>{saving && <p role="status">심사 기록 저장 중…</p>}{choice !== null && <button className="primary" onClick={nextCase}>{index + 1 < queue.length ? '다음 사례' : incidentSeen ? '결산' : '중간 사건'}</button>}</div>}
    {stage === 'incident' && <article className="panel story-incident"><small>업무 중 잠시</small><h2>{active.incidentTitle}</h2><p>{active.incident}</p><button className="primary" onClick={() => { setIncidentSeen(true); setStage('case'); }}>사례 계속 심사</button></article>}
    {stage === 'summary' && <article className="panel story-summary">
      <div className="promotion-document">
        <span className="eyebrow">제{chapter + 1}장 결산</span>
        <h2>{promoted ? '승진 발령장' : '업무 완료 보고서'}</h2>
        <p>{active.title} 임무를 완료했습니다. {promoted ? '새 직급으로 발령합니다.' : '현재 직급을 유지합니다.'}</p>
        <div className="promotion-ranks"><span>이전 직급 <b>{chapterStartRank}</b></span><span>발령 직급 <b>{rankEntry.rank}</b></span></div>
        <div className={`promotion-seal ${promoted ? 'is-promotion' : ''}`}>{promoted ? '승진' : '완료'}<small>심사실 인사과</small></div>
      </div>
      <p>{attemptedThisRun.size ? `이번 심사 ${attemptedThisRun.size}건 중 ${Math.max(0, correctCount)}건 정답` : '출제 가능한 기존 문항이 없습니다.'}</p>
      <div className="summary-change-cards story-summary-stats">
        <section className="summary-change-card summary-rank-change"><small>직급</small><strong><RankIcon aria-hidden="true"/><span>{chapterStartRank} → {rankEntry.rank}</span></strong><p>{promoted ? '챕터 클리어 승진' : '직급 변동 없음'}</p></section>
        <section className="summary-change-card experience-change"><small>공통 EXP</small><strong><CountUp from={chapterStartExperience} to={currentExperience} suffix=" EXP"/></strong><p>{experienceGain > 0 ? '+' : ''}{experienceGain} EXP 변화</p></section>
        <section className="summary-change-card summary-judgment-change"><small>판단력</small><strong><CountUp from={startJudgment} to={currentJudgment}/></strong><p>{startJudgment} → {currentJudgment} · {judgmentChange > 0 ? '+' : ''}{judgmentChange}</p></section>
        <section className="summary-change-card trust-change"><small>신뢰도</small><strong><CountUp from={startTrust} to={currentTrust}/></strong><p>{startTrust} → {currentTrust} · {trustChange > 0 ? '+' : ''}{trustChange}</p></section>
      </div>
      <p>다음 챕터 잠금 해제</p><button className="primary" onClick={() => setStage('campaign')}>챕터 목록</button>
    </article>}
  </section>;
}
