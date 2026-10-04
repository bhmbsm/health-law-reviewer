'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Case } from '../../lib/cases';
import { applyStoryResult, lawSearchUrl, randomChapterCases, storyChapters } from '../../lib/story';
import { loadStoryProgress, saveStoryProgress, type StoryProgress } from '../../lib/story-progress';

type Props = { bank: Case[]; onExit: () => void };
type Stage = 'campaign' | 'briefing' | 'case' | 'incident' | 'summary';

export default function StoryCampaign({ bank, onExit }: Props) {
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [chapter, setChapter] = useState(0);
  const [stage, setStage] = useState<Stage>('campaign');
  const [queue, setQueue] = useState<Case[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [incidentSeen, setIncidentSeen] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setProgress(loadStoryProgress()), 0); return () => window.clearTimeout(timer); }, []);
  const selected = queue[index];
  const available = useMemo(() => bank.filter((item) => storyChapters.some((entry) => entry.law && entry.law === item.law)), [bank]);
  function persist(next: StoryProgress) { setProgress(next); saveStoryProgress(next); }
  function startChapter(ch: number) {
    if (!progress || ch > progress.unlockedThrough) return;
    const cases = randomChapterCases(bank, ch);
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
  return <section className="story-campaign">
    <header className="story-top"><div><span className="eyebrow">HEALTH LAW CAMPAIGN</span><h1>심사관의 업무일지</h1></div><button className="secondary" onClick={onExit}>나가기</button></header>
    <div className="story-stats"><span>직급 <b>{progress.stats.rank}</b></span><span>경험치 <b>{progress.stats.experience} EXP</b></span><span>판단력 <b>{progress.stats.judgment}</b></span><span>신뢰도 <b>{progress.stats.trust}</b></span></div>
    {stage === 'campaign' && <><p>캠페인을 시작하고 챕터를 선택하세요. 문항이 준비되지 않은 챕터는 준비 중으로 표시됩니다.</p><div className="story-chapters">{storyChapters.map((entry, i) => { const ready = !!entry.law && bank.some((item) => item.law === entry.law); const unlocked = i <= progress.unlockedThrough; return <article className="panel" key={entry.title}><small>CHAPTER {i + 1} · {entry.rank}</small><h2>{entry.title}</h2><p>{entry.law || '준비 중'}{entry.law ? ` · ${bank.filter((item) => item.law === entry.law).length}개 문항` : ''}</p><button className="primary" disabled={!ready || !unlocked} onClick={() => startChapter(i)}>{!entry.law || !ready ? '준비 중' : unlocked ? (progress.completed.includes(i) ? '다시 플레이' : '시작') : '이전 챕터 완료 필요'}</button></article>; })}</div><p className="small">현재 출제 가능한 법령: {Array.from(new Set(available.map((item) => item.law))).join(' · ') || '없음'}</p></>}
    {stage === 'briefing' && <article className="panel"><small>CHAPTER {chapter + 1} · {active.law}</small><h2>{active.title}</h2><p>{active.briefing}</p><p>이 챕터의 기존 문항 {queue.length}개를 무작위 순서로 심사합니다.</p><button className="primary" onClick={() => setStage(queue.length ? 'case' : 'summary')}>{queue.length ? '심사 시작' : '문항 없음 · 결산 보기'}</button></article>}
    {stage === 'case' && selected && <><div className="panel"><small>{selected.law} · {selected.article} · {index + 1}/{queue.length}</small><h2>{selected.title}</h2><p>{selected.body}</p><ul>{selected.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>{choice !== null && <div className="story-feedback"><strong>{choice ? '정답입니다' : '오답입니다'} · 정답은 {selected.answer ? '승인' : '반려'}</strong><p>{selected.explanation}</p><a href={selected.source || lawSearchUrl(selected.law)} target="_blank" rel="noreferrer">법전에서 {selected.law} {selected.article} 확인 ↗</a></div>}<div className="decision-buttons"><button className="approve" disabled={choice !== null} onClick={() => submit(true)}>승인</button><button className="reject" disabled={choice !== null} onClick={() => submit(false)}>반려</button></div>{choice !== null && <button className="primary" onClick={nextCase}>{index + 1 < queue.length ? '다음 사례' : incidentSeen ? '결산' : '중간 사건'}</button>}</div></>}
    {stage === 'incident' && <article className="panel"><small>중간 사건 · 정답 무관</small><h2>{active.title}</h2><p>{active.incident}</p><p>캐릭터의 대사와 사건은 정답 및 능력치 판정에 영향을 주지 않습니다.</p><button className="primary" onClick={() => { setIncidentSeen(true); setStage('case'); }}>사례 계속 심사</button></article>}
    {stage === 'summary' && <article className="panel"><small>CHAPTER {chapter + 1} 결산</small><h2>{active.title} 완료</h2><p>{queue.length ? `${queue.length}건 중 ${correctCount}건 정답` : '출제 가능한 기존 문항이 없습니다.'}</p><div className="story-stats"><span>현재 직급 <b>{progress.stats.rank}</b></span><span>경험치 <b>{progress.stats.experience} EXP</b></span><span>판단력 <b>{progress.stats.judgment}</b></span><span>신뢰도 <b>{progress.stats.trust}</b></span></div><p>다음 챕터가 해금되었습니다.</p><button className="primary" onClick={() => setStage('campaign')}>챕터 목록</button></article>}
  </section>;
}
