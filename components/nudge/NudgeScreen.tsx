'use client';

import {useEffect,useState} from 'react';
import {ArrowRight,BellRing,Send,X} from 'lucide-react';
import {DAILY_STUDY_TARGET,loadNudgeDashboard,sendNudge,type NudgeDashboard} from '../../lib/nudge';

type Props={userId?:string;groupCode:string;completedToday:boolean;onGoToday:()=>void;compact?:boolean};

export default function NudgeScreen({userId,groupCode,completedToday,onGoToday,compact=false}:Props){
  const [dashboard,setDashboard]=useState<NudgeDashboard|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [sending,setSending]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState(false);
  const [reload,setReload]=useState(0);

  useEffect(()=>{
    if(!userId)return;
    const controller=new AbortController();
    let active=true;
    let inFlight=false;
    const refresh=async()=>{
      if(inFlight||controller.signal.aborted)return;
      inFlight=true;
      try{
        const data=await loadNudgeDashboard(controller.signal);
        if(active){setDashboard(data);setError('');}
      }catch(reason){if(active)setError((reason as Error).message);}
      finally{inFlight=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},60000);
    const visible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('online',visible);
    return()=>{active=false;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
  },[userId,groupCode,completedToday,reload]);

  async function send(friendId:string){
    if(sending)return;
    setSending(friendId);setError('');setNotice('');
    try{
      const result=await sendNudge(friendId);
      setDashboard(current=>current?{...current,sentToday:[...current.sentToday,friendId]}:current);
      setNotice(result.sent>0?'😊 친구에게 찌르기 알림을 보냈습니다.':'😊 친구의 앱 알림함에 전달했습니다. 휴대폰 알림은 상대방의 알림 설정과 연결 상태에 따라 달라집니다.');
    }catch(reason){setError((reason as Error).message);}
    finally{setSending(null);setReload(value=>value+1);}
  }

  if(!userId)return compact?null:<section className="panel nudge-empty">로그인하면 친구에게 찌르기를 보낼 수 있습니다.</section>;
  if(compact&&!dashboard&&error)return <div className="nudge-home-bar" role="status"><small>{error}</small><button className="secondary" onClick={()=>setReload(value=>value+1)}>친구 알림 다시 연결</button></div>;
  if(!dashboard)return compact&&!error?null:<section className="panel" aria-busy={!error}>{error||'친구 정보를 불러오는 중…'}{error&&<button className="secondary" onClick={()=>setReload(value=>value+1)}>다시 시도</button>}</section>;
  const received=<div className={`received-nudges${compact?' compact-received':''}`} aria-label="받은 찌르기">
    <div className="compact-received-heading"><h2><BellRing size={18}/> 받은 찌르기</h2>{compact&&<button className="nudge-dismiss" aria-label="받은 찌르기 숨기기" onClick={()=>setDismissed(true)}><X size={17}/></button>}</div>
    {dashboard.received.map(nudge=><button className="received-nudge" key={nudge.id} onClick={onGoToday}><span><b>{nudge.senderName}</b>님의 응원<small>{nudge.message}</small></span><ArrowRight size={17}/></button>)}
  </div>;
  if(compact)return <div className="nudge-home-bar">{dashboard.received.length>0&&!dismissed&&received}{dashboard.completedToday&&<button className="primary nudge-open" onClick={()=>window.dispatchEvent(new Event('open-nudge-screen'))}><Send size={15}/> 친구 콕 찌르기</button>}</div>;
  const friends=dashboard.friends.filter(friend=>friend.solvedToday<DAILY_STUDY_TARGET);
  return <section className="nudge-screen">
    <div className="nudge-heading"><h1>친구 콕 찌르기</h1><button className="secondary" onClick={()=>setReload(value=>value+1)}>새로고침</button></div>
    {dashboard.received.length>0&&received}
    {!dashboard.groupCode?<section className="panel nudge-empty"><h2>친구 그룹을 연결해 주세요</h2><p>학습 기록 → 친구 심사실에서 친구와 같은 그룹 코드를 입력하세요.</p></section>:!dashboard.completedToday?<section className="panel nudge-empty"><h2>오늘 학습을 완료하면 보낼 수 있어요</h2><p>오늘의 학습 {DAILY_STUDY_TARGET}건을 마치면 같은 그룹 친구에게 응원을 보낼 수 있습니다.</p><button className="secondary" onClick={onGoToday}>오늘 학습으로 이동</button></section>:<section className="panel nudge-friends">
      <div className="section-heading"><h2>오늘 학습을 아직 마치지 않은 친구</h2><span>{dashboard.groupCode}</span></div>
      {friends.length?friends.map(friend=>{const sent=dashboard.sentToday.includes(friend.id);return <div className="nudge-friend" key={friend.id}><div><strong>{friend.nickname}</strong><small>오늘 {friend.solvedToday}/{DAILY_STUDY_TARGET}건</small></div><button className={sent?'secondary':'primary'} disabled={sent||sending!==null} onClick={()=>void send(friend.id)}>{sent?'오늘 보냄':sending===friend.id?'보내는 중…':'콕 찌르기'}{!sent&&<Send size={15}/>}</button></div>;}):<p>같은 그룹에 오늘 학습을 마치지 않은 친구가 없습니다.</p>}
    </section>}
    {error&&<p role="alert">{error}</p>}{notice&&<p className="nudge-notice" role="status">{notice}</p>}
    <p className="small">한국 시간 기준으로 친구 한 명에게 하루 한 번, 총 10번까지 보낼 수 있습니다. 받는 알림은 하루 최대 5번입니다.</p>
  </section>;
}
