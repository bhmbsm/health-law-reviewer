import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';

const script=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(keys){
 const handlers={},deleted=[],navigated=[],requests=[];
 const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn,
  clients:{claim:async()=>{},matchAll:async()=>[
   {url:'https://example.test/?tab=free',navigate:async url=>navigated.push(url)},
   {url:'https://other.test/',navigate:async url=>navigated.push(url)}]}};
 const caches={keys:async()=>keys,delete:async key=>deleted.push(key),open:async()=>({put:async()=>{}})};
 vm.runInNewContext(script,{self,caches,URL,fetch:async(req,options)=>{requests.push(options);return {ok:false};}});
 return {handlers,deleted,navigated,requests};
}
test('upgrade reloads old application tabs once and deletes only application shell caches',async()=>{
 const w=worker(['law-review-shell-v6','law-review-shell-v7','unrelated-cache']);
 let pending;w.handlers.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(w.deleted,['law-review-shell-v6']);
 assert.deepEqual(w.navigated,['https://example.test/?tab=free&app_update=v7']);
 const clean=worker(['law-review-shell-v7']);clean.handlers.activate({waitUntil:p=>pending=p});await pending;
 assert.deepEqual(clean.navigated,[]);
});
test('navigation requests bypass browser HTML cache',async()=>{
 const w=worker([]);let response;
 w.handlers.fetch({request:{url:'https://example.test/',method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:()=>{}});
 await response;assert.equal(w.requests[0].cache,'no-store');
});
