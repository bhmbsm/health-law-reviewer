import type {Case} from './cases';
import {caseSelectionWeight,selectRandomCases} from './question-bank';
import {refreshRuleCase} from './rule-bank';
import {storyChapters,chapterLawSchedule,storyLaw,chapterPool} from './story-curriculum';
export {storyChapters,chapterPool,availableChapterLaws,storyLaw,STORY_CHAPTER_TARGET} from './story-curriculum';
export type StoryStats={judgment:number;trust:number};
export type StoryChapter=typeof storyChapters[number];
export type RankIconKey=StoryChapter['rankIcon'];

export const initialStoryStats: StoryStats = { judgment: 50, trust: 50 };

export function randomChapterCases(bank:Case[],chapterIndex:number,attemptedIds:ReadonlySet<string>=new Set(),limit=12,completed=0):Case[]{
 const chapter=storyChapters[chapterIndex],schedule=chapterLawSchedule(bank,chapterIndex);
 if(!chapter||!schedule.length)return [];
 const count=Math.min(Math.max(0,limit),Math.max(0,chapter.target-completed),chapterPool(bank,chapterIndex).length);
 const selected:Case[]=[],seen=new Set(attemptedIds),inBatch=new Set<string>();
 for(let i=0;i<count;i++){
  const position=completed+i,pool=bank.filter(item=>storyLaw(item.law)===schedule[position]);
  // Preserve ten ordinary questions per penalty question, including on resume.
  const wantsPenalty=(position+1)%11===0;
  const kind=pool.filter(item=>(caseSelectionWeight(item)<1)===wantsPenalty);
  const preferred=kind.length?kind:pool.filter(item=>caseSelectionWeight(item)===1);
  const eligible=preferred.length?preferred:pool;
  const fresh=eligible.filter(item=>!seen.has(item.id));
  const notInBatch=eligible.filter(item=>!inBatch.has(item.id));
  const draw=selectRandomCases(fresh.length?fresh:notInBatch.length?notInBatch:eligible,1)[0];
  if(!draw)continue;
  seen.add(draw.id);inBatch.add(draw.id);selected.push(refreshRuleCase(draw));
 }
 return selected;
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

