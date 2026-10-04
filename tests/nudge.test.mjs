import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createServer} from 'vite';

const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const route=await vite.ssrLoadModule('/app/api/nudge/route.ts');
const sender='11111111-1111-4111-8111-111111111111';
const recipient='22222222-2222-4222-8222-222222222222';
const request=(body,auth=true)=>new Request('http://localhost/api/nudge',{
  method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-token'}:{})},body:JSON.stringify(body),
});

test('nudge endpoints require authentication',async()=>{
  assert.equal((await route.GET(new Request('http://localhost/api/nudge'))).status,401);
  assert.equal((await route.POST(request({recipientId:recipient},false))).status,401);
});

test('API scopes requests to the verified user and retains inbox delivery without device subscriptions',async()=>{
  const oldFetch=globalThis.fetch;
  const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://nudge-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-key';
  let rpcCalls=0,pushLookups=0,reject=false;
  globalThis.fetch=async(input,options)=>{
    const url=new URL(typeof input==='string'?input:input.url||input.href);
    if(url.pathname==='/auth/v1/user')return Response.json({id:sender,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}});
    if(url.pathname==='/rest/v1/rpc/send_friend_nudge'){
      rpcCalls++;
      assert.deepEqual(JSON.parse(options.body),{p_sender:sender,p_recipient:recipient});
      return Response.json(reject?{error:'이 친구에게는 오늘 이미 보냈습니다.'}:{title:'😊 친구가 콕 찔렀어요!',body:'같이 학습해요!'});
    }
    if(url.pathname==='/rest/v1/rpc/nudge_dashboard'){
      assert.deepEqual(JSON.parse(options.body),{p_user_id:sender});
      return Response.json({groupCode:'TEAM',completedToday:true,friends:[],received:[],sentToday:[]});
    }
    if(url.pathname==='/rest/v1/push_subscriptions'){
      pushLookups++;assert.equal(url.searchParams.get('user_id'),`eq.${recipient}`);
      return Response.json([]);
    }
    throw Error('Unexpected network call: '+url.pathname);
  };
  try{
    assert.equal((await route.POST(request({recipientId:'bad-id'}))).status,400);
    assert.equal(rpcCalls,0);
    const success=await route.POST(request({recipientId:recipient,senderId:recipient}));
    assert.equal(success.status,200);assert.deepEqual(await success.json(),{sent:0,inbox:true});
    assert.equal(pushLookups,1);
    reject=true;
    assert.equal((await route.POST(request({recipientId:recipient}))).status,409);
    assert.equal(pushLookups,1,'a rejected send must not send push');
    const dashboard=await route.GET(new Request('http://localhost/api/nudge?userId='+recipient,{headers:{Authorization:'Bearer test-token'}}));
    assert.equal(dashboard.status,200);assert.equal(dashboard.headers.get('Cache-Control'),'no-store');
  }finally{
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});
