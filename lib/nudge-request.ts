// Retry only read requests. A failed send may already have reached the server.
export async function requestNudgeJSON(method:'GET'|'POST',token:string,recipientId?:string,signal?:AbortSignal){
  const attempts=method==='GET'?2:1;
  for(let index=0;index<attempts;index++){
    if(signal?.aborted)throw new DOMException('Aborted','AbortError');
    const controller=new AbortController();
    const abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,10000);
    let response:Response;
    try{
      response=await fetch('/api/nudge',{method,signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({recipientId})}:{})});
    }catch{
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      if(index+1<attempts)continue;
      throw Error(method==='GET'?'친구 알림 연결이 잠시 끊겼습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.':'전송 결과를 확인하지 못했습니다. 친구 목록을 새로고침해 오늘 보냄 여부를 확인하세요.');
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    const result=await response.json().catch(()=>null);
    if(!response.ok){
      if(method==='GET'&&response.status>=500&&index+1<attempts)continue;
      throw Error(response.status===401?'로그인 상태가 만료됐습니다. 다시 로그인하세요.':result?.error||'친구 알림 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');
    }
    if(!result)throw Error(method==='POST'?'전송 결과를 확인하지 못했습니다. 친구 목록을 새로고침해 오늘 보냄 여부를 확인하세요.':'친구 정보를 확인하지 못했습니다. 앱을 새로고침하세요.');
    return result;
  }
  throw Error('친구 정보를 불러오지 못했습니다.');
}
