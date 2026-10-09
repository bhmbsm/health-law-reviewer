import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {numberedScenario}=await vite.ssrLoadModule('/lib/case-readability.ts');
const {makeRuleCase}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const scenario='저는 지자체 보건정책 담당자입니다. 주요질병관리체계를 소개하는 자료에 다음 분야를 적었습니다.\n\n{document_items}\n\n법에서 정한 주요질병관리체계의 분야로 맞게 정리했나요?';
test('numbered list preserves the actor, context and final judgment question',()=>{
 const formatted=numberedScenario(scenario);
 assert.equal(formatted,scenario);
 assert.equal(numberedScenario(formatted),formatted);
});
test('inline list formatting changes only whitespace, even when repeated',()=>{
 const inline='저는 신입 의사입니다. 다음 항목을 기재했습니다. {document_items} 필수 기재사항을 갖췄나요?';
 const formatted=numberedScenario(inline);
 assert.equal(formatted.replace(/\s+/g,''),inline.replace(/\s+/g,''));
 assert.equal(numberedScenario(formatted),formatted);
});
test('consent list retains patient context and the actual question',()=>{
 const consent='저는 한의사입니다. 환자에게 다음 사항을 설명했습니다. {consent_items} 서면동의를 받으면 요건을 갖출까요?';
 const formatted=numberedScenario(consent);
 assert.equal(formatted.replace(/\s+/g,''),consent.replace(/\s+/g,''));
 assert.equal(numberedScenario(formatted),formatted);
});
test('screenshot case retains every selected list item and the question on both answers',()=>{
 const rule={id:'BHC-008',lawKey:'bhc',law:'보건의료기본법',article:'제35조·제36조·제38조부터 제43조',title:'보건의료기본법 사례 심사',difficulty:'보통',note:'',scenario,
 approveFacts:[{document_items:'감염병의 예방 및 관리 / 만성질환의 예방 및 관리 / 정신 보건의료 / 구강 보건의료'}],
 rejectFacts:[{document_items:'감염병의 예방 및 관리 / 만성질환의 예방 및 관리 / 산업 보건의료 / 구강 보건의료'}],
 factLabels:{document_items:'관리 분야'},factOrder:['document_items'],changedField:'document_items',source:'https://www.law.go.kr/법령/보건의료기본법',lawText:'원문 보존',approveBody:'',rejectBody:'',judgmentBasis:'주요질병관리체계는 감염병·만성질환·정신·구강 보건의료 분야입니다.'};
 const bank={kind:'rule-bank',id:'test',name:'test',createdAt:'2026-10-10',rules:[rule]};
 for(const approved of [true,false]){
  const before=structuredClone(rule);
  const item=makeRuleCase(bank,rule,approved,0);
  assert.equal(item.answer,approved);assert.deepEqual(rule,before);
  assert.match(item.body,/저는 지자체 보건정책 담당자입니다/);
  assert.match(item.body,/주요질병관리체계를 소개하는 자료/);
  assert.match(item.body,/1\. 감염병의 예방 및 관리/);
  assert.match(item.body,/4\. 구강 보건의료/);
  assert.ok(item.body.endsWith('법에서 정한 주요질병관리체계의 분야로 맞게 정리했나요?'));
  assert.equal(item.rule,'원문 보존');
 }
});
