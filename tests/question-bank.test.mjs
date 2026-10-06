import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {buildQuestionBank,selectRandomCases,ruleBankStorageId,assertReadyCase}=await vite.ssrLoadModule('/lib/question-bank.ts');
const {makeRuleCases}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const {randomChapterCases}=await vite.ssrLoadModule('/lib/story.ts');
const rule={id:'ML-test-consent',law:'의료법',article:'제24조의2',title:'서면 동의',difficulty:'보통',note:'',scenario:'저는 {performer_type}입니다. {procedure_action}을 하려고 합니다.',approveFacts:[{performer_type:'RAND_CHOICE:의사:치과의사:한의사',procedure_action:'RAND_CHOICE:수술:수혈:전신마취',consent_items:'진단명 / 의료인의 성명'}],rejectFacts:[{performer_type:'RAND_CHOICE:의사:치과의사:한의사',procedure_action:'RAND_CHOICE:수술:수혈:전신마취',consent_items:'진단명 / 의료인의 경력'}],changedField:'consent_items',factLabels:{consent_items:'동의서 내용'},factOrder:['consent_items'],lawText:'제24조의2 원문',source:'https://www.law.go.kr/법령/의료법/제24조의2'};
const bank={kind:'rule-bank',name:'의료법',rules:[rule]};
test('latest shared upload overrides raw stale browser cases and removed emergency cases',async()=>{
 const stale={id:'ML-test-consent:approve:0',law:'의료법',body:rule.scenario,details:['RAND_CHOICE:의사:한의사']};
 const removed={...stale,id:'custom-emergency',law:'응급의료에 관한 법률',source:rule.source};
 const loaded=await buildQuestionBank([{payload:bank}],[stale,removed],[],true);
 assert.equal(loaded.length,2);
 for(const item of loaded)assertReadyCase(item);
 assert.match(loaded[0].body,/저는 (의사|치과의사|한의사)입니다/);
 assert.deepEqual(await buildQuestionBank([],loaded,[bank],true),[]);
});
test('story refreshes every selected generated case rather than exposing spreadsheet templates',()=>{
 const cases=makeRuleCases([bank]);
 for(let i=0;i<50;i++){
  const result=randomChapterCases(cases,0);
  assert.equal(result.length,2);
  for(const item of result){assertReadyCase(item);assert.notEqual(item,cases.find(c=>c.id===item.id));}
 }
});
test('free questions sample distinct rules across laws, not spreadsheet row order',()=>{
 const pool=Array.from({length:30},(_,i)=>({id:'node-'+(i%10)+':'+(i<10?'approve':'reject')+':'+i,law:i%2?'의료법':'국민건강보험법',answer:i<10}));
 const orders=new Set();
 for(let i=0;i<50;i++){
  const selected=selectRandomCases(pool,5);
  assert.equal(selected.length,5);
  assert.equal(new Set(selected.map(c=>c.id.replace(/:(approve|reject):\d+$/,''))).size,5);
  orders.add(selected.map(c=>c.id).join(','));
 }
 assert.ok(orders.size>1);
 assert.deepEqual(selectRandomCases([],5),[]);
});
test('Korean workbook names have stable, separate storage ids',async()=>{
 const first=await ruleBankStorageId({name:'의료법_문항'});
 const second=await ruleBankStorageId({name:'응급의료법_문항'});
 assert.notEqual(first,second);
 assert.equal(first,await ruleBankStorageId({name:'의료법_문항'}));
});
test('a question cannot display an unrelated law source or unresolved tokens',()=>{
 assert.throws(()=>assertReadyCase({id:'x',law:'응급의료에 관한 법률',source:rule.source,body:'사례',details:[],explanation:''}),/법령명/);
 assert.throws(()=>assertReadyCase({id:'x',law:'의료법',source:rule.source,body:'저는 {performer_type}',details:[],explanation:''}),/변수/);
});

test('legacy randomized minimum beds explain the legal threshold without a RAND token',()=>{
 const cases=makeRuleCases([{...bank,rules:[{...rule,id:'bed-rule',scenario:'병원을 개설하려고 합니다.',changedField:'bed_count',approveFacts:[{bed_count:'RAND_INT:30:990:10'}],rejectFacts:[{bed_count:'20'}],factLabels:{bed_count:'병상'},factOrder:['bed_count']}]}]);
 assert.match(cases[1].explanation,/최소 병상 기준은 30병상/);
 assertReadyCase(cases[1]);
});
