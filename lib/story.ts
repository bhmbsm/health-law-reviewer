import { cases, type Case } from './cases';

export type StoryStats = { experience: number; judgment: number; trust: number; rank: string };
export type StoryChapter = { title: string; law: string | null; briefing: string; incident: string; rank: string };

const knownLaws = new Set(cases.map((item) => item.law));
const campaignDraft = [
  ['첫 심사', '의료법', '새 심사관으로 첫 사건을 맡았습니다. 사실관계와 조문을 차분히 대조하세요.', '접수 창구가 서류를 다시 확인해 달라고 합니다. 판단에는 영향을 주지 않습니다.', '수습 심사관'],
  ['진료 현장의 의무', null, '준비 중', '준비 중', '심사관'],
  ['기록과 절차', null, '준비 중', '준비 중', '선임 심사관'],
  ['의료기관 기준', null, '준비 중', '준비 중', '주임 심사관'],
  ['면허와 자격', null, '준비 중', '준비 중', '책임 심사관'],
  ['환자 권리', null, '준비 중', '준비 중', '팀장 심사관'],
  ['의료기관 운영', null, '준비 중', '준비 중', '수석 심사관'],
  ['법령 종합 심사', null, '준비 중', '준비 중', '부심사관'],
  ['지역 보건 행정', null, '준비 중', '준비 중', '부서 심사관'],
  ['보건의료 계획', null, '준비 중', '준비 중', '과장 심사관'],
  ['추가 법령 챕터', null, '법령 문항과 챕터 내용이 확정되면 열립니다.', '준비 중', '국장 심사관'],
  ['최종 심사', null, '준비 중', '준비 중', '총괄 심사관'],
] as const;

export const storyChapters: StoryChapter[] = campaignDraft.map(([title, law, briefing, incident, rank]) => ({
  title,
  law: law && knownLaws.has(law) ? law : null,
  briefing,
  incident,
  rank,
}));

export const initialStoryStats: StoryStats = { experience: 0, judgment: 50, trust: 50, rank: storyChapters[0].rank };

export function randomChapterCases(bank: Case[], chapterIndex: number): Case[] {
  const law = storyChapters[chapterIndex]?.law;
  if (!law) return [];
  return bank.filter((item) => item.law === law).sort(() => Math.random() - 0.5).slice(0, 12);
}

export function applyStoryResult(stats: StoryStats, correct: boolean): StoryStats {
  const experience = Math.max(0, stats.experience + (correct ? 20 : 0));
  const rankIndex = Math.min(storyChapters.length - 1, Math.floor(experience / 100));
  return {
    experience,
    judgment: Math.max(0, Math.min(100, stats.judgment + (correct ? 2 : -1))),
    trust: Math.max(0, Math.min(100, stats.trust + (correct ? 1 : -1))),
    rank: storyChapters[rankIndex].rank,
  };
}

export function lawSearchUrl(law: string): string {
  return `https://www.law.go.kr/검색?query=${encodeURIComponent(law)}`;
}
