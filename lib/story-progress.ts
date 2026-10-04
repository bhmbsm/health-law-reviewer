import { initialStoryStats, type StoryStats } from './story';

export type StoryProgress = { unlockedThrough: number; completed: number[]; stats: StoryStats };
const KEY = 'health-law-reviewer-story-v1';
const empty: StoryProgress = { unlockedThrough: 0, completed: [], stats: initialStoryStats };

// Keep persistence behind these functions so the backend can be replaced centrally later.
export function loadStoryProgress(): StoryProgress {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return empty;
    const value = JSON.parse(saved) as Partial<StoryProgress>;
    const completed = Array.isArray(value.completed)
      ? [...new Set(value.completed.filter((n) => Number.isInteger(n) && n >= 0 && n < 12))].sort((a, b) => a - b)
      : [];
    const completedSet = new Set(completed);
    let unlockedThrough = 0;
    while (unlockedThrough < 11 && completedSet.has(unlockedThrough)) unlockedThrough += 1;
    return {
      // 완료 기록을 진행도의 기준으로 삼아, 과거 상태의 불일치로 직급이 앞서지 않게 합니다.
      unlockedThrough,
      completed,
      stats: {
        judgment: Number.isFinite(Number(value.stats?.judgment)) ? Math.max(0, Math.min(100, Number(value.stats?.judgment))) : initialStoryStats.judgment,
        trust: Number.isFinite(Number(value.stats?.trust)) ? Math.max(0, Math.min(100, Number(value.stats?.trust))) : initialStoryStats.trust,
      },
    };
  } catch { return empty; }
}

export function saveStoryProgress(progress: StoryProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}
