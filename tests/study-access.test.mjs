import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const {isRegisteredStudyUser,LOGIN_REQUIRED_MESSAGE}=await vite.ssrLoadModule('/lib/study-access.ts');
const {default:StudyLoginGate}=await vite.ssrLoadModule('/components/StudyLoginGate.tsx');
const {GET}=await vite.ssrLoadModule('/app/api/study/route.ts');
test('only registered identities receive study access',()=>{
 assert.equal(isRegisteredStudyUser(null),false);
 assert.equal(isRegisteredStudyUser(undefined),false);
 assert.equal(isRegisteredStudyUser({id:''}),false);
 assert.equal(isRegisteredStudyUser({id:'anon',is_anonymous:true}),false);
 assert.equal(isRegisteredStudyUser({id:'member',is_anonymous:false}),true);
 assert.equal(isRegisteredStudyUser({id:'legacy-member'}),true);
});
test('logged-out entry displays the requested message and an accessible account action',()=>{
 const html=renderToStaticMarkup(React.createElement(StudyLoginGate,{onLogin:()=>{}}));
 assert.ok(html.includes(LOGIN_REQUIRED_MESSAGE));assert.ok(html.includes('로그인 · 회원가입'));
 assert.ok(html.includes('aria-labelledby="study-login-title"'));
 assert.ok(!html.includes('승인'));assert.ok(!html.includes('반려'));assert.ok(!html.includes('심사 시작'));
 const busy=renderToStaticMarkup(React.createElement(StudyLoginGate,{onLogin:()=>{},busy:true}));assert.match(busy,/<button[^>]*disabled/);
});
test('legacy study endpoint also requires a registered login',async()=>{
 const response=await GET(new Request('https://app.test/api/study'));
 assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:LOGIN_REQUIRED_MESSAGE});
});
