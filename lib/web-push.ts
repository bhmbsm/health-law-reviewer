import {createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign} from 'node:crypto';

export type PushSubscriptionData = {endpoint:string;keys:{p256dh:string;auth:string}};
const b64=(value:Buffer|string)=>Buffer.from(value).toString('base64url');
const unb64=(value:string)=>Buffer.from(value,'base64url');
const hkdf=(salt:Buffer,secret:Buffer,info:Buffer,length:number)=>{
  const prk=createHmac('sha256',salt).update(secret).digest();
  let output:Buffer=Buffer.alloc(0), previous:Buffer=Buffer.alloc(0), counter=1;
  while(output.length<length){previous=createHmac('sha256',prk).update(Buffer.concat([previous,info,Buffer.from([counter++])])).digest();output=Buffer.concat([output,previous]);}
  return output.subarray(0,length);
};

export function validatePushEndpoint(endpoint:string){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('HTTPS 푸시 주소가 필요합니다.');
  if(!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname))throw Error('지원하지 않는 푸시 서비스 주소입니다.');
  return url;
}

export function encryptPushPayload(subscription:PushSubscriptionData,payload:object){
  const receiver=unb64(subscription.keys.p256dh),auth=unb64(subscription.keys.auth);
  if(receiver.length!==65||receiver[0]!==4||auth.length!==16)throw Error('잘못된 푸시 구독 키입니다.');
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();
  const sender=ecdh.getPublicKey();
  const shared=ecdh.computeSecret(receiver);
  const keyInfo=Buffer.concat([Buffer.from('WebPush: info\0'),receiver,sender]);
  const ikm=hkdf(auth,shared,keyInfo,32);
  const salt=randomBytes(16);
  const cek=hkdf(salt,ikm,Buffer.from('Content-Encoding: aes128gcm\0'),16);
  const nonce=hkdf(salt,ikm,Buffer.from('Content-Encoding: nonce\0'),12);
  const plaintext=Buffer.concat([Buffer.from(JSON.stringify(payload)),Buffer.from([2])]);
  if(plaintext.length>3900)throw Error('푸시 본문이 너무 깁니다.');
  const cipher=createCipheriv('aes-128-gcm',cek,nonce);
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]);
  const header=Buffer.alloc(21);salt.copy(header);header.writeUInt32BE(4096,16);header[20]=sender.length;
  return Buffer.concat([header,sender,encrypted]);
}

export async function sendWebPush(subscription:PushSubscriptionData,payload:object){
  const url=validatePushEndpoint(subscription.endpoint);
  const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
  if(!publicKey||!privateKey||!subject||!/^mailto:.+@.+|^https:\/\//.test(subject))throw Error('VAPID 서버 설정이 없습니다.');
  const point=unb64(publicKey),scalar=unb64(privateKey);
  if(point.length!==65||point[0]!==4||scalar.length!==32)throw Error('VAPID 키 형식이 잘못되었습니다.');
  const key=createPrivateKey({key:{kty:'EC',crv:'P-256',x:b64(point.subarray(1,33)),y:b64(point.subarray(33)),d:b64(scalar)},format:'jwk'});
  const token=b64(JSON.stringify({typ:'JWT',alg:'ES256'}))+'.'+b64(JSON.stringify({aud:url.origin,exp:Math.floor(Date.now()/1000)+3600,sub:subject}));
  const signature=sign('sha256',Buffer.from(token),{key,dsaEncoding:'ieee-p1363'});
  const body=encryptPushPayload(subscription,payload);
  const response=await fetch(url,{method:'POST',headers:{Authorization:`vapid t=${token}.${b64(signature)}, k=${publicKey}`,TTL:'3600','Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'},body:new Uint8Array(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Object.assign(new Error(`푸시 서비스 응답: ${response.status}`),{status:response.status});
}
