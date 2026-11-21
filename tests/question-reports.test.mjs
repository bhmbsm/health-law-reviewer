import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {questionReportPayload,submitQuestionReport,readReportCase}=await vite.ssrLoadModule('/lib/question-reports.ts');
const {caseNarrative}=await vite.ssrLoadModule('/lib/case-narrative.ts');
const {cases}=await vite.ssrLoadModule('/lib/cases.ts');
const item=cases[0];
test('malformed stored snapshots cannot inject non-text values into the inbox',()=>{
 for(const value of [null,{}, {law:{html:'untrusted'},body:12,explanation:null,answer:'true'}]){
  const result=readReportCase(value);assert.equal(typeof result.law,'string');assert.equal(typeof result.body,'string');assert.equal(typeof result.explanation,'string');assert.equal(result.answer,false);
 }
});
test('reports preserve the displayed variant, decision, explanation and source without regenerating',()=>{
 const a={...item,body:'이번에 실제 출제된 123병상 사례입니다.',details:['무작위 조건: 9명'],answer:true};
 const b={...a,body:'다른 456병상 사례입니다.',answer:false};
 const report=questionReportPayload(a,'  조건과 정답이 다릅니다.  ','report-1','member-1');
 assert.equal(report.case_snapshot.body,caseNarrative(a));assert.equal(report.case_snapshot.answer,true);assert.equal(report.case_snapshot.explanation,a.explanation);assert.equal(report.case_snapshot.source,a.source);
 assert.equal(report.message,'조건과 정답이 다릅니다.');assert.equal(report.reporter_id,'member-1');assert.equal(report.case_id,item.id);
 assert.notDeepEqual(report.case_snapshot,questionReportPayload(b,'신고','report-2','member-1').case_snapshot);
 assert.deepEqual(a.details,['무작위 조건: 9명']);
 for(const message of ['','   ','a'.repeat(2001)])assert.throws(()=>questionReportPayload(item,message,'id','member'),/1~2,000/);
});
test('sending a report requires a verified member and never asks for report read access',async()=>{
 let inserted;
 const client={auth:{getUser:async()=>({data:{user:{id:'member',email_confirmed_at:'now'}},error:null})},from:table=>{assert.equal(table,'question_reports');return {insert:async payload=>{inserted=payload;return {error:null};}};}};
 await submitQuestionReport(client,item,'오류 확인 요청','request-id');assert.equal(inserted.reporter_id,'member');assert.equal(inserted.id,'request-id');
 for(const user of [null,{id:'unconfirmed'},{id:'anonymous',email_confirmed_at:'now',is_anonymous:true}]){
  client.auth.getUser=async()=>({data:{user},error:null});inserted=null;
  await assert.rejects(submitQuestionReport(client,item,'신고','id'),/이메일 인증/);assert.equal(inserted,null);
 }
});
test('lost responses can be retried and real submission failures retain a useful error',async()=>{
 let error={code:'23505'};
 const client={auth:{getUser:async()=>({data:{user:{id:'member',email_confirmed_at:'now'}},error:null})},from:()=>({insert:async()=>({error})})};
 await submitQuestionReport(client,item,'신고','same-id');error={code:'42501'};
 await assert.rejects(submitQuestionReport(client,item,'신고','same-id'),/작성 내용은 유지/);
});
test('both unanswered and answered case screens expose report actions',async()=>{
 const {default:CaseDesk}=await vite.ssrLoadModule('/components/CaseDesk.tsx');
 const props={item,meta:[],saving:false,onAnswer:()=>{},onNext:()=>{},nextLabel:'다음'};
 const before=renderToStaticMarkup(React.createElement(CaseDesk,{...props,result:null}));
 const after=renderToStaticMarkup(React.createElement(CaseDesk,{...props,result:false}));
 assert.equal((before.match(/문제 신고/g)||[]).length,1);assert.equal((after.match(/문제 신고/g)||[]).length,2);
 assert.match(after,/심사 결과와 해설/);
});
