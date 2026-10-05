import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {calculateStaffMinimum,makeRuleCase,refreshRuleCase}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const {randomChapterCases}=await vite.ssrLoadModule('/lib/story.ts');
const rule=(divisor,inpatients='RAND_INT:1:1000:1',outpatients='RAND_INT:1:1000:1')=>({id:'staff-'+divisor,law:'의료법',article:'시행규칙 제38조',title:'최소 인원',difficulty:'보통',scenario:'최소 인원 계산이 맞나요?',note:'',changedField:'staff_minimum',factLabels:{},factOrder:['inpatients','outpatients','staff_minimum'],lawText:'원문',approveFacts:[{inpatients,outpatients,staff_minimum:`STAFF_MIN:inpatients:outpatients:${divisor}:0`}],rejectFacts:[{inpatients,outpatients,staff_minimum:`STAFF_MIN:inpatients:outpatients:${divisor}:-1`},{inpatients,outpatients,staff_minimum:`STAFF_MIN:inpatients:outpatients:${divisor}:1`}]});
test('both hospital formulas round only the final sum, including exact boundaries',()=>{
  for(const d of [60,120])for(let i=1;i<=1000;i++)for(let o=1;o<=1000;o++)assert.equal(calculateStaffMinimum(i,o,d),Math.floor((3*i+o+d-1)/d));
  assert.equal(calculateStaffMinimum(100,100,60),7);assert.equal(calculateStaffMinimum(100,100,120),4);
  assert.equal(calculateStaffMinimum(10,30,60),1);
  assert.equal(calculateStaffMinimum(1,1,120),1);
});
test('generated rejection and its explanation use the same sampled patient counts',()=>{
  for(const d of [60,120])for(let n=0;n<100;n++){
    const c=makeRuleCase({name:'bank'},rule(d),false,n%2);
    const [i,o,staff]=c.details.map(s=>Number(s.match(/\d+/g).at(-1)));
    const minimum=calculateStaffMinimum(i,o,d);
    assert.equal(Math.abs(staff-minimum),1);assert.ok(staff>=1);
    assert.ok(c.explanation.includes(`최소 ${minimum}명`));assert.ok(!JSON.stringify(c.details).includes('STAFF_MIN'));
  }
});
test('the minimum-one edge has a positive distractor and stable rule ID',()=>{
  const r=rule(120,'1','1'),c=makeRuleCase({name:'bank'},r,false,0);
  assert.match(c.details[2],/2명/);assert.match(c.explanation,/최소 1명/);
  assert.equal(refreshRuleCase(c).id,c.id);
});
test('new free and story sessions redraw patients without mutating an active question',()=>{
  const c=makeRuleCase({name:'bank'},rule(60),true),snapshot=JSON.stringify(c);
  const fresh=Array.from({length:12},()=>refreshRuleCase(c));
  assert.ok(new Set(fresh.map(x=>x.details[0])).size>1);assert.equal(JSON.stringify(c),snapshot);
  assert.ok(new Set(Array.from({length:12},()=>randomChapterCases([c],0)[0].details[0])).size>1);
});
test('invalid formula directives are rejected rather than evaluated',()=>{
  assert.throws(()=>calculateStaffMinimum(0,1,60));assert.throws(()=>calculateStaffMinimum(1,1001,60));
  const r=rule(60);r.approveFacts[0].staff_minimum='STAFF_MIN:process:exit:60:0';
  assert.throws(()=>makeRuleCase({name:'bank'},r,true));
});
