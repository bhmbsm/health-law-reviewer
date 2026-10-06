import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {packQuestionBanks,unpackQuestionBanks,loadPublicQuestionBanks}=await vite.ssrLoadModule('/lib/bank-transport.ts');
const {GET}=await vite.ssrLoadModule('/app/api/question-bank/route.ts');
const {buildQuestionBank}=await vite.ssrLoadModule('/lib/question-bank.ts');
const payloads=JSON.parse(readFileSync(new URL('./current-upload-fixture.json',import.meta.url),'utf8'));
const rows=payloads.map(payload=>({payload}));
test('saved banks round-trip exactly, including every source, fact, answer and law text',()=>{
 const before=JSON.stringify(rows);const packed=packQuestionBanks(rows);
 assert.deepEqual(unpackQuestionBanks(JSON.parse(JSON.stringify(packed))),rows);
 assert.equal(JSON.stringify(rows),before);
 assert.ok(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(before)*0.7);
});
test('reconstructed banks still generate the same number of usable cases',async()=>{
 const cases=await buildQuestionBank(unpackQuestionBanks(packQuestionBanks(rows)));
 assert.equal(cases.length,1910);assert.ok(cases.every(c=>c.rule.length>0));
});
test('fixed questions, empty banks and missing lawText stay unchanged',()=>{
 for(const input of [[],[{payload:{id:'custom-1',body:'사례',rule:'원문'}}],[{payload:{kind:'rule-bank',rules:[{id:'node',lawText:''},{id:'node-2'}]}}]])assert.deepEqual(unpackQuestionBanks(packQuestionBanks(input)),input);
 assert.throws(()=>unpackQuestionBanks({version:1,rows:[],texts:[],slots:[[0,0,0]]}),/원문 연결/);
});
test('public route reads only the public bank and sends no cached or private records',async()=>{
 const oldFetch=globalThis.fetch,oldURL=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
 let requests=0;
 globalThis.fetch=async url=>{requests++;assert.match(String(url),/\/rest\/v1\/shared_cases\?select=payload/);return Response.json(rows);};
 try{const response=await GET();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(unpackQuestionBanks(await response.json()),rows);assert.equal(requests,1);}
 finally{globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldURL;if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;}
});
test('browser loads a fresh bank and displays an error for a failed connection',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/question-bank');assert.equal(options.cache,'no-store');return Response.json(packQuestionBanks(rows));};
  assert.deepEqual(await loadPublicQuestionBanks(),rows);
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch');};
  await assert.rejects(loadPublicQuestionBanks(),/연결이 지연/);
 }finally{globalThis.fetch=old;}
});
