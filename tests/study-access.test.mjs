import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {isRegisteredStudyUser}=await vite.ssrLoadModule('/lib/study-access.ts');
const {GET}=await vite.ssrLoadModule('/app/api/study/route.ts');
test('only email-confirmed registered identities can study',()=>{
 for(const user of [null,undefined,{id:''},{id:'anon',is_anonymous:true,email_confirmed_at:'now'},{id:'unconfirmed'},{id:'pending',email_confirmed_at:null}])assert.equal(isRegisteredStudyUser(user),false);
 assert.equal(isRegisteredStudyUser({id:'member',is_anonymous:false,email_confirmed_at:'2026-11-01'}),true);
});
test('study entry requires authentication even through direct requests',async()=>{
 const response=await GET(new Request('https://app.test/api/study'));
 assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');assert.match((await response.json()).error,/이메일 인증/);
});
