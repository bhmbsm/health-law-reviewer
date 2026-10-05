import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as XLSX from 'xlsx';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {parseRuleBank,makeRuleCases,makeRuleCase,materializeFacts}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const {correctKnownMedicalRule}=await vite.ssrLoadModule('/lib/medical-rule-corrections.ts');
const Document=(await vite.ssrLoadModule('/components/story/StoryCaseDocument.tsx')).default;
const readFixture=async(name)=>JSON.parse(gunzipSync(Buffer.from(JSON.parse(await fs.readFile(new URL(name,import.meta.url),'utf8')).gzipBase64,'base64')).toString('utf8'));
const current=await readFixture('./medical-workbook-fixture.json');
const legacy=await readFixture('./medical-workbook-legacy-fixture.json');
function file(data){const book=XLSX.utils.book_new();for(const [name,rows]of Object.entries(data))XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),name);return new File([XLSX.write(book,{type:'buffer',bookType:'xlsx'})],'medical.xlsx');}
const bank=await parseRuleBank(file(current));
const rule=id=>{const r=bank.rules.find(x=>x.id===id);assert.ok(r,id);return r;};
const visible=c=>[c.body,...c.details,c.explanation].join('\n');
test('all 108 IDs are retained in the workbook; 107 enabled rules generate 518 variants',()=>{
 assert.equal(new Set(current['문항규칙'].slice(1).map(x=>x[0])).size,108);
 assert.equal(bank.rules.length,107);const cases=makeRuleCases([bank]);assert.equal(cases.length,518);
 assert.equal(new Set(cases.map(c=>c.id.split(':')[0])).size,107);
 assert.ok(!bank.rules.some(r=>r.id==='ML-A3-5-TARGET-001'));
 for(const c of cases)assert.doesNotMatch(visible(c),/RAND_|ROLE_OF|STAFF_MIN|DUTY_MIN|OMIT|\{[a-z_]+\}|undefined|있음입니다/);
});
test('every variant stays renderable across boundary draws and repeat draws',()=>{
 const random=Math.random;try{for(const draw of [0,0.5,0.999999]){Math.random=()=>draw;for(const c of makeRuleCases([bank]))assert.doesNotMatch(visible(c),/RAND_|undefined|\{[a-z_]+\}/);}}finally{Math.random=random;}
 for(let n=0;n<20;n++)for(const c of makeRuleCases([bank]))assert.doesNotMatch(visible(c),/RAND_|undefined|\{[a-z_]+\}/);
});
test('death timing uses one sampled value and the inclusive 48-hour legal boundary',()=>{
 const r=rule('ML-A17-DEATH-48-001');for(const [approved,side]of [[true,r.approveFacts],[false,r.rejectFacts]])side.forEach((f,i)=>{
  const c=makeRuleCase(bank,r,approved,i);const h=Number(f.elapsed_hours);assert.equal(h<=48,approved);
  assert.ok(c.body.includes(`${h}시간`));assert.match(c.explanation,/48시간/);assert.doesNotMatch(c.explanation,/법정 기준은.*6시간/);
 });
});
test('all general-hospital variants independently satisfy every department and bed condition',()=>{
 for(const r of bank.rules.filter(r=>r.id.startsWith('ML-A3-3-')))for(const [approved,side]of [[true,r.approveFacts],[false,r.rejectFacts]])for(const f of side)for(let n=0;n<25;n++){
  const s=materializeFacts(f),beds=Number(s.bed_count),departments=String(s.departments).split(', '),has=d=>departments.includes(d);
  const first=['내과','외과','소아청소년과','산부인과'];
  const valid=beds>=100&&(beds<=300?first.filter(has).length>=3&&departments.length>=7:first.every(has)&&has('정신건강의학과')&&has('치과')&&departments.length>=9)&&has('영상의학과')&&has('마취통증의학과')&&(has('진단검사의학과')||has('병리과'));
  assert.equal(valid,approved,r.id);assert.equal(beds%10,0);
 }
});
test('document and consent distractors alter only one listed item',()=>{
 for(const r of bank.rules.filter(r=>['document_items','consent_items'].includes(r.changedField))){
  const original=String(r.approveFacts[0]?.[r.changedField]??'').split(' / ');if(!r.approveFacts.length||!r.rejectFacts.length)continue;
  for(const f of r.rejectFacts){const replaced=String(f[r.changedField]).split(' / '),missing=original.filter(x=>!replaced.includes(x)),added=replaced.filter(x=>!original.includes(x));assert.equal(missing.length,1,r.id);assert.ok(added.length<=1,r.id);assert.ok(Math.abs(original.length-replaced.length)<=1,r.id);}
 }
 assert.equal(String(rule('MLR-A9-INJURY-001').approveFacts[0].document_items).split(' / ').length,9);
});
test('record-based diagnosis and autopsy rules remain approval-only and correlate professions',()=>{
 for(const id of ['ML-A17-RECORD-001','ML-A17-AUTOPSY-001']){const r=rule(id);assert.equal(r.rejectFacts.length,0);for(const f of r.approveFacts){const s=materializeFacts(f);assert.ok(String(s.substitute_issuer).endsWith(String(s.direct_actor)));}}
});
test('known legacy workbook receives exactly the reviewed rule content; future edits are preserved',async()=>{
 const old=await parseRuleBank(file(legacy));assert.equal(old.rules.length,107);assert.equal(makeRuleCases([old]).length,518);
 const compact=r=>JSON.stringify([r.id,r.scenario,r.approveFacts,r.rejectFacts,r.judgmentBasis,r.lawText,r.article]);
 assert.deepEqual(old.rules.map(compact),bank.rules.map(compact));
 const oldRule={...rule('ML-A17-DEATH-48-001'),auditVersion:undefined,scenario:'사용자가 나중에 검수해서 바꾼 문장'};
 assert.equal(correctKnownMedicalRule(oldRule),oldRule);
});
test('missing criteria, missing values and simultaneous fact changes stop upload explicitly',async()=>{
 for(const kind of ['criteria','values','facts']){const bad=structuredClone(current),id='ML-A17-DEATH-48-001';
  if(kind==='criteria')bad['판정기준']=bad['판정기준'].filter(r=>r[1]!==id);
  if(kind==='values')bad['값목록']=bad['값목록'].filter(r=>r[0]!=='VL-'+id);
  if(kind==='facts'){const r=bad['사례검증'].find(r=>r[0]===id);const f=JSON.parse(r[3]);f.extra_wrong_fact='다른 사실';r[3]=JSON.stringify(f);}
  await assert.rejects(()=>parseRuleBank(file(bad)));
 }
});
test('unanswered case markup has no answer or explanation; answered markup shows feedback',()=>{
 const selected=makeRuleCase(bank,rule('ML-A17-DEATH-48-001'),false,0),props={selected,index:0,total:5,saving:false,onAnswer(){},onNext(){},nextLabel:'다음 사건'};
 const initial=renderToStaticMarkup(React.createElement(Document,{...props,result:null}));assert.ok(!initial.includes(selected.explanation));assert.ok(!initial.includes('story-feedback'));assert.ok(!initial.includes('ink-stamp'));
 const answered=renderToStaticMarkup(React.createElement(Document,{...props,result:true}));assert.ok(answered.includes('story-feedback'));assert.ok(answered.includes('48시간'));assert.ok(answered.includes('다음 사건'));assert.ok(!answered.includes('decision-buttons'));
});
