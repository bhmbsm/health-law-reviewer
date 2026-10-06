import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {caseNarrative}=await vite.ssrLoadModule('/lib/case-narrative.ts');
const {makeRuleCase}=await vite.ssrLoadModule('/lib/rule-bank.ts');
test('situation and all conditions precede the final question',()=>{
 const item={body:'종합병원을 개설하려고 합니다. 개설할 수 있을까요?',details:['개설 예정 병상은 670병상입니다.','설치 예정 진료과목은 내과, 외과입니다.']};
 assert.equal(caseNarrative(item),'종합병원을 개설하려고 합니다. 개설 예정 병상은 670병상입니다. 설치 예정 진료과목은 내과, 외과입니다. 개설할 수 있을까요?');
});
test('conditions preserve their order, quantities, dates and omission',()=>{
 const item={body:'2026년 12월 24일에 상담했습니다. 이 신청을 승인할 수 있는지 판단하세요.',details:['환자는 만 16세입니다.','신청인의 신분증을 가져왔습니다.','환자의 동의서를 가져왔습니다.']};
 const value=caseNarrative(item);assert.ok(value.includes('2026년 12월 24일'));assert.ok(value.includes('만 16세'));assert.ok(value.indexOf('신청인의 신분증')<value.indexOf('환자의 동의서'));assert.ok(value.endsWith('판단하세요.'));assert.ok(!value.includes('환자의 신분증'));
});
test('complete templates and empty details stay unchanged',()=>{
 assert.equal(caseNarrative({body:'제가 20병상 병원을 개설해도 될까요?',details:[]}),'제가 20병상 병원을 개설해도 될까요?');
 assert.equal(caseNarrative({body:'병상은 20개입니다. 가능한가요?',details:['병상은 20개입니다.']}),'병상은 20개입니다. 가능한가요?');
});
test('legacy advertisement prose never mixes one approval content with another',()=>{
 const rule={id:'ML-A57-EXEMPT-001',law:'의료법',article:'제57조',title:'광고',difficulty:'보통',note:'',scenario:'저는 의료기관의 장입니다. 의료기관의 명칭·소재지·전화번호만 담은 의료광고를 만들었습니다. 광고해도 될까요?',approveFacts:[{advertisement_content:'의료기관 개설자 또는 소속 의료인이 의료법 제77조제1항에 따라 전문의 자격을 인정받은 사실 및 그 전문과목'}],rejectFacts:[{advertisement_content:'신의료기술평가에서 안전성·유효성을 인정받은 기술을 사용한다는 사실'}],changedField:'advertisement_content',factLabels:{advertisement_content:'광고에 담은 내용'},factOrder:['advertisement_content'],lawText:'검수된 원문',source:'https://www.law.go.kr/법령/의료법/제57조'};
 for(const approved of [true,false]){
  const item=makeRuleCase({name:'광고 테스트'},rule,approved);
  assert.equal(item.answer,approved);assert.equal(item.details.length,0);
  assert.ok(!item.body.includes('명칭·소재지·전화번호'));assert.ok(!item.body.includes('제77조'));
  assert.ok(item.body.includes(approved?'전문의 자격':'신의료기술평가'));
  assert.equal(item.rule,'검수된 원문');
 }
});
