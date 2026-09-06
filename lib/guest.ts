const COOKIE='__Host-law_guest';
export async function visitor(req:Request,create=false):Promise<{uid:string;cookie?:string;guest:boolean}|null>{
 const account=req.headers.get('oai-authenticated-user-id');
 if(account)return {uid:account,guest:false};
 const raw=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 let token=raw&&/^[0-9a-f]{64}$/.test(raw)?raw:null;
 let cookie:string|undefined;
 if(!token&&create){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');cookie=`${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;}
 if(!token)return null;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return {uid:'guest:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),cookie,guest:true};
}
