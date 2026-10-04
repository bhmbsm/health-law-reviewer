import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {createECDH,createDecipheriv,hkdfSync,createPublicKey,verify} from 'node:crypto';
import {createServer} from 'vite';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const push=await vite.ssrLoadModule('/lib/web-push.ts');

test('only known HTTPS push providers are accepted',()=>{
  for(const host of ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'])assert.equal(push.validatePushEndpoint(`https://${host}/send/a`).hostname,host);
  for(const url of ['http://fcm.googleapis.com/a','https://localhost/a','https://fcm.googleapis.com.evil.test/a','https://user@fcm.googleapis.com/a'])assert.throws(()=>push.validatePushEndpoint(url));
});

test('encrypted push content can be decrypted with the recipient key',()=>{
  const recipient=createECDH('prime256v1');recipient.generateKeys();
  const publicKey=recipient.getPublicKey();const auth=Buffer.alloc(16,7);
  const payload={title:'😊 학습 완료',body:'5건 완료',url:'/?screen=today'};
  const encoded=push.encryptPushPayload({endpoint:'https://fcm.googleapis.com/send/test',keys:{p256dh:publicKey.toString('base64url'),auth:auth.toString('base64url')}},payload);
  const salt=encoded.subarray(0,16);const sender=encoded.subarray(21,21+encoded[20]);
  const shared=recipient.computeSecret(sender);
  const ikm=Buffer.from(hkdfSync('sha256',shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),publicKey,sender]),32));
  const cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const ciphertext=encoded.subarray(21+sender.length);
  const decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(ciphertext.subarray(-16));
  const plain=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);
  assert.equal(plain.at(-1),2);assert.deepEqual(JSON.parse(plain.subarray(0,-1)),payload);
});

test('VAPID signature and audience are valid without sending a real notification',async()=>{
  const envKeys=['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
  const saved=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));const originalFetch=globalThis.fetch;
  const sender=createECDH('prime256v1');sender.generateKeys();const recipient=createECDH('prime256v1');recipient.generateKeys();
  process.env.VAPID_PUBLIC_KEY=sender.getPublicKey().toString('base64url');process.env.VAPID_PRIVATE_KEY=sender.getPrivateKey().toString('base64url');process.env.VAPID_SUBJECT='https://health-law-reviewer.vercel.app';
  try{
    globalThis.fetch=async(url,options)=>{
      assert.equal(url.origin,'https://fcm.googleapis.com');
      const token=options.headers.Authorization.match(/^vapid t=([^,]+),/)[1];const [header,body,signature]=token.split('.');
      assert.equal(JSON.parse(Buffer.from(body,'base64url')).aud,url.origin);
      const point=sender.getPublicKey();const key=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:point.subarray(1,33).toString('base64url'),y:point.subarray(33).toString('base64url')}});
      assert.ok(verify('sha256',Buffer.from(`${header}.${body}`),{key,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
      return new Response(null,{status:201});
    };
    await push.sendWebPush({endpoint:'https://fcm.googleapis.com/send/test',keys:{p256dh:recipient.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,3).toString('base64url')}},{title:'test'});
  }finally{globalThis.fetch=originalFetch;for(const key of envKeys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

test('push routes reject unauthenticated requests',async()=>{
  const subscribe=await vite.ssrLoadModule('/app/api/push/subscribe/route.ts');
  const testRoute=await vite.ssrLoadModule('/app/api/push/test/route.ts');
  assert.equal((await subscribe.POST(new Request('http://localhost/api/push/subscribe',{method:'POST'}))).status,401);
  assert.equal((await subscribe.DELETE(new Request('http://localhost/api/push/subscribe',{method:'DELETE'}))).status,401);
  assert.equal((await testRoute.POST(new Request('http://localhost/api/push/test',{method:'POST'}))).status,401);
});

test('service worker displays a push and confines notification links to this app',async()=>{
  const listeners={};let displayed;
  const origin='https://health-law-reviewer.vercel.app';
  const context={URL,self:{location:{origin},addEventListener:(name,handler)=>listeners[name]=handler,registration:{showNotification:async(title,options)=>{displayed={title,...options};}}}};
  vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  let pending;listeners.push({data:{json:()=>({title:'😊 테스트',url:'https://outside.example/'})},waitUntil:promise=>pending=promise});await pending;
  assert.equal(displayed.title,'😊 테스트');assert.equal(displayed.data.url,`${origin}/?screen=today`);
});
