/** Share concurrent loads, but never retain a settled bank or another user's records. */
export function createSingleFlight<T>() {
 let pending:Promise<T>|null=null;
 const run=(task:()=>Promise<T>):Promise<T>=>{
  if(pending)return pending;
  const request=Promise.resolve().then(task);
  pending=request;
  const clear=()=>{if(pending===request)pending=null;};
  void request.then(clear,clear);
  return request;
 };
 run.wait=()=>pending?.then(()=>undefined,()=>undefined)||Promise.resolve();
 return run;
}

/** SIGNED_IN is also emitted when an already signed-in browser tab regains focus. */
export function shouldReloadForAuth(event:string,loadedUser:string|null|undefined,nextUser:string|null):boolean {
 return event==='USER_UPDATED'||((event==='SIGNED_IN'||event==='SIGNED_OUT')&&loadedUser!==nextUser);
}

// Reuse the expensive ICU formatter instead of constructing it for every attempt/render.
const dateFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export const seoulDay=(value:Date|string)=>dateFormatter.format(new Date(value));
