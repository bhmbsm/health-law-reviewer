import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {makeRuleCases}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const rule={id:'legacy',law:'의료법',article:'예시',title:'기존 문제',difficulty:'보통',scenario:'기간을 검토합니다.',note:'',approveFacts:[{years:'3'}],rejectFacts:[{years:'5'}],factLabels:{years:'기간'},lawText:'원문'};
test('legacy bank infers its changed fact and retains approve/reject explanations',()=>{
  const cases=makeRuleCases([{name:'legacy',rules:[rule]}]);
  assert.equal(cases.length,2);
  assert.deepEqual(cases.map(c=>c.answer),[true,false]);
  assert.match(cases[1].explanation,/5/);assert.match(cases[1].explanation,/3/);
  assert.ok(cases.every(c=>!c.explanation.includes('undefined')));
});
test('one-sided legacy rules do not crash or invent a rejection variant',()=>{
  const cases=makeRuleCases([{name:'one-sided',rules:[{...rule,rejectFacts:[],note:'원문의 기준을 충족합니다.'}]}]);
  assert.equal(cases.length,1);assert.equal(cases[0].answer,true);
  assert.match(cases[0].explanation,/기준을 충족/);
});
