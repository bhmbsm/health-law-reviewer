import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {makeRuleCases}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const {insuranceLawBasis,insuranceScenario}=await vite.ssrLoadModule('/lib/insurance-explanation.ts');
const rule={id:'NHI-example',law:'국민건강보험법',article:'제7조',title:'신고기한',scenario:'신고했습니다.',approveFacts:[{days:'1일'},{days:'10일'}],rejectFacts:[{days:'20일'}],changedField:'days',factLabels:{days:'신고 기간'},factOrder:['days'],difficulty:'보통',note:'',source:'https://www.law.go.kr/법령/국민건강보험법',lawText:'제7조(사업장의 신고)\n사업장 사용자는 14일 이내에 신고하여야 한다.'};
test('multiple approval examples do not replace the actual deadline',()=>{
 const cases=makeRuleCases([{name:'보험법',rules:[rule]}]);
 for(const c of cases)assert.match(c.explanation,/14일 이내/);
 assert.doesNotMatch(cases[2].explanation,/법정 기준은.*1일/);
});
test('extracts the applicable paragraph and item together with introductory conditions',()=>{
 const basis=insuranceLawBasis({...rule,article:'제52조제2항제1호',lawText:'제52조(건강검진)\n① 건강검진을 실시한다.\n② 종류와 대상은 다음과 같다.\n1. 일반건강검진: 20세 이상인 피부양자\n2. 다른 검진\n③ 검진항목'});
 assert.match(basis,/② 종류와 대상/);assert.match(basis,/20세 이상/);assert.doesNotMatch(basis,/다른 검진|③ 검진항목/);
});
test('compound references select the article actually present in the uploaded excerpt',()=>{
 assert.match(insuranceLawBasis({...rule,article:'제70조제3항, 시행령 제33조제1항',lawText:'제33조(보수)\n① 상여금이 포함된다.\n② 다른 사항'}),/상여금/);
});
test('insurance labels do not inherit medical treatment wording or duplicate currency units',()=>{
 const c=makeRuleCases([{name:'보험법',rules:[{...rule,approveFacts:[{fine_amount:'100만원',target:'휴직자'}],rejectFacts:[],changedField:'fine_amount',factLabels:{fine_amount:'과태료 상한',target:'경감 대상'},factOrder:['fine_amount','target']}]}])[0];
 assert.doesNotMatch(c.explanation+c.details.join(' '),/만원만원|전문적으로 수행/);
 assert.ok(c.details.includes('경감 대상: 휴직자.'));
});
test('known timely-filing cases no longer assert a penalty before the student decides',()=>{
 assert.doesNotMatch(insuranceScenario({...rule,id:'NHI-A7-DAYS-001',scenario:'카페를 개업한 윤OO씨가 첫 직원을 채용해 적용대상사업장이 되었고, 이후 보험자에게 사업장 신고를 했다. 공단은 과태료를 부과했다.'}),/과태료/);
 assert.equal(insuranceLawBasis({...rule,law:'의료법'}),'');
});
