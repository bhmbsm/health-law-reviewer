import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {reviewCaseIds,readReviewTimestamps}=await vite.ssrLoadModule('/lib/review-inbox.ts');
const {default:StoryCaseDocument}=await vite.ssrLoadModule('/components/story/StoryCaseDocument.tsx');
const {default:ReviewAddButton}=await vite.ssrLoadModule('/components/ReviewAddButton.tsx');
const at=n=>`2026-10-25T12:00:0${n}.000Z`;
const attempt=(id,correct,n)=>({case_id:id,correct,created:at(n)});

test('a correct answer can be added without altering its learning record and stays after another correct answer',()=>{
 const attempts=[attempt('correct',true,1)];
 assert.equal(reviewCaseIds(attempts,{},{}).size,0);
 const snapshot=structuredClone(attempts);
 assert.deepEqual([...reviewCaseIds(attempts,{correct:at(2)},{})],['correct']);
 assert.deepEqual(attempts,snapshot);
 assert.ok(reviewCaseIds([...attempts,attempt('correct',1,3)],{correct:at(2)},{}).has('correct'));
});
test('explicit remove and bulk clear hide manual and incorrect entries; re-add or new mistake brings them back',()=>{
 const attempts=[attempt('manual',true,1),attempt('wrong',false,2)];
 const additions={manual:at(3)};
 assert.equal(reviewCaseIds(attempts,additions,{}).size,2);
 const dismissals={manual:at(4),wrong:at(4)};
 assert.equal(reviewCaseIds(attempts,additions,dismissals).size,0);
 assert.ok(reviewCaseIds(attempts,{manual:at(5)},dismissals).has('manual'));
 assert.ok(reviewCaseIds([...attempts,attempt('wrong',false,5)],additions,dismissals).has('wrong'));
 assert.equal(reviewCaseIds([...attempts,attempt('wrong',true,5)],additions,dismissals).size,0);
});
test('latest wrong attempt wins even if attempts arrive out of order and same timestamp dismissal wins',()=>{
 assert.ok(reviewCaseIds([attempt('x',0,5),attempt('x',0,1)],{},{x:at(3)}).has('x'));
 assert.equal(reviewCaseIds([attempt('x',0,3)],{x:at(3)},{x:at(3)}).size,0);
});
test('guest saved manual entries survive reload and malformed storage is ignored',()=>{
 const saved=JSON.stringify({x:at(2),invalid:'nope',number:1});
 assert.deepEqual(readReviewTimestamps(saved),{x:at(2)});
 assert.ok(reviewCaseIds([attempt('x',true,1)],readReviewTimestamps(saved),{}).has('x'));
 for(const raw of [null,'null','[]','{broken'])assert.deepEqual(readReviewTimestamps(raw),{});
});
test('story shows manual-add action only after a correct answer, with disabled saved and saving states',()=>{
 const selected={id:'x',law:'의료법',article:'제2조',title:'사건',body:'확인합니다.',details:[],answer:true,explanation:'해설입니다.'};
 const props={selected,index:0,total:1,result:true,saving:false,onAnswer(){},onNext(){},nextLabel:'다음',onAddReview(){}};
 assert.match(renderToStaticMarkup(React.createElement(StoryCaseDocument,props)),/오답 재심사함에 넣기/);
 for(const result of [null,false])assert.doesNotMatch(renderToStaticMarkup(React.createElement(StoryCaseDocument,{...props,result})),/오답 재심사함에 넣기/);
 assert.match(renderToStaticMarkup(React.createElement(ReviewAddButton,{added:true,busy:false,onAdd(){}})),/disabled=""[^>]*>오답 재심사함에 추가됨/);
 assert.match(renderToStaticMarkup(React.createElement(ReviewAddButton,{added:false,busy:true,onAdd(){}})),/disabled=""/);
});
