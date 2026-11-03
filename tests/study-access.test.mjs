import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {isRegisteredStudyUser}=await vite.ssrLoadModule('/lib/study-access.ts');
const {GET}=await vite.ssrLoadModule('/app/api/study/route.ts');
test('only registered identities use account-owned records',()=>{
 assert.equal(isRegisteredStudyUser(null),false);
 assert.equal(isRegisteredStudyUser(undefined),false);
 assert.equal(isRegisteredStudyUser({id:''}),false);
 assert.equal(isRegisteredStudyUser({id:'anon',is_anonymous:true}),false);
 assert.equal(isRegisteredStudyUser({id:'member',is_anonymous:false}),true);
 assert.equal(isRegisteredStudyUser({id:'legacy-member'}),true);
});
test('guest study entry is available without account credentials',async()=>{
 const response=await GET();
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{message:'로그인 없이 학습할 수 있습니다. 게스트 기록은 이 브라우저에 저장됩니다.'});
});
