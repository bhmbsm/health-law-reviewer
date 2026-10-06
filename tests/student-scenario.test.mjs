import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {studentRule,studentFact}=await vite.ssrLoadModule('/lib/student-scenario.ts');
const {makeRuleCases}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const source='제65조(면허 취소와 재교부) 원문은 그대로 보존한다.';
const rule={id:'reissue-regression',law:'의료법',article:'제65조제2항',title:'재교부',scenario:'면허 취소 사유는 {revocation_reason}입니다. 재교부 금지기간은 {reissue_term} 이내인가요?',approveFacts:[{revocation_reason:'제11조제1항에 따른 면허 조건을 이행하지 아니한 경우',reissue_term:'1년'}],rejectFacts:[{revocation_reason:'제11조제1항에 따른 면허 조건을 이행하지 아니한 경우',reissue_term:'2년'}],changedField:'reissue_term',factLabels:{},factOrder:['revocation_reason','reissue_term'],lawText:source,source:'https://www.law.go.kr/법령/의료법',judgmentBasis:'면허 조건 미이행 사유의 재교부 금지기간은 1년 이내입니다.',difficulty:'보통',note:''};
test('screenshot regression describes the licence condition instead of pointing to article 11',()=>{
 const cases=makeRuleCases([{name:'의료법',rules:[rule]}]);
 assert.deepEqual(cases.map(c=>c.answer),[true,false]);
 for(const c of cases){assert.match(c.body,/특정 지역 또는 특정 업무/);assert.doesNotMatch(c.body+c.details.join(' '),/제\d+조/);assert.equal(c.rule,source);assert.equal(c.article,'제65조제2항');}
});
test('editorial expansion preserves the single changed decision field and is idempotent',()=>{
 const expanded=studentRule(rule);const a=expanded.approveFacts[0],b=expanded.rejectFacts[0];
 assert.deepEqual(Object.keys(a).filter(k=>a[k]!==b[k]),['reissue_term']);
 assert.deepEqual(studentRule(expanded),expanded);
});
test('nested legal grounds flatten into valid random options without leaving generator markers',()=>{
 const result=studentFact('RAND_CHOICE:第x:제2항에 따라 면허를 재교부받은 사람이 제66조제1항 각 호의 어느 하나에 해당하는 경우','의료법');
 const options=result.slice(12).split(':');assert.equal(options.length,10);
 assert.ok(options.slice(1).every(s=>s.startsWith('면허를 재교부받은 뒤 ')));
 assert.doesNotMatch(options.slice(1).join(' '),/RAND_|제\d+조/);
});
test('single-use-device grounds retain the injury distinction between suspension and revocation',()=>{
 const ordinary=studentFact('제4조제6항을 위반한 때','의료법');
 const severe=studentFact('제4조제6항을 위반하여 사람의 생명 또는 신체에 중대한 위해를 발생하게 한 경우','의료법');
 assert.match(ordinary,/일회용 의료기기/);assert.doesNotMatch(ordinary,/중대한 위해/);assert.match(severe,/중대한 위해/);
});
test('a hard-coded authority in an old scenario is synchronized with the selected authority fact',()=>{
 const authorityRule={...rule,id:'authority-regression',article:'제59조',title:'업무개시 명령',
  scenario:'저는 보건복지부장관입니다. 집단 휴업한 의료기관 개설자에게 업무개시 명령을 내려도 될까요?',
  approveFacts:[{order_authority:'시장'}],rejectFacts:[{order_authority:'보건소장'}],changedField:'order_authority',
  factLabels:{order_authority:'명령을 내리려는 직책'},factOrder:['order_authority']};
 const [approved,rejected]=makeRuleCases([{name:'의료법',rules:[authorityRule]}]);
 assert.match(approved.body,/저는 시장입니다/);assert.doesNotMatch(approved.body,/보건복지부장관입니다/);
 assert.match(rejected.body,/저는 보건소장입니다/);assert.doesNotMatch(rejected.body,/보건복지부장관입니다/);
});
