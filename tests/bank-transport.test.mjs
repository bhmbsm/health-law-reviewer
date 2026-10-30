import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {questionBankFixtures as payloads} from './fixtures/question-banks.mjs';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {packQuestionBanks,unpackQuestionBanks,loadQuestionBanks}=await vite.ssrLoadModule('/lib/bank-transport.ts');
const {GET}=await vite.ssrLoadModule('/app/api/question-bank/route.ts');
const {buildQuestionBank}=await vite.ssrLoadModule('/lib/question-bank.ts');
const rows=payloads.map(payload=>({payload}));
test('saved banks round-trip exactly, including every source, fact, answer and law text',()=>{
 const before=JSON.stringify(rows);const packed=packQuestionBanks(rows);
 assert.deepEqual(unpackQuestionBanks(JSON.parse(JSON.stringify(packed))),rows);
 assert.equal(JSON.stringify(rows),before);
 assert.ok(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(before)*0.7);
});
test('reconstructed banks still generate the same number of usable cases',async()=>{
 const cases=await buildQuestionBank(unpackQuestionBanks(packQuestionBanks(rows)));
 const original=await buildQuestionBank(rows);
 assert.equal(cases.length,13);assert.deepEqual(cases,original);assert.ok(cases.every(c=>c.rule.length>0));
});
test('fixed questions, empty banks and missing lawText stay unchanged',()=>{
 for(const input of [[],[{payload:{id:'custom-1',body:'사례',rule:'원문'}}],[{payload:{kind:'rule-bank',rules:[{id:'node',lawText:''},{id:'node-2'}]}}]])assert.deepEqual(unpackQuestionBanks(packQuestionBanks(input)),input);
 assert.throws(()=>unpackQuestionBanks({version:1,rows:[],texts:[],slots:[[0,0,0]]}),/원문 연결/);
});
const oldURL=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
after(()=>{if(oldURL===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldURL;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;});
const request=(token)=>new Request('https://app.test/api/question-bank',{headers:token?{Authorization:`Bearer ${token}`}:{}});
test('member route validates Auth and forwards the same bearer to the shared bank',async()=>{
 const oldFetch=globalThis.fetch;let requests=0;
 globalThis.fetch=async(url,options)=>{
  requests++;assert.equal(new Headers(options.headers).get('authorization'),'Bearer member-token');
  if(String(url).includes('/auth/v1/user'))return Response.json({id:'member-1',is_anonymous:false});
  assert.match(String(url),/\/rest\/v1\/shared_cases\?select=payload/);return Response.json(rows);
 };
 try{const response=await GET(request('member-token'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('vary'),'Authorization');assert.deepEqual(unpackQuestionBanks(await response.json()),rows);assert.equal(requests,2);}
 finally{globalThis.fetch=oldFetch;}
});
test('missing, forged, expired and anonymous credentials never read any question rows',async()=>{
 const oldFetch=globalThis.fetch;let requests=0;
 try{
  globalThis.fetch=async()=>{requests++;throw Error('must not fetch');};
  let response=await GET(request());assert.equal(response.status,401);assert.equal(requests,0);
  assert.deepEqual(await response.json(),{error:'로그인 후 사용 가능합니다'});
  for(const token of ['forged','expired']){
   globalThis.fetch=async url=>{assert.match(String(url),/\/auth\/v1\/user/);return Response.json({message:'Invalid token'},{status:401});};
   response=await GET(request(token));assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');
  }
  globalThis.fetch=async url=>{assert.match(String(url),/\/auth\/v1\/user/);return Response.json({id:'anonymous-1',is_anonymous:true});};
  response=await GET(request('anonymous'));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'로그인 후 사용 가능합니다'});
 }finally{globalThis.fetch=oldFetch;}
});
test('browser requires an access token, sends it without caching and handles session expiry',async()=>{
 const old=globalThis.fetch;let requests=0;
 try{
  globalThis.fetch=async(url,options)=>{requests++;assert.equal(url,'/api/question-bank');assert.equal(options.cache,'no-store');assert.equal(options.headers.Authorization,'Bearer member-token');return Response.json(packQuestionBanks(rows));};
  await assert.rejects(loadQuestionBanks(''),/로그인 후 사용 가능합니다/);assert.equal(requests,0);
  assert.deepEqual(await loadQuestionBanks('member-token'),rows);
  globalThis.fetch=async()=>Response.json({error:'로그인 후 사용 가능합니다'},{status:401});
  await assert.rejects(loadQuestionBanks('expired'),/로그인 후 사용 가능합니다/);
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
  await assert.rejects(loadQuestionBanks('member-token'),/연결이 지연/);
 }finally{globalThis.fetch=old;}
});
