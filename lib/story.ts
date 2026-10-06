import type { Case } from './cases';
import {shuffle,lawCategory,caseSelectionWeight,selectRandomCases} from './question-bank';
import { refreshRuleCase } from './rule-bank';

export type StoryStats = { judgment: number; trust: number };
export type RankIconKey = 'badge' | 'shield' | 'badgeCheck' | 'shieldCheck' | 'medal' | 'award' | 'star' | 'crown' | 'trophy' | 'gem' | 'landmark' | 'sparkles';
export type StoryChapter = { title: string; law: string | null; briefing: string; incidentTitle: string; incident: string; rank: string; rankIcon: RankIconKey };

// 임시 직급명, 팀 확정 필요. 직급명과 아이콘 키는 각 챕터 항목만을 기준으로 표시합니다.
const campaignDraft = [
  ['첫 심사', '의료법', '새 심사관으로 첫 사건을 맡았습니다. 사실관계와 조문을 차분히 대조하세요.', '접수대의 짧은 휴식', '선임 심사관이 접수대 옆에 차를 내려놓습니다. “잠깐 숨 돌려요.” 대기 중인 민원인은 안내 표지판을 살피며 자기 차례를 기다립니다.', '수습 심사관', 'badge'],
  ['진료 현장의 의무', null, '준비 중', '준비 중', '준비 중', '심사관', 'shield'],
  ['기록과 절차', null, '준비 중', '준비 중', '준비 중', '주임 심사관', 'badgeCheck'],
  ['의료기관 기준', null, '준비 중', '준비 중', '준비 중', '선임 심사관', 'shieldCheck'],
  ['면허와 자격', null, '준비 중', '준비 중', '준비 중', '책임 심사관', 'medal'],
  ['환자 권리', null, '준비 중', '준비 중', '준비 중', '수석 심사관', 'award'],
  ['의료기관 운영', null, '준비 중', '준비 중', '준비 중', '부심사관', 'star'],
  ['법령 종합 심사', null, '준비 중', '준비 중', '준비 중', '팀장 심사관', 'crown'],
  ['지역 보건 행정', null, '준비 중', '준비 중', '준비 중', '부서 심사관', 'trophy'],
  ['보건의료 계획', null, '준비 중', '준비 중', '준비 중', '과장 심사관', 'gem'],
  ['추가 법령 챕터', null, '법령 문항과 챕터 내용이 확정되면 열립니다.', '준비 중', '준비 중', '국장 심사관', 'landmark'],
  ['최종 심사', null, '준비 중', '준비 중', '준비 중', '총괄 심사관', 'sparkles'],
] as const;

export const storyChapters: StoryChapter[] = campaignDraft.map(([title, law, briefing, incidentTitle, incident, rank, rankIcon]) => ({
  title,
  law,
  briefing,
  incidentTitle,
  incident,
  rank,
  rankIcon,
}));

export const initialStoryStats: StoryStats = { judgment: 50, trust: 50 };

export function randomChapterCases(bank: Case[], chapterIndex: number, attemptedIds: ReadonlySet<string> = new Set()): Case[] {
  const law = storyChapters[chapterIndex]?.law;
  if (!law) return [];
  const pool = bank.filter((item) => lawCategory(item.law) === law);
  const unanswered = pool.filter((item) => !attemptedIds.has(item.id));
  const available = unanswered.length ? unanswered : pool;
  const completed = pool.filter((item) => attemptedIds.has(item.id)).length;
  // Across consecutive assignments: six ordinary cases for each penalty case.
  // A 12-case assignment therefore contains one or two penalty cases.
  const penaltyTarget = Math.floor((completed + 12) / 7) - Math.floor(completed / 7);
  const ordinary = available.filter((item) => caseSelectionWeight(item) === 1);
  const penalties = available.filter((item) => caseSelectionWeight(item) < 1);
  const selectedPenalties = selectRandomCases(penalties, penaltyTarget);
  const selectedOrdinary = selectRandomCases(ordinary, 12 - selectedPenalties.length);
  // Exhausted ordinary questions must not turn the chapter into a penalty-only set.
  return shuffle([...selectedOrdinary, ...selectedPenalties]).map(refreshRuleCase);
}

export function applyStoryResult(stats: StoryStats, correct: boolean): StoryStats {
  return {
    judgment: Math.max(0, Math.min(100, stats.judgment + (correct ? 2 : -1))),
    trust: Math.max(0, Math.min(100, stats.trust + (correct ? 1 : -1))),
  };
}

export function lawSearchUrl(law: string): string {
  return `https://www.law.go.kr/검색?query=${encodeURIComponent(law)}`;
}
