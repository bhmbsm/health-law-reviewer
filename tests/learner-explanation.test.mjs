import assert from 'node:assert/strict';
import test from 'node:test';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
const helper=await readFile(new URL('../lib/learner-explanation.ts',import.meta.url),'utf8');
const reviewed=await readFile(new URL('../lib/reviewed-explanations.ts',import.meta.url),'utf8');
const source=reviewed+'\n'+helper.replace(/^import \{reviewedExplanations\} from '.\/reviewed-explanations';\s*$/m,'');
const {learnerBasis,selectedCaseReason}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const base={id:'test',changedField:'value',title:'주기',approveFacts:[{value:'5년'}],rejectFacts:[{value:'1년'},{value:'2년'},{value:'3년'}],judgmentBasis:'법정 주기는 5년입니다. 반려값은 사용자 요청으로 수정했습니다.'};
test('production notes and other rejection options do not appear',()=>{
 const r={...base,judgmentBasis:'법정 주기는 5년입니다. 1년은 틀립니다. 2년은 틀립니다. 반려값은 사용자 요청으로 수정했습니다.'};
 assert.equal(learnerBasis(r,{value:'3년'},false),'법정 주기는 5년입니다.');
 assert.doesNotMatch(learnerBasis(base,{value:'5년'},true),/사용자|반려값|수정/);
});
test('employer is a legal party, not a production instruction',()=>{
 assert.equal(learnerBasis({...base,judgmentBasis:'보수월액보험료는 사용자가 납부합니다.'},{value:'공단'},false),'보수월액보험료는 사용자가 납부합니다.');
});
test('uses legal source fallback rather than the first approved example',()=>{
 assert.match(learnerBasis({...base,judgmentBasis:''},{value:'20일'},false,'신고는 14일 이내에 합니다.'),/14일 이내/);
});
test('only the selected blood-test option is explained',()=>{
 const r={...base,id:'BMR-A8-TEST-001'};
 const s=selectedCaseReason(r,{value:'HPV검사'},false);
 assert.match(s,/HPV검사/);assert.doesNotMatch(s,/ALT|소변|HTLV|B형간염|사용자/);
 const health=selectedCaseReason({...r,id:'BMR-A6-HEALTH-001'},{value:'소변검사'},false);
 assert.match(health,/소변검사/);assert.doesNotMatch(health,/청진|호흡 수|촉진/);
});
test('the two rejection paths for patient will have separate reasons',()=>{
 const r={...base,id:'LDA-A17-WILL-METHOD-001'};
 const self=selectedCaseReason(r,{value:'사전연명의료의향서의 내용을 환자가 스스로 확인하는 경우'},false);
 const doctors=selectedCaseReason(r,{value:'담당의사와 전문의 1명의 확인을 거친 경우'},false);
 assert.match(self,/환자/);assert.doesNotMatch(self,/가족|전문의/);
 assert.match(doctors,/가족의 진술/);assert.doesNotMatch(doctors,/의향서|자기 확인/);
});
test('threshold explanations preserve inclusive and exclusive limits',()=>{
 assert.match(selectedCaseReason({...base,id:'BMR-A7-SBP-001'},{value:'180'},false),/90mmHg 이상 180mmHg 미만/);
 assert.match(selectedCaseReason({...base,id:'BMR-A7-TEMP-001'},{value:'37.5'},true),/37.5℃를 초과/);
});
