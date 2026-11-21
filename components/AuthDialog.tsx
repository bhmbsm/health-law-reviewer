'use client';
import {useState,type FormEvent} from 'react';
import AppDialog from './AppDialog';
import {supabase} from '../lib/supabase';
import {EMAIL_CONFIRMATION_GUIDE,isRegisteredStudyUser} from '../lib/study-access';

export default function AuthDialog({initialMode,onClose,onAuthenticated}:{initialMode:'signup'|'login';onClose:()=>void;onAuthenticated:()=>Promise<void>}){
 const [mode,setMode]=useState(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[nickname,setNickname]=useState('');
 const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   if(!supabase)throw Error('회원 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
   if(mode==='signup'){
    if(nickname.trim().length<2)throw Error('닉네임은 2~20자로 입력해 주세요.');
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{nickname:nickname.trim()},emailRedirectTo:window.location.origin}});
    if(error)throw error;
    if(data.session&&isRegisteredStudyUser(data.user)){await onAuthenticated();return;}
    setSent(true);
   }else{
    const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error)throw error;
    if(!isRegisteredStudyUser(data.user))throw Error('메일함에서 가입 인증 메일의 Confirm 링크를 누른 뒤 로그인해 주세요.');
    await onAuthenticated();
   }
  }catch(error){
   const message=(error as Error).message;
   setError(/Email not confirmed/i.test(message)?'이메일 인증이 필요합니다. 메일함의 가입 인증 메일에서 Confirm 링크를 눌러 주세요.':/Invalid login credentials/i.test(message)?'이메일 또는 비밀번호가 올바르지 않습니다. 가입한 이메일과 비밀번호를 확인해 주세요.':message);
  }finally{setBusy(false);}
 }
 return <AppDialog title={sent?'이메일 인증을 완료해 주세요':mode==='signup'?'회원가입':'로그인'} onClose={()=>{if(!busy)onClose();}}>
  {sent?<div role="status"><p><strong>{email.trim()}</strong> 주소로 가입 인증 메일을 보냈습니다.</p><p>{EMAIL_CONFIRMATION_GUIDE}</p><button className="primary" onClick={()=>{setSent(false);setMode('login');}}>인증 후 로그인하기</button></div>:<>
   <div className="auth-tabs"><button type="button" aria-pressed={mode==='signup'} disabled={busy} onClick={()=>{setMode('signup');setError('');}}>회원가입</button><button type="button" aria-pressed={mode==='login'} disabled={busy} onClick={()=>{setMode('login');setError('');}}>로그인</button></div>
   {mode==='signup'?<div className="auth-guide"><strong>가입 방법</strong><ol><li>이메일·비밀번호·닉네임을 입력합니다.</li><li>입력한 이메일의 메일함에서 가입 인증 메일을 엽니다.</li><li><strong>Confirm</strong> 링크를 누른 뒤 이 앱에서 로그인합니다.</li></ol><p>이메일 인증까지 완료해야 문제를 풀 수 있습니다. 스팸함도 확인해 주세요.</p></div>:<p>가입한 이메일과 비밀번호를 입력해 주세요. 처음이라면 ‘회원가입’을 선택하세요.</p>}
   <form onSubmit={submit} className="dialog-form">
    <label>이메일<input autoFocus type="email" required autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)} placeholder="인증 메일을 받을 이메일"/></label>
    <label>비밀번호<input type="password" required minLength={mode==='signup'?8:1} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
    {mode==='signup'&&<label>닉네임<input required minLength={2} maxLength={20} autoComplete="nickname" value={nickname} disabled={busy} onChange={e=>setNickname(e.target.value)}/></label>}
    {error&&<p role="alert" className="dialog-error">{error}</p>}
    <button type="submit" className="primary" disabled={busy}>{busy?'처리 중…':mode==='signup'?'가입하고 인증 메일 받기':'로그인'}</button>
   </form>
  </>}
 </AppDialog>;
}
