'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Badge, BadgeCheck, Brain, Crown, Gem, Handshake, Landmark, Medal, Shield, ShieldCheck, Sparkles, Star, Trophy, Zap } from 'lucide-react';
import type { Case } from '../../lib/cases';

import StoryCaseDocument from './StoryCaseDocument';
import { applyStoryResult, initialStoryStats, randomChapterCases, storyChapters, availableChapterLaws, storyLaw, type StoryStats } from '../../lib/story';
import { loadStoryProgress, saveStoryProgress, reconcileStoryProgress, type StoryAttempt, type StoryProgress } from '../../lib/story-progress';

type Props = { userId: string | null; bank: Case[]; onExit: () => void; reviewCaseIds: ReadonlySet<string>; reviewSaving: boolean; onAddReview: (item: Case) => Promise<void>; experience: number; storyAttempts: StoryAttempt[]; onAttempt: (item: Case, choice: boolean | null, correct: boolean, duration: number) => Promise<void> };
type Stage = 'campaign' | 'briefing' | 'case' | 'incident' | 'summary';

const rankIcons = { badge: Badge, shield: Shield, badgeCheck: BadgeCheck, shieldCheck: ShieldCheck, medal: Medal, award: Award, star: Star, crown: Crown, trophy: Trophy, gem: Gem, landmark: Landmark, sparkles: Sparkles };
const currentTimestamp = () => Date.now();

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

export default function StoryCampaign({ userId, bank, onExit, experience, storyAttempts, onAttempt, reviewCaseIds, reviewSaving, onAddReview }: Props) {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [chapter, setChapter] = useState(0);
  const [stage, setStage] = useState<Stage>('campaign');
  const [queue, setQueue] = useState<Case[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [answerUnknown, setAnswerUnknown] = useState(false);
  const [answeredCaseId, setAnsweredCaseId] = useState<string | null>(null);
  const [incidentSeen, setIncidentSeen] = useState(false);
  const [chapterStartStats, setChapterStartStats] = useState<StoryStats>(initialStoryStats);
  const safeExperience = Math.max(0, safeNumber(experience));
  const [chapterStartExperience, setChapterStartExperience] = useState(safeExperience);
  const [chapterStartRank, setChapterStartRank] = useState(storyChapters[0].rank);
  const [chapterStartUnlockedThrough, setChapterStartUnlockedThrough] = useState(0);
  const [attemptedIds, setAttemptedIds] = useState<Set<string>>(new Set());
  const [chapterStartAnswered,setChapterStartAnswered]=useState(0);
  const [runAnswered,setRunAnswered]=useState(0);
  const [replay,setReplay]=useState(false);
  const [saving, setSaving] = useState(false);
  const caseStartedAt = useRef(0);
  useEffect(() => {
    const timer=window.setTimeout(()=>{
      const next=reconcileStoryProgress(loadStoryProgress(userId),storyAttempts);
      saveStoryProgress(next,userId);setProgress(next);
    },0);
    return()=>window.clearTimeout(timer);
  },[userId,storyAttempts]);
  useEffect(() => {
    if (stage !== 'case') return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [queue, index, stage]);
  const selected = queue[index];
  const visibleResult = selected && answeredCaseId === selected.id ? choice : null;
  const available = useMemo(() => bank.filter((item) => storyChapters.some((entry) => entry.laws.includes(storyLaw(item.law)))), [bank]);
  function persist(next: StoryProgress) { setProgress(next); saveStoryProgress(next, userId); }
  function startChapter(ch: number) {
    if (!progress || ch > progress.unlockedThrough) return;
    const history=storyAttempts.filter(attempt=>attempt.chapter===ch);
    const attempted=new Set(history.map(attempt=>attempt.case_id));
    const wasCompleted=progress.completed.includes(ch);
    const done=wasCompleted?0:Math.min(storyChapters[ch].target,history.length);
    const cases=randomChapterCases(bank,ch,attempted,12,done).map(item=>({...item,chapter:ch}));
    if(!cases.length)return;
    setReplay(wasCompleted);setChapterStartAnswered(done);setRunAnswered(0);
    setChapterStartStats(progress.stats);
    setChapterStartExperience(safeExperience);
    setChapterStartRank(wasCompleted
      ? storyChapters[Math.max(0, Math.min(progress.unlockedThrough, storyChapters.length - 1))].rank
      : storyChapters[ch].rank);
    setChapterStartUnlockedThrough(progress.unlockedThrough);
    setAttemptedIds(attempted);

    setChapter(ch); setQueue(cases); setIndex(0); setCorrectCount(0); setChoice(null); setAnsweredCaseId(null); setIncidentSeen(false);
    caseStartedAt.current = currentTimestamp();
    setStage('briefing');
  }
  async function submit(answer: boolean | null) {
    if (!selected || choice !== null || !progress || saving) return;
    const correct = answer !== null && selected.answer === answer;
    setSaving(true);
    try {
      await onAttempt(selected, answer, correct, Math.floor((Date.now() - caseStartedAt.current) / 1000));
      setAnswerUnknown(answer === null);
      setAnsweredCaseId(selected.id);
      setChoice(correct);
      if (correct) setCorrectCount((n) => n + 1);
      setRunAnswered(n=>n+1);
      setAttemptedIds((old) => new Set([...old, selected.id]));
      persist({ ...progress, stats: applyStoryResult(progress.stats, correct) });
    } catch { /* 저장 오류는 상위 화면의 공통 오류 영역에 표시됩니다. */ }
    finally { setSaving(false); }
  }
  function nextCase() {
    if(saving||choice===null)return;
    if(chapterDone>=chapterTotal){finishChapter();return;}
    if(!incidentSeen&&queue.length>1&&index+1<queue.length&&index+1>=Math.ceil(queue.length/2)){setStage('incident');return;}
    if(index+1<queue.length){setIndex(n=>n+1);setChoice(null);setAnsweredCaseId(null);caseStartedAt.current=currentTimestamp();return;}
    const nextQueue=randomChapterCases(bank,chapter,attemptedIds,12,chapterDone).map(item=>({...item,chapter}));
    setQueue(nextQueue);setIndex(0);setChoice(null);setAnsweredCaseId(null);setStage('briefing');caseStartedAt.current=currentTimestamp();
  }
  function continueAfterIncident() {
    setIncidentSeen(true);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setChoice(null); setAnsweredCaseId(null);
      caseStartedAt.current = currentTimestamp();
    }
    setStage('case');
  }
  function finishChapter() {
    if (!progress || chapterDone < chapterTotal) return;
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
  const chapterTotal=active.target;
  const chapterDone=Math.min(chapterTotal,replay?runAnswered:Math.max(storyAttempts.filter(attempt=>attempt.chapter===chapter).length,chapterStartAnswered+runAnswered));
  const chapterLaws=availableChapterLaws(bank,chapter);
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
    {stage === 'campaign' && <><p>챕터마다 50문항을 풀면 다음 직급과 챕터가 열립니다. 맞히지 못한 문제도 진행에 포함됩니다.</p><div className="story-chapters">{storyChapters.map((entry,i)=>{
      const laws=availableChapterLaws(bank,i),ready=laws.length>0,unlocked=i<=progress.unlockedThrough;
      const missing=entry.laws.filter(law=>!laws.includes(law));
      const done=Math.min(entry.target,storyAttempts.filter(attempt=>attempt.chapter===i).length);
      const status=!ready?'🕓 준비 중':progress.completed.includes(i)?'✓ 완료':unlocked?'🔓 플레이 가능':'🔒 잠김';
      const statusClass=!ready?'preparing':unlocked?'unlocked':'locked';
      return <article className={`panel story-chapter ${statusClass}`} key={entry.title}><div className="story-chapter-heading"><small>제{i+1}장 · {entry.rank}</small><span className={`story-status ${statusClass}`}>{status}</span></div><h2>{entry.title}</h2><p className="chapter-law-list">{ready?laws.join(' · '):'법령 및 문항 준비 중'}</p><p className="chapter-target">{done} / {entry.target}문항 · 완료 시 다음 챕터</p>{ready&&missing.length>0&&<small>등록된 법령으로 진행합니다. {missing.join(' · ')}은 문항 등록 후 함께 출제됩니다.</small>}<button className="primary" disabled={!ready||!unlocked} onClick={()=>startChapter(i)}>{!ready?'준비 중':unlocked?(progress.completed.includes(i)?'다시 플레이':'시작'):'이전 챕터 완료 필요'}</button></article>;
    })}</div><p className="small">현재 출제 가능한 법령: {Array.from(new Set(available.map(item=>storyLaw(item.law)))).join(' · ')||'없음'}</p></>}
    {stage === 'briefing' && <article className="panel story-paper"><small>제{chapter + 1}장 · {chapterLaws.join(' · ')}</small><h2>{active.title}</h2><p>{active.briefing}</p><p>이번 심사 묶음 {queue.length}개 · 승진까지 {chapterDone} / {chapterTotal}</p><button className="primary" onClick={() => { setStage(queue.length ? 'case' : 'campaign'); caseStartedAt.current = currentTimestamp(); }}>{queue.length ? '심사 시작' : '문항 없음 · 챕터 목록'}</button></article>}
    {stage === 'case' && selected && <StoryCaseDocument selected={selected} index={index} total={queue.length} result={visibleResult} unknownAnswer={answerUnknown} saving={saving||reviewSaving} inReview={reviewCaseIds.has(selected.id)} onAddReview={()=>void onAddReview(selected)} onAnswer={submit} onNext={nextCase} nextLabel={chapterDone>=chapterTotal?'챕터 완료':index+1<queue.length?'다음 사례':'다음 업무'}/>}
    {stage === 'incident' && <article className="panel story-incident"><small>업무 중 잠시</small><h2>{active.incidentTitle}</h2><p>{active.incident}</p><button className="primary" onClick={continueAfterIncident}>사례 계속 심사</button></article>}
    {stage === 'summary' && <article className="panel story-summary">
      <div className="promotion-document">
        <span className="eyebrow">제{chapter + 1}장 결산</span>
        <h2>{promoted ? '승진 발령장' : '업무 완료 보고서'}</h2>
        <p>{active.title} 임무를 완료했습니다. {promoted ? '새 직급으로 발령합니다.' : '현재 직급을 유지합니다.'}</p>
        <div className="promotion-ranks"><span>이전 직급 <b>{chapterStartRank}</b></span><span>발령 직급 <b>{rankEntry.rank}</b></span></div>
        <div className={`promotion-seal ${promoted ? 'is-promotion' : ''}`}>{promoted ? '승진' : '완료'}<small>심사실 인사과</small></div>
      </div>
      <section className="performance-sheet" aria-label="근무 평정표">
        <div className="performance-sheet-heading"><b>근무 평정표</b><span>{runAnswered ? `이번 심사 ${runAnswered}건 중 ${Math.max(0, correctCount)}건 정답 · 정답률 ${Math.round(correctCount/runAnswered*100)}%` : '출제 가능한 기존 문항이 없습니다.'}</span></div>
        <div className="performance-sheet-row">
          <div className="performance-item"><span><Zap aria-hidden="true"/> EXP</span><strong><CountUp from={chapterStartExperience} to={currentExperience}/><em className={`performance-delta ${experienceGain > 0 ? 'increase' : experienceGain < 0 ? 'decrease' : ''}`}>{experienceGain > 0 ? '+' : ''}{experienceGain}</em></strong></div>
          <div className="performance-item"><span><Brain aria-hidden="true"/> 판단력</span><strong><CountUp from={startJudgment} to={currentJudgment}/><em className={`performance-delta ${judgmentChange > 0 ? 'increase' : judgmentChange < 0 ? 'decrease' : ''}`}>{judgmentChange > 0 ? '+' : ''}{judgmentChange}</em></strong></div>
          <div className="performance-item"><span><Handshake aria-hidden="true"/> 신뢰도</span><strong><CountUp from={startTrust} to={currentTrust}/><em className={`performance-delta ${trustChange > 0 ? 'increase' : trustChange < 0 ? 'decrease' : ''}`}>{trustChange > 0 ? '+' : ''}{trustChange}</em></strong></div>
        </div>
      </section>
      <p>{chapter===storyChapters.length-1?'12개 챕터를 모두 마쳤습니다.':'다음 챕터를 플레이할 수 있습니다.'}</p><button className="primary" onClick={() => setStage('campaign')}>챕터 목록</button>
    </article>}
  </section>;
}

