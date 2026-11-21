import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {questionBankFixtures as payloads} from './fixtures/question-banks.mjs';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {packQuestionBanks,unpackQuestionBanks,loadMemberQuestionBanks}=await vite.ssrLoadModule('/lib/bank-transport.ts');
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

const member={id:'11111111-1111-4111-8111-111111111111',email:'test@example.test',email_confirmed_at:'2026-11-01T00:00:00Z',is_anonymous:false};
const request=()=>new Request('https://app.test/api/question-bank',{headers:{Authorization:'Bearer member-token'}});
test('unauthenticated requests never touch Auth or the question bank',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 try{const response=await GET(new Request('https://app.test/api/question-bank'));assert.equal(response.status,401);assert.equal(calls,0);assert.equal(response.headers.get('cache-control'),'no-store');}finally{globalThis.fetch=old;}
});
test('unconfirmed and anonymous users cannot download question payloads',async()=>{
 const old=globalThis.fetch;
 try{for(const user of [{...member,email_confirmed_at:null},{...member,is_anonymous:true}]){
  let calls=0;globalThis.fetch=async(url)=>{calls++;assert.match(String(url),/auth\/v1\/user/);return Response.json(user);};
  const response=await GET(request());assert.equal(response.status,401);assert.equal(calls,1);
 }}finally{globalThis.fetch=old;}
});
test('verified members read payloads with their own bearer and private cache headers',async()=>{
 const old=globalThis.fetch;const urls=[];
 globalThis.fetch=async(url,options)=>{urls.push(String(url));assert.equal(new Headers(options.headers).get('authorization'),'Bearer member-token');return Response.json(String(url).includes('/auth/v1/user')?member:rows);};
 try{const response=await GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('vary'),'Authorization');assert.deepEqual(unpackQuestionBanks(await response.json()),rows);assert.equal(urls.length,2);assert.match(urls[1],/shared_cases\?select=payload/);}finally{globalThis.fetch=old;}
});
test('bank failures do not expose account or administrator data',async()=>{
 const old=globalThis.fetch;
 try{globalThis.fetch=async(url)=>String(url).includes('/auth/v1/user')?Response.json(member):Response.json({message:'permission denied'},{status:403});const response=await GET(request());assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{error:'문제은행을 불러오지 못했습니다.'});}finally{globalThis.fetch=old;}
});
test('member browser always supplies bearer, bypasses caches, and handles expiration',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/question-bank');assert.equal(options.cache,'no-store');assert.equal(new Headers(options.headers).get('authorization'),'Bearer member-token');return Response.json(packQuestionBanks(rows));};
  assert.deepEqual(await loadMemberQuestionBanks('member-token'),rows);
  await assert.rejects(loadMemberQuestionBanks(''),/로그인/);
  globalThis.fetch=async()=>new Response(null,{status:401});await assert.rejects(loadMemberQuestionBanks('expired'),/만료/);
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};await assert.rejects(loadMemberQuestionBanks('member-token'),/연결이 지연/);
 }finally{globalThis.fetch=old;}
});
