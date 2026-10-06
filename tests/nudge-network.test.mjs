import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/nudge-request.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {requestNudgeJSON}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
async function mockFetch(fake,run){const old=globalThis.fetch;globalThis.fetch=fake;try{await run();}finally{globalThis.fetch=old;}}
test('GET recovers from a transient network failure',async()=>{
  let calls=0;
  await mockFetch(async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return Response.json({friends:[]});},async()=>assert.deepEqual(await requestNudgeJSON('GET','token'),{friends:[]}));
  assert.equal(calls,2);
});
test('persistent GET failures show Korean guidance without a raw browser exception',async()=>{
  let calls=0;
  await mockFetch(async()=>{calls++;throw new TypeError('Failed to fetch');},async()=>assert.rejects(requestNudgeJSON('GET','token'),error=>error.message.includes('인터넷 연결')&&!error.message.includes('Failed to fetch')));
  assert.equal(calls,2);
});
test('POST is never retried when delivery status is unknown',async()=>{
  let calls=0;
  await mockFetch(async()=>{calls++;throw new TypeError('Failed to fetch');},async()=>assert.rejects(requestNudgeJSON('POST','token','friend'),/전송 결과를 확인하지 못했습니다/));
  assert.equal(calls,1);
});
test('GET retries server unavailability but does not retry invalid login',async()=>{
  let calls=0;
  await mockFetch(async()=>++calls===1?Response.json({error:'일시 장애'},{status:503}):Response.json({friends:[]}),async()=>assert.deepEqual(await requestNudgeJSON('GET','token'),{friends:[]}));
  assert.equal(calls,2);calls=0;
  await mockFetch(async()=>{calls++;return Response.json({error:'expired'},{status:401});},async()=>assert.rejects(requestNudgeJSON('GET','token'),/다시 로그인/));
  assert.equal(calls,1);
});
test('unmounted screen aborts without retrying a cancelled request',async()=>{
  const controller=new AbortController();let calls=0;
  await mockFetch(async(_url,options)=>{calls++;controller.abort();assert.equal(options.signal.aborted,true);throw new DOMException('Aborted','AbortError');},async()=>assert.rejects(requestNudgeJSON('GET','token',undefined,controller.signal),{name:'AbortError'}));
  assert.equal(calls,1);
});
