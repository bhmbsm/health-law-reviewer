import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const narrative=await vite.ssrLoadModule('/lib/case-narrative.ts');
const {default:CaseText}=await vite.ssrLoadModule('/components/CaseText.tsx');
const session=await vite.ssrLoadModule('/lib/study-session.ts');
const story=await vite.ssrLoadModule('/lib/story.ts');
const curriculum=await vite.ssrLoadModule('/lib/story-curriculum.ts');
const {reconcileStoryProgress}=await vite.ssrLoadModule('/lib/story-progress.ts');
const make=(law,n=80)=>Array.from({length:n},(_,i)=>({id:`${law}-${i}`,law,article:'제2조',answer:i%2===0}));

test('inline numbered conditions become a real list without breaking years, dates or decimals',()=>{
 const text='저는 시청 담당자입니다. 1. 2026년 12월 24일에 검토했습니다.\n\n2. 기간은 3.5년입니다.\n\n이 판단이 맞나요?';
 const value=narrative.normalizeCaseText(text);
 assert.equal(value.replace(/\s/g,''),text.replace(/\s/g,''));
 const html=renderToStaticMarkup(React.createElement(CaseText,{text}));
 assert.match(html,/<ol[^>]*start="1"/);assert.equal((html.match(/<li /g)||[]).length,2);
 assert.ok(html.includes('2026년 12월 24일'));assert.ok(html.includes('3.5년'));
 const date='2027. 1. 15. 전에 확인했습니다. 기간은 1.5년입니다.';
 assert.equal(narrative.normalizeCaseText(date),date);assert.ok(narrative.caseTextBlocks(date).every(x=>x.kind==='paragraph'));
});
test('existing paragraphs and every tested condition stay in source order',()=>{
 const value=narrative.caseNarrative({body:'저는 담당자입니다.\n\n1. 첫 조건입니다.\n\n2. 둘째 조건입니다.\n\n승인할까요?',details:['추가 조건은 48시간입니다.']});
 assert.ok(value.indexOf('첫 조건')<value.indexOf('둘째 조건'));assert.ok(value.indexOf('둘째 조건')<value.indexOf('3. 추가 조건'));assert.ok(value.endsWith('승인할까요?'));
 assert.ok(!/48\n/.test(value));
});
test('free study continues beyond five, avoids repeats within a cycle and renews an exhausted pool',()=>{
 const pool=make('의료법',7);let seen=[],last;const ids=[];
 for(let i=0;i<23;i++){
  const draw=session.nextFreeStudyCase(pool,seen,last,()=>.31);assert.ok(draw);assert.notEqual(draw.item.id,last);
  seen=draw.seenIds;last=draw.item.id;ids.push(last);
 }
 assert.equal(new Set(ids.slice(0,7)).size,7);assert.equal(ids.length,23);
 assert.equal(session.nextFreeStudyCase([],[]),null);
 assert.ok(session.nextFreeStudyCase([pool[0]],[pool[0].id],pool[0].id));
});
test('completion counts only answered questions and includes unknown answers as incorrect',()=>{
 assert.deepEqual(session.studySummary({answered:7,right:4,unknown:2}),{solved:7,correct:4,incorrect:3,unknown:2,accuracy:57});
 assert.equal(session.studySummary({answered:0,right:0,unknown:0}).accuracy,0);
});
test('first chapter has fifty answers, never requires the entire 1291-case pool',()=>{
 const pool=make('의료법',1291),seen=new Set();let done=0;
 while(done<50){const batch=story.randomChapterCases(pool,0,seen,12,done);assert.equal(batch.length,Math.min(12,50-done));batch.forEach(c=>seen.add(c.id));done+=batch.length;}
 assert.equal(done,50);assert.equal(story.randomChapterCases(pool,0,seen,12,50).length,0);
});
test('chapter two mixes 20 Medical Act and 30 infectious-disease questions',()=>{
 const pool=[...make('의료법'),...make('감염병의 예방 및 관리에 관한 법률')];
 const schedule=curriculum.chapterLawSchedule(pool,1);
 assert.equal(schedule.length,50);assert.equal(schedule.filter(l=>l==='의료법').length,20);
 assert.equal(schedule.filter(l=>l==='감염병의 예방 및 관리에 관한 법률').length,30);
 const selected=story.randomChapterCases(pool,1,new Set(),50,0);assert.equal(selected.length,50);assert.equal(selected.filter(c=>c.law==='의료법').length,20);
});
test('all twelve chapters have a fifty-question curriculum and late chapters emphasize policy',()=>{
 assert.equal(story.storyChapters.length,12);
 for(const chapter of story.storyChapters){assert.equal(chapter.target,50);assert.equal(chapter.weights.reduce((a,b)=>a+b),50);}
 assert.ok(story.storyChapters[11].laws.includes('보건의료기본법'));
 assert.equal(curriculum.chapterLawSchedule(make('의료법'),1).length,50);
 assert.deepEqual(curriculum.chapterLawSchedule([],0),[]);
});
test('history is credited by chapter and unlocks the second stage at fifty',()=>{
 const old={unlockedThrough:0,completed:[],stats:{judgment:70,trust:65}};
 const attempts=Array.from({length:50},(_,i)=>({case_id:`old-${i}`,chapter:0}));
 const progress=reconcileStoryProgress(old,attempts);assert.equal(progress.unlockedThrough,1);assert.deepEqual(progress.completed,[0]);assert.deepEqual(progress.stats,old.stats);
 assert.equal(reconcileStoryProgress(old,attempts.slice(0,49)).unlockedThrough,0);
 assert.equal(reconcileStoryProgress(progress,[...attempts,...Array.from({length:49},()=>({case_id:'repeat',chapter:1}))]).unlockedThrough,1);
 assert.equal(reconcileStoryProgress(progress,[...attempts,...Array.from({length:50},()=>({case_id:'repeat',chapter:1}))]).unlockedThrough,2);
});
test('a small question pool can complete fifty without turning into penalties only',()=>{
 const pool=[...make('의료법',4),...Array.from({length:80},(_,i)=>({id:`penalty-${i}`,law:'의료법',article:'제90조',answer:false}))];
 const selected=story.randomChapterCases(pool,0,new Set(),50,0);
 assert.equal(selected.length,50);assert.equal(selected.filter(c=>c.article==='제90조').length,4);
});
