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
    return {
      unlockedThrough: Math.max(0, Math.min(11, Number(value.unlockedThrough) || 0)),
      completed: Array.isArray(value.completed) ? value.completed.filter((n) => Number.isInteger(n) && n >= 0 && n < 12) : [],
      stats: { ...initialStoryStats, ...(value.stats || {}) },
    };
  } catch { return empty; }
}

export function saveStoryProgress(progress: StoryProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}
