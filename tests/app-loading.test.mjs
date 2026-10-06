import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/app-loading.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createSingleFlight,shouldReloadForAuth,seoulDay}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('concurrent startup/retry calls share one network job',async()=>{
 const run=createSingleFlight();let calls=0,finish;
 const task=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const a=run(task),b=run(task);assert.equal(a,b);
 await Promise.resolve();assert.equal(calls,1);finish('bank');
 assert.deepEqual(await Promise.all([a,b]),['bank','bank']);
 await run(async()=>{calls++;});assert.equal(calls,2);
});
test('a failed fetch can be retried and never leaves loading stuck',async()=>{
 const run=createSingleFlight();await assert.rejects(run(async()=>{throw Error('offline');}),/offline/);
 await run.wait();assert.equal(await run(async()=>42),42);
});
test('identity changes wait for the prior load, then fetch fresh records',async()=>{
 const run=createSingleFlight();let finish;
 const first=run(()=>new Promise(resolve=>{finish=resolve;}));await Promise.resolve();
 let waited=false;const wait=run.wait().then(()=>{waited=true;});
 await Promise.resolve();assert.equal(waited,false);finish('A');await first;await wait;
 assert.equal(waited,true);assert.equal(await run(async()=> 'B'),'B');
});
test('tab focus and token refresh do not reload a signed-in problem bank',()=>{
 assert.equal(shouldReloadForAuth('SIGNED_IN','A','A'),false);
 assert.equal(shouldReloadForAuth('TOKEN_REFRESHED','A','A'),false);
 assert.equal(shouldReloadForAuth('SIGNED_OUT',null,null),false);
 assert.equal(shouldReloadForAuth('SIGNED_IN',null,'A'),true);
 assert.equal(shouldReloadForAuth('SIGNED_IN','A','B'),true);
 assert.equal(shouldReloadForAuth('SIGNED_OUT','A',null),true);
 assert.equal(shouldReloadForAuth('USER_UPDATED','A','A'),true);
});
test('shared date formatter preserves Korea midnight and leap-day records',()=>{
 for(const date of ['2026-10-05T14:59:59Z','2026-10-05T15:00:00Z','2024-02-29T12:00:00Z'])
  assert.equal(seoulDay(date),new Date(date).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}));
 assert.equal(seoulDay('2026-10-05T15:00:00Z'),'2026-10-06');
});
