import type { SupabaseClient } from '@supabase/supabase-js';

export type CampaignAttempt = {
  case_id: string;
  mode: string;
  chapter: number;
  correct: number | boolean;
  created: string;
};
export type CampaignProgress = {
  user_id: string;
  current_chapter: number;
  chapter_progress: Record<string, number>;
  chapter_correct: Record<string, number>;
  experience: number;
  judgment: number;
  trust: number;
  rank: string;
  unlocked_chapters: number[];
  wrong_nodes: string[];
  last_study_date: string | null;
};

const rankForChapter = (chapter: number) =>
  chapter === 1 ? '수습 심사관' :
  chapter <= 3 ? '현장 심사관' :
  chapter <= 6 ? '전문 심사관' :
  chapter <= 8 ? '선임 심사관' :
  chapter <= 10 ? '보건의료심사국장' :
  chapter === 11 ? '차관급 심사 책임자' : '장관급 보건의료정책 심사 책임자';

export function deriveCampaignProgress(userId: string, attempts: CampaignAttempt[]): CampaignProgress {
  const chapter_progress: Record<string, number> = {};
  const chapter_correct: Record<string, number> = {};
  const latest = new Map<string, boolean>();
  let experience = 0;
  let judgment = 0;
  let trust = 0;
  for (const attempt of attempts) {
    const correct = Boolean(attempt.correct);
    latest.set(attempt.case_id, correct);
    experience = Math.max(0, experience + (correct ? 20 : -5));
    if (attempt.mode === 'story' && attempt.chapter >= 0 && attempt.chapter < 12) {
      const key = String(attempt.chapter + 1);
      chapter_progress[key] = (chapter_progress[key] ?? 0) + 1;
      chapter_correct[key] = (chapter_correct[key] ?? 0) + Number(correct);
      judgment += Number(correct);
      trust = Math.max(0, trust + (correct ? 1 : -1));
    }
  }
  const unlocked_chapters = [1];
  for (let chapter = 1; chapter < 12; chapter++) {
    if ((chapter_progress[String(chapter)] ?? 0) < 10) break;
    unlocked_chapters.push(chapter + 1);
  }
  const current_chapter = unlocked_chapters.at(-1) ?? 1;
  const last = attempts.at(-1)?.created;
  return {
    user_id: userId, current_chapter, chapter_progress, chapter_correct,
    experience, judgment, trust, rank: rankForChapter(current_chapter),
    unlocked_chapters,
    wrong_nodes: [...latest].filter(([, correct]) => !correct).map(([id]) => id),
    last_study_date: last ? new Date(last).toLocaleDateString('sv-SE', {timeZone: 'Asia/Seoul'}) : null,
  };
}

export async function saveCampaignProgress(client: SupabaseClient, userId: string, attempts: CampaignAttempt[]) {
  const progress = deriveCampaignProgress(userId, attempts);
  const {error} = await client.from('campaign_progress').upsert(progress, {onConflict: 'user_id'});
  if (error) throw error;
  return progress;
}
