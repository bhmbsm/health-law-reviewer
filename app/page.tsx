'use client';
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {loadPublicQuestionBanks} from '../lib/bank-transport';
import {isRegisteredStudyUser} from '../lib/study-access';
import CaseDesk from '../components/CaseDesk';
import {reviewCaseIds,readReviewTimestamps} from '../lib/review-inbox';
import {nextFreeStudyCase,studySummary,type StudySession} from '../lib/study-session';
import {createSingleFlight,shouldReloadForAuth,seoulDay} from '../lib/app-loading';
import {BookOpen,LayoutDashboard,Waypoints,Files,RotateCcw,ChartNoAxesCombined,Library,Flame,ArrowRight,ShieldCheck,ChevronRight,Download,Upload,CheckCircle2,Stamp,Scale,ArrowLeft,Share2,Heart,Target,UserRound} from 'lucide-react';
import {cases as initialCases,chapters,type Case} from '../lib/cases';
import type {RuleBank} from '../lib/rule-bank';
import {isRuleBank,buildQuestionBank,ruleBankStorageId,assertReadyCase,studentCaseTitle,lawCategory} from '../lib/question-bank';
import {studyLaws,storyLaw} from '../lib/story-curriculum';
import {LawBookContext,LawBookDialog,BookSprite,buildLawEntries} from '../components/LawBook';
const AdminLearningRecords=dynamic(()=>import('../components/admin/AdminLearningRecords'),{ssr:false,loading:()=> <section className="panel" role="status">관리자 기록 화면을 불러오는 중입니다…</section>});
const StoryCampaign=dynamic(()=>import('../components/story/StoryCampaign'),{ssr:false,loading:()=> <section className="panel" role="status">스토리 화면을 불러오는 중입니다…</section>});
import InstallGuide from '../components/pwa/InstallGuide';
import ReadingSettings from '../components/pwa/ReadingSettings';
import NotificationButton from '../components/pwa/NotificationButton';
import NudgeScreen from '../components/nudge/NudgeScreen';
import {DAILY_STUDY_TARGET} from '../lib/nudge';
import {createUUID} from '../lib/uuid';
import {supabase} from '../lib/supabase';
import {unsubscribeCurrentDevice} from '../lib/push-client';
type Attempt={id:string;case_id:string;mode:string;chapter:number;choice:number|null;correct:number;hint:number;duration:number;created:string};
type LocalProgress={attempts:Attempt[];cases:Case[];ruleBanks?:RuleBank[]};
const STORAGE_KEY='health-law-reviewer-progress-v1';
const REVIEW_DISMISSALS_KEY='health-law-review-dismissals-v1';
const REVIEW_ADDITIONS_KEY='health-law-review-additions-v1';
function readLocalReview(key:string){try{return readReviewTimestamps(localStorage.getItem(key));}catch{return {};}}

function readProgress():LocalProgress{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return {attempts:[],cases:[],ruleBanks:[]};const data=JSON.parse(raw);return {attempts:Array.isArray(data.attempts)?data.attempts:[],cases:Array.isArray(data.cases)?data.cases:[],ruleBanks:Array.isArray(data.ruleBanks)?data.ruleBanks.filter(isRuleBank):[]};}catch{return {attempts:[],cases:[],ruleBanks:[]};}}
function writeProgress(data:LocalProgress){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
const day=seoulDay;
const modes:Record<string,string>={story:'스토리 심사',free:'자유 심사',review:'오답 재심사',audit:'감사 재심사'};
const nav=[['home','오늘의 심사실',LayoutDashboard],['story','스토리 모드',Waypoints],['free','자유 심사',Files],['review','오답 재심사',RotateCcw],['stats','학습 기록',ChartNoAxesCombined],['bank','문항 관리',Library],['admin-records','전체 학습 기록',ShieldCheck]] as const;
function download(name:string,content:string,type='application/json'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
const Progress=({value}:{value:number})=><div className="progress"><span style={{width:`${Math.min(100,value)}%`}}/></div>;
const Stat=({label,value,sub}:{label:string;value:string;sub:string})=><div className="stat"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
export default function App(){
const [tab,setTab]=useState('home'),[bank,setBank]=useState<Case[]>([]),[attempts,setAttempts]=useState<Attempt[]>([]),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('전체'),[difficulty,setDifficulty]=useState('전체'),[search,setSearch]=useState('');
const [session,setSession]=useState<StudySession|null>(null),[result,setResult]=useState<boolean|null>(null),[,setHint]=useState(false),[usedHint,setUsedHint]=useState(false),[finished,setFinished]=useState(false),[toast,setToast]=useState(''),[sound,setSound]=useState(false),[installPrompt,setInstallPrompt]=useState<any>(null);
const [reviewDismissals,setReviewDismissals]=useState<Record<string,string>>({});
const [reviewAdditions,setReviewAdditions]=useState<Record<string,string>>({});
const [answeredUnknown,setAnsweredUnknown]=useState(false);
const [member,setMember]=useState<{id:string;email:string;nickname:string;isAdmin:boolean;groupCode:string}|null>(null);
const [friendLeaders,setFriendLeaders]=useState<{nickname:string;solved:number;correct:number;accuracy:number}[]>([]),[groupCode,setGroupCode]=useState('');
const startTime=useRef(Date.now()),requestId=useRef(''),fileRef=useRef<HTMLInputElement>(null),lock=useRef(false);
const loadOnce=useRef(createSingleFlight<void>()),loadedUser=useRef<string|null|undefined>(undefined);
const authRevision=useRef(0);
function clearStudyAccess(){
 setMember(null);setBank([]);setAttempts([]);setReviewDismissals({});setReviewAdditions({});setFriendLeaders([]);setGroupCode('');setSession(null);setFinished(false);setResult(null);setHint(false);setUsedHint(false);setAnsweredUnknown(false);
}
function load(){return loadOnce.current(loadData);}
async function loadData(){
 const revision=authRevision.current;setError('');
 try{
  const saved=readProgress();
  // Public course content is independent of account authentication.
  const bankRequest=(supabase?loadPublicQuestionBanks().then(data=>buildQuestionBank(data)):buildQuestionBank([],saved.cases,saved.ruleBanks,false))
   .then(bank=>({bank,error:null as Error|null})).catch(error=>({bank:[] as Case[],error:error as Error}));
  const loadGuest=async()=>{
   const shared=await bankRequest;
   if(revision!==authRevision.current)return;
   if(shared.error)throw shared.error;
   loadedUser.current=null;setMember(null);setFriendLeaders([]);setGroupCode('');
   setAttempts(saved.attempts);setBank(shared.bank);
   setReviewDismissals(readLocalReview(REVIEW_DISMISSALS_KEY));
   setReviewAdditions(readLocalReview(REVIEW_ADDITIONS_KEY));setReady(true);
  };
  if(!supabase){await loadGuest();return;}
  const {data:{session:authSession},error:sessionError}=await supabase.auth.getSession();
  if(sessionError){await loadGuest();setToast('계정 연결을 확인하지 못해 게스트 기록으로 시작합니다.');return;}
  if(revision!==authRevision.current)return;
  if(!authSession){await loadGuest();return;}
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(revision!==authRevision.current)return;
  if(userError||!isRegisteredStudyUser(user)){await loadGuest();return;}
  let [{data:rows,error:attemptError},{data:profile,error:profileLookupError},{data:dismissals,error:dismissalError},{data:additions,error:additionError}]=await Promise.all([
   supabase.from('attempts').select('*').eq('user_id',user.id).order('created'),
   supabase.from('profiles').select('nickname,is_admin,group_code').eq('id',user.id).maybeSingle(),
   supabase.from('review_dismissals').select('case_id,dismissed_at').eq('user_id',user.id),
   supabase.from('review_additions').select('case_id,added_at').eq('user_id',user.id)
  ]);
  if(revision!==authRevision.current)return;
  if(profileLookupError||attemptError)throw new Error('서버 기록을 불러오지 못했습니다.');
  if(dismissalError||additionError)throw new Error('재심사 목록을 불러오지 못했습니다.');
  if(!profile){
   const nickname=String(user.user_metadata?.nickname||'심사관').slice(0,20);
   const {data,error:profileError}=await supabase.from('profiles').insert({id:user.id,nickname}).select('nickname,is_admin,group_code').single();
   if(profileError){
    if(profileError.code!=='23505')throw new Error('프로필 생성에 실패했습니다: '+profileError.message);
    const {data:existing}=await supabase.from('profiles').select('nickname,is_admin,group_code').eq('id',user.id).maybeSingle();
    if(existing)profile=existing;
    else{
     const uniqueName=nickname.slice(0,11)+'-'+user.id.slice(0,7);
     const {data:fallback,error:fallbackError}=await supabase.from('profiles').insert({id:user.id,nickname:uniqueName}).select('nickname,is_admin,group_code').single();
     if(fallbackError)throw new Error('프로필 생성에 실패했습니다: '+fallbackError.message);
     profile=fallback;
    }
   }else profile=data;
  }
  const shared=await bankRequest;
  if(revision!==authRevision.current)return;
  if(shared.error)throw shared.error;
  const code=profile?.group_code||'';
  loadedUser.current=user.id;
  setMember({id:user.id,email:user.email||'',nickname:profile?.nickname||'심사관',isAdmin:!!profile?.is_admin,groupCode:code});
  setGroupCode(code);setAttempts((rows||[]) as Attempt[]);setBank(shared.bank);
  setReviewDismissals(Object.fromEntries((dismissals||[]).map(row=>[row.case_id,row.dismissed_at])));
  setReviewAdditions(Object.fromEntries((additions||[]).map(row=>[row.case_id,row.added_at])));
  setReady(true);
 }catch(e){if(revision===authRevision.current){clearStudyAccess();setReady(false);setError((e as Error).message);}}
}
useEffect(()=>{
  setFriendLeaders([]);
  if(tab!=='stats'||!member?.groupCode||!supabase)return;
  let active=true;
  void supabase.rpc('friend_leaderboard').then(({data,error})=>{if(active&&!error)setFriendLeaders(data||[]);});
  return()=>{active=false;};
},[tab,member?.id,member?.groupCode]);
async function accountAction(){if(!supabase){setError('회원 서버 설정이 없습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하세요.');return;}if(busy)return;setBusy(true);setError('');try{if(member){if(!confirm('로그아웃할까요?'))return;try{await unsubscribeCurrentDevice();}catch{}const {error}=await supabase.auth.signOut();if(error)throw error;authRevision.current++;clearStudyAccess();setReady(false);setToast('로그아웃했습니다.');await loadOnce.current.wait();await load();return;}const signup=confirm('확인을 누르면 회원가입, 취소를 누르면 로그인입니다.');const email=prompt('이메일 주소를 입력하세요.')?.trim();if(!email)return;const password=prompt('비밀번호를 입력하세요. (8자 이상 권장)');if(!password)return;if(signup){const nickname=prompt('앱에서 표시할 닉네임을 입력하세요. (2~20자)')?.trim();if(!nickname)return;if(nickname.length<2||nickname.length>20){setError('닉네임은 2~20자로 입력하세요.');return;}const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nickname}}});if(error)throw error;setToast(data.session?'회원가입되었습니다.':'인증 메일을 확인한 뒤 로그인하세요.');}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setToast('로그인했습니다.');}await loadOnce.current.wait();await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
useEffect(()=>{
 let active=true;const timers=new Set<ReturnType<typeof setTimeout>>();
 void load();if(!supabase)return;
 const {data:{subscription}}=supabase.auth.onAuthStateChange((event,authSession)=>{
  if(!['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event))return;
  const nextUser=isRegisteredStudyUser(authSession?.user)?authSession!.user.id:null;
  if(event==='SIGNED_OUT'||(loadedUser.current!==undefined&&nextUser!==loadedUser.current)){
   authRevision.current++;clearStudyAccess();setReady(nextUser===null);
  }
  // Leave the auth callback (and its lock) before calling any Supabase API.
  const timer=setTimeout(async()=>{
   timers.delete(timer);if(!active)return;
   await loadOnce.current.wait();
   if(!active||!shouldReloadForAuth(event,loadedUser.current,nextUser))return;
   setReady(false);await load();
  },0);timers.add(timer);
 });
 return()=>{active=false;for(const timer of timers)clearTimeout(timer);subscription.unsubscribe();};
},[]);useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t)}},[toast]);
useEffect(()=>{const deepLink=new URLSearchParams(window.location.search).get('tab');if(['story','free','review'].includes(deepLink||''))setTab(deepLink!);if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});const onInstall=(event:any)=>{event.preventDefault();setInstallPrompt(event)};window.addEventListener('beforeinstallprompt',onInstall);return()=>window.removeEventListener('beforeinstallprompt',onInstall)},[]);
useEffect(()=>{if(fileRef.current)fileRef.current.accept='.json,application/json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';},[tab,member]);
const today=day(new Date());
const inReview=useMemo(()=>reviewCaseIds(attempts,reviewAdditions,reviewDismissals),[attempts,reviewAdditions,reviewDismissals]);
const {todayAttempts,correctCount,accuracy,xp,level,wrong,days,streak}=useMemo(()=>{
 const todayAttempts:Attempt[]=[],days=new Map<string,number>();
 let correctCount=0,xp=0;
 for(const a of attempts){const date=day(a.created);if(date===today)todayAttempts.push(a);if(a.correct)correctCount++;xp=Math.max(0,xp+(a.correct?20:-5));days.set(date,(days.get(date)||0)+1);}
 const wrong=bank.filter(c=>inReview.has(c.id));
 let streak=0;const d=new Date(today+'T12:00:00+09:00');
 if((days.get(today)||0)<DAILY_STUDY_TARGET)d.setDate(d.getDate()-1);
 while((days.get(day(d))||0)>=DAILY_STUDY_TARGET){streak++;d.setDate(d.getDate()-1);}
 return {todayAttempts,correctCount,accuracy:attempts.length?Math.round(correctCount/attempts.length*100):0,xp,level:Math.min(4,Math.floor(xp/100)),wrong,days,streak};
},[attempts,bank,today,inReview]);
// Scroll only when a new question is mounted, never when its answer is shown.
useEffect(()=>{
 if(!session||finished)return;
 const frame=window.requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 return()=>window.cancelAnimationFrame(frame);
},[session?.queue,session?.index,finished]);
const current=session?.queue[session.index];
const laws=useMemo(()=>Array.from(new Set(bank.map(c=>lawCategory(c.law)))),[bank]);
const caseById=useMemo(()=>new Map(bank.map(c=>[c.id,c])),[bank]);
const lawEntries=useMemo(()=>buildLawEntries(bank),[bank]);
const [lawPanelOpen,setLawPanelOpen]=useState(false),[lawDialogOpen,setLawDialogOpen]=useState(false);
const closeLawDialog=useCallback(()=>setLawDialogOpen(false),[]);
const lawBook=useMemo(()=>({entries:lawEntries,open:lawPanelOpen,setOpen:setLawPanelOpen}),[lawEntries,lawPanelOpen]);
const storyAttempts=useMemo(()=>attempts.filter(a=>a.mode==='story').map(a=>({case_id:a.case_id,chapter:a.chapter})),[attempts]);
const sessionSummary=session?studySummary(session):null;
useEffect(()=>{const bridge=(window as any).AndroidWidget;if(bridge?.updateWidget){const last=attempts.length?day(attempts[attempts.length-1].created):'';bridge.updateWidget(JSON.stringify({nickname:member?.nickname||'심사관',streak,todaySolved:todayAttempts.length,lastStudyDate:last}));}},[attempts,member,streak,todayAttempts.length]);
function go(t:string,keepFilter=false){if(busy)return;setTab(t);setSession(null);setFinished(false);setError('');if(!keepFilter)setFilter('전체');window.scrollTo({top:0,behavior:'smooth'});}
function goToday(){setTab('home');setSession(null);setFinished(false);window.history.replaceState(null,'','/?screen=today');window.scrollTo({top:0,behavior:'smooth'});}
useEffect(()=>{const openNudge=()=>{if(lock.current)return;setTab('nudge');setSession(null);setFinished(false);setError('');setFilter('전체');window.scrollTo({top:0,behavior:'smooth'});};window.addEventListener('open-nudge-screen',openNudge);return()=>window.removeEventListener('open-nudge-screen',openNudge);},[]);
useEffect(()=>{if(new URLSearchParams(window.location.search).get('screen')==='today'){const timer=window.setTimeout(()=>{setTab('home');setSession(null);setFinished(false);document.getElementById('today-learning')?.scrollIntoView({behavior:'smooth'});},0);return()=>window.clearTimeout(timer);}},[]);
async function installApp(){if(!installPrompt){setToast('브라우저 메뉴 → “홈 화면에 추가”');return;}installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);}
async function begin(queue:Case[],mode:string){
 if(!ready||!queue.length||lock.current)return;
 const revision=authRevision.current;
 try{
  const {refreshRuleCase}=await import('../lib/rule-bank');
  if(revision!==authRevision.current)return;
  const first=mode==='free'?nextFreeStudyCase(queue,[]):null;
  const generated=(mode==='free'?(first?[first.item]:[]):queue).map(refreshRuleCase);
  if(!generated.length)return;generated.forEach(assertReadyCase);
  setSession({queue:generated,index:0,mode,right:0,answered:0,unknown:0,pool:mode==='free'?queue:[],seenIds:first?.seenIds||[]});
  setResult(null);setAnsweredUnknown(false);setHint(false);setUsedHint(false);setFinished(false);
  startTime.current=Date.now();requestId.current=createUUID();window.scrollTo({top:0,behavior:'instant'});
 }catch(e){setError((e as Error).message);}
}
async function answer(choice:boolean|null){const revision=authRevision.current;if(!current||!session||result!==null||lock.current)return;lock.current=true;setBusy(true);setError('');try{const correct=choice!==null&&current.answer===choice;const attempt:Attempt={id:requestId.current,case_id:current.id,mode:session.mode,chapter:current.chapter,choice:choice===null?null:Number(choice),correct:Number(correct),hint:usedHint?1:0,duration:Math.min(86400,Math.floor((Date.now()-startTime.current)/1000)),created:new Date().toISOString()};const nextAttempts=[...attempts,attempt];if(member&&supabase){const {error}=await supabase.from('attempts').insert({...attempt,user_id:member.id,choice:choice,correct,hint:usedHint});if(error)throw new Error('서버에 기록을 저장하지 못했습니다.');}else writeProgress({...readProgress(),attempts:nextAttempts});if(revision!==authRevision.current)return;setAttempts(nextAttempts);setHint(false);setAnsweredUnknown(choice===null);setResult(correct);if(sound){try{const ctx=new AudioContext();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type="triangle";osc.frequency.setValueAtTime(correct?520:180,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(correct?800:90,ctx.currentTime+.14);gain.gain.setValueAtTime(.1,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.2);osc.onended=()=>ctx.close();}catch{}}setSession({...session,right:session.right+(correct?1:0),answered:session.answered+1,unknown:session.unknown+(choice===null?1:0)});}catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}}
async function recordStoryAttempt(item:Case,choice:boolean|null,correct:boolean,duration:number){const revision=authRevision.current;if(lock.current)throw new Error('이전 심사 기록을 저장하고 있습니다.');lock.current=true;setBusy(true);setError('');try{const attempt:Attempt={id:createUUID(),case_id:item.id,mode:'story',chapter:item.chapter,choice:choice===null?null:Number(choice),correct:Number(correct),hint:0,duration:Math.min(86400,Math.max(0,duration)),created:new Date().toISOString()};const nextAttempts=[...attempts,attempt];if(member&&supabase){const {error}=await supabase.from('attempts').insert({...attempt,user_id:member.id,choice,correct,hint:false});if(error)throw new Error('서버에 기록을 저장하지 못했습니다.');}else writeProgress({...readProgress(),attempts:nextAttempts});if(revision!==authRevision.current)return;setAttempts(nextAttempts);}catch(e){setError((e as Error).message);throw e;}finally{setBusy(false);lock.current=false;}}
async function next(){
 
 const revision=authRevision.current;
 if(!session||result===null||busy||lock.current)return;
 if(session.mode==='free'){
  try{
   const draw=nextFreeStudyCase(session.pool,session.seenIds,current?.id);if(!draw)return;
   const {refreshRuleCase}=await import('../lib/rule-bank');if(revision!==authRevision.current)return;const item=refreshRuleCase(draw.item);assertReadyCase(item);
   setSession({...session,queue:[item],index:0,seenIds:draw.seenIds});
  }catch(e){setError((e as Error).message);return;}
 }else{
  if(session.index===session.queue.length-1){setFinished(true);return;}
  setSession({...session,index:session.index+1});
 }
 setResult(null);setAnsweredUnknown(false);setHint(false);setUsedHint(false);
 startTime.current=Date.now();requestId.current=createUUID();window.scrollTo({top:0,left:0,behavior:'instant'});
}
function finishLearning(){if(!session||busy||lock.current)return;setHint(false);setFinished(true);window.scrollTo({top:0,behavior:'instant'});}
function freeQueue(law=filter){return bank.filter(c=>(law==='전체'||storyLaw(c.law)===law)&&(difficulty==='전체'||c.difficulty===difficulty));}
async function importCases(file:File){setBusy(true);try{if(!member?.isAdmin||!supabase)throw Error('관리자 계정으로 로그인해야 문항을 저장할 수 있습니다.');if(file.name.toLowerCase().endsWith('.xlsx')){if(file.size>10000000)throw Error('엑셀 파일은 10MB 이하만 업로드할 수 있습니다.');const {parseRuleBank}=await import('../lib/rule-bank');const ruleBank=await parseRuleBank(file);if(ruleBank.rules.length>1000)throw Error('검수 통과 규칙은 1,000개 이하만 업로드할 수 있습니다.');const {data:existing,error:lookupError}=await supabase.from('shared_cases').select('id,payload').eq('payload->>name',ruleBank.name);if(lookupError)throw Error('기존 문제은행을 확인하지 못했습니다.');const id=existing?.[0]?.id||await ruleBankStorageId(ruleBank);const {error}=await supabase.from('shared_cases').upsert({id,payload:ruleBank,updated_at:new Date().toISOString()});if(error)throw Error('자동출제 규칙 저장에 실패했습니다. 관리자 권한을 확인하세요.');await load();setToast(`${ruleBank.rules.length}개 규칙을 저장했습니다. 자유 심사에서 무작위 승인·반려 사례가 출제됩니다.`);return;}if(file.size>2000000)throw Error('JSON 파일은 2MB 이하만 업로드할 수 있습니다.');const list=JSON.parse(await file.text());if(!Array.isArray(list)||!list.length||list.length>200)throw Error('1~200개 문항의 JSON 배열이 필요합니다.');const custom=list.filter((c:unknown):c is Case=>!!c&&typeof c==='object'&&typeof (c as Case).id==='string'&&(c as Case).id.startsWith('custom-'));if(custom.length!==list.length)throw Error('문항 ID는 custom-으로 시작해야 합니다.');custom.forEach(assertReadyCase);const {error}=await supabase.from('shared_cases').upsert(custom.map(payload=>({id:payload.id,payload,updated_at:new Date().toISOString()})));if(error)throw Error('공용 문항 저장에 실패했습니다. 관리자 권한을 확인하세요.');await load();setToast(`${list.length}개 문항을 모든 사용자에게 저장했습니다.`);}catch(e){setError((e as Error).message);}finally{setBusy(false);if(fileRef.current)fileRef.current.value='';}}
async function clearSharedCases(){if(!member?.isAdmin||!supabase)return;if(!confirm('기존 공용 문항을 모두 삭제할까요? 학습 기록은 남습니다.'))return;setBusy(true);setError('');try{const {error}=await supabase.from('shared_cases').delete().neq('id','');if(error)throw Error('기존 공용 문항을 삭제하지 못했습니다. 관리자 권한을 확인하세요.');const saved=readProgress();writeProgress({attempts:saved.attempts,cases:[],ruleBanks:[]});await load();setToast('기존 공용 문항을 모두 비웠습니다. 새 엑셀 파일을 올리세요.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
async function addReviewCase(item:Case){
 
 const revision=authRevision.current;
 if(busy||lock.current||inReview.has(item.id))return;
 lock.current=true;setBusy(true);setError('');
 try{
  const addedAt=new Date(Math.max(Date.now(),(Date.parse(reviewDismissals[item.id]||'')||0)+1)).toISOString();
  if(member&&supabase){const {error}=await supabase.from('review_additions').upsert({user_id:member.id,case_id:item.id,added_at:addedAt},{onConflict:'user_id,case_id'});if(error)throw Error('오답 재심사함에 추가하지 못했습니다. 다시 시도해 주세요.');}
  else localStorage.setItem(REVIEW_ADDITIONS_KEY,JSON.stringify({...reviewAdditions,[item.id]:addedAt}));
  if(revision!==authRevision.current)return;
  setReviewAdditions(current=>({...current,[item.id]:addedAt}));
  setToast('재심사함에 넣었습니다.');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}
}
async function removeReviewCase(caseId:string,advance=false){
 
 const revision=authRevision.current;
 if(busy||lock.current)return;
 if(advance&&(!session||session.mode!=='review'||result===null||current?.id!==caseId))return;
 lock.current=true;setBusy(true);setError('');
 try{
  const dismissedAt=new Date().toISOString();
  if(member&&supabase){const {error}=await supabase.from('review_dismissals').upsert({user_id:member.id,case_id:caseId,dismissed_at:dismissedAt},{onConflict:'user_id,case_id'});if(error)throw Error('재심사 목록에서 제거하지 못했습니다.');}
  else localStorage.setItem(REVIEW_DISMISSALS_KEY,JSON.stringify({...reviewDismissals,[caseId]:dismissedAt}));
  if(revision!==authRevision.current)return;
  setReviewDismissals(current=>({...current,[caseId]:dismissedAt}));
  setToast('재심사함에서 뺐습니다.');
  if(advance&&session){
   if(session.index+1<session.queue.length){
    setSession({...session,index:session.index+1});
    setResult(null);setAnsweredUnknown(false);setHint(false);setUsedHint(false);
    startTime.current=Date.now();requestId.current=createUUID();
    window.scrollTo({top:0,left:0,behavior:'instant'});
   }else go('review');
  }
 }catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}
}
async function clearReviewCases(){
 
 const revision=authRevision.current;
 if(!ready||busy||lock.current||!wrong.length)return;
 lock.current=true;setBusy(true);setError('');
 try{
  const dismissedAt=new Date().toISOString();
  const dismissed=Object.fromEntries(wrong.map(item=>[item.id,dismissedAt]));
  if(member&&supabase){
   const rows=Object.keys(dismissed).map(caseId=>({user_id:member.id,case_id:caseId,dismissed_at:dismissedAt}));
   const {error}=await supabase.from('review_dismissals').upsert(rows,{onConflict:'user_id,case_id'});
   if(error)throw Error('재심사함을 비우지 못했습니다. 다시 시도해 주세요.');
  }else localStorage.setItem(REVIEW_DISMISSALS_KEY,JSON.stringify({...reviewDismissals,...dismissed}));
  if(revision!==authRevision.current)return;
  setReviewDismissals(current=>({...current,...dismissed}));
  setToast('재심사함을 비웠습니다.');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}
}
async function saveGroup(){if(!member||!supabase)return;const code=groupCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,20);if(code.length<4){setError('친구 그룹 코드는 영문·숫자 4자 이상으로 입력하세요.');return;}setBusy(true);try{const {error}=await supabase.from('profiles').update({group_code:code}).eq('id',member.id);if(error)throw Error('그룹 코드 저장에 실패했습니다.');const {data}=await supabase.rpc('friend_leaderboard');setMember({...member,groupCode:code});setGroupCode(code);setFriendLeaders((data||[]) as {nickname:string;solved:number;correct:number;accuracy:number}[]);setToast('친구 그룹에 연결했습니다.');}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
function exportCSV(){const rows=[['사건ID','모드','법령','정답여부','법령도움','소요초','기록시각'],...attempts.map(a=>[a.case_id,modes[a.mode],caseById.get(a.case_id)?.law||'',a.correct?'정답':'오답',a.hint?'사용':'미사용',a.duration,a.created])];download('보건법규_학습기록.csv','\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv;charset=utf-8');}
async function share(){const text=`보건법규 심사관 · ${streak}일 연속 학습\n오늘 ${todayAttempts.length}건 심사 · 누적 ${attempts.length}건 · 정답률 ${accuracy}%`;try{await navigator.clipboard.writeText(text);setToast('기록을 복사했습니다.');}catch{download('나의_학습기록.txt',text,'text/plain');}}
const reviewItems=wrong.filter(c=>storyLaw(c.law)===filter),reviewLawName=studyLaws.find(x=>x.law===filter)?.short||filter;
const visibleNav=member?.isAdmin?nav:nav.filter(([key])=>key!=='bank'&&key!=='admin-records');
return <LawBookContext.Provider value={lawBook}>{lawDialogOpen&&<LawBookDialog onClose={closeLawDialog}/>}<div className={`app game-app ${session&&!finished?'playing':''} ${tab==='story'?'story-mode':''}`}><div className="office-scenery" aria-hidden="true"/>
<div className="workspace"><header className="game-header"><a className="brand" href="/" aria-label="심사실 홈"><Scale size={25}/><span>보건법규 심사관<small>HEALTH LAW · REVIEW OFFICE</small></span></a><button className="install-button account-button" aria-label={member?member.nickname:'로그인 · 가입'} onClick={accountAction}><UserRound size={16}/><span>{member?member.nickname:'로그인 · 가입'}</span></button><ReadingSettings/><NotificationButton key={member?.id||'guest'} userId={member?.id||null} onShowInstallGuide={()=>window.dispatchEvent(new Event('open-install-guide'))}/><InstallGuide installAvailable={!!installPrompt} onInstall={installApp}/><nav aria-label="게임 메뉴">{visibleNav.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>go(key)} disabled={busy}><Icon size={17}/><span>{label}</span>{key==='review'&&wrong.length>0&&<b>{wrong.length}</b>}</button>)}</nav></header>
{member&&tab==='home'&&ready&&!bank.length&&<section className="notice"><strong>등록된 공용 문제가 없습니다.</strong><p>{member?.isAdmin?'문항 관리에서 검수한 엑셀을 공용 문항 저장으로 등록하면 학습을 시작할 수 있습니다.':'관리자가 문제를 등록하면 학습을 시작할 수 있습니다.'}</p>{member?.isAdmin&&<button className="secondary" onClick={()=>go('bank')}>문항 관리로 이동</button>}</section>}
{member&&tab==='home'&&<NudgeScreen key={member?.id||'guest'} userId={member?.id} compact groupCode={member?.groupCode||""} completedToday={todayAttempts.length>=DAILY_STUDY_TARGET} onGoToday={goToday}/>}
<div className="game-hud"><div><span className="hud-chip">근무일 <b>{days.size+(!days.has(today)?1:0)}일차</b></span><span className="hud-chip"><ShieldCheck size={15}/> {chapters[level].role}</span><span className="hud-chip">{session?.mode==='free'?<>이번 학습 <b>{session.answered}건 완료</b></>:<>사건 <b>{session?String(session.index+1).padStart(2,'0'):String(todayAttempts.length).padStart(2,'0')} / {session?String(session.queue.length).padStart(2,'0'):'05'}</b></>}</span></div><div><span className="hud-chip"><Flame size={16}/> {streak}일</span><span className="hud-chip">Lv. {level+1} · {xp} EXP</span><button className="hud-chip" onClick={()=>setSound(!sound)} aria-pressed={sound}>효과음 {sound?'ON':'OFF'}</button></div></div>
<main>
{toast&&<div className="toast" role="status">{toast}</div>}{error&&<div className="error" role="alert">{error} {!ready&&<button onClick={load}>다시 불러오기</button>}</div>}{!ready&&!error&&<div className="notice">불러오는 중…</div>}
{!ready?null:session?finished?<section className="completion panel"><div className="finish-icon"><CheckCircle2 size={48}/></div><h1>심사 결과</h1><div className="stats-grid"><Stat label="푼 문제 수" value={`${sessionSummary!.solved}문제`} sub={`오늘 ${todayAttempts.length}건`}/><Stat label="정답률" value={`${sessionSummary!.accuracy}%`} sub={`정답 ${sessionSummary!.correct} · 오답 ${sessionSummary!.incorrect}`}/><Stat label="모르겠음" value={`${sessionSummary!.unknown}문제`} sub="재심사함에 들어감"/></div><button className="primary" onClick={()=>go(tab,true)}>돌아가기 <ArrowRight size={18}/></button>{wrong.length>0&&<button className="secondary" onClick={()=>begin(wrong.slice(0,5),'review')}>오답 바로 재심사</button>}</section>:<>
<div className="study-hud" role="group" aria-label="심사 진행"><button type="button" className="hud-back" onClick={()=>go(tab,true)} disabled={busy} aria-label="뒤로"><ArrowLeft size={20}/></button><div className="hud-title"><span>{modes[session.mode]}</span><b>{session.mode==='free'?`${session.answered}건 처리`:`${session.index+1} / ${session.queue.length}`}</b></div><div className="hud-level"><span><ShieldCheck size={14}/> Lv.{level+1}</span><Progress value={level===4?100:xp%100}/></div>{session.mode==='free'&&<button type="button" className="hud-finish" disabled={busy} onClick={finishLearning}>학습 완료</button>}</div>
<CaseDesk key={current!.id} item={current!} meta={[current!.law,current!.difficulty,...(session.mode==='audit'?['감사 재검토']:[])]} result={result} unknownAnswer={answeredUnknown} saving={busy} onAnswer={choice=>void answer(choice)} onNext={()=>void next()} nextLabel={session.mode==='free'?'다음 민원 접수':session.index===session.queue.length-1?'근무 결과 확인':'다음 민원 접수'} inReview={inReview.has(current!.id)} onAddReview={()=>void addReviewCase(current!)} extra={session.mode==='review'?<button type="button" className="secondary" disabled={busy} onClick={()=>void removeReviewCase(current!.id,true)}>재심사 목록에서 제거</button>:undefined}/></>:

<>
{tab==='home'&&<><section id="today-learning" className="home-card"><div className="home-art">{lawEntries.length>0&&<button type="button" className="lawbook-open" onClick={()=>setLawDialogOpen(true)} aria-label="법전 펼치기"><BookSprite size={44}/><span>법전</span></button>}</div><div className="home-today"><div className="home-count"><span className="pixel-label">오늘의 심사</span><strong>{Math.min(DAILY_STUDY_TARGET,todayAttempts.length)}<small> / {DAILY_STUDY_TARGET}건</small></strong>{todayAttempts.length>=DAILY_STUDY_TARGET&&<em>완료</em>}</div><Progress value={todayAttempts.length/DAILY_STUDY_TARGET*100}/><button className="primary start-button" disabled={!ready||!bank.length} onClick={()=>{setTab('free');begin(freeQueue('전체'),'free')}}><Stamp size={22}/> 근무 시작 <ArrowRight size={20}/></button></div></section><div className="home-menu"><button onClick={()=>go('story')}><Waypoints size={22}/><b>스토리</b><small>12장</small></button><button onClick={()=>go('free')}><BookOpen size={22}/><b>자유 심사</b><small>법령 선택</small></button><button onClick={()=>go('review')}><RotateCcw size={22}/><b>재심사함</b><small>{wrong.length}건</small></button></div><div className="office-ledger"><span><Flame size={16}/> {streak}일 연속</span><span>누적 <b>{attempts.length}</b></span><span>정답률 <b>{attempts.length?accuracy+'%':'—'}</b></span><span><b>Lv.{level+1}</b></span></div></>}
{tab==='story'&&ready&&<StoryCampaign key={member?.id||'guest'} userId={member?.id||null} bank={bank} experience={xp} storyAttempts={storyAttempts} onAttempt={recordStoryAttempt} reviewCaseIds={inReview} reviewSaving={busy} onAddReview={addReviewCase} onExit={()=>go('home')}/> }
{tab==='nudge'&&<NudgeScreen key={member?.id||'guest'} userId={member?.id} groupCode={member?.groupCode||''} completedToday={todayAttempts.length>=DAILY_STUDY_TARGET} onGoToday={goToday}/> }
{tab==='free'&&<section className="law-picker"><div className="picker-head"><h1>자유 심사 <small>: 원하는 법만 심사하기</small></h1><select aria-label="난이도" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['전체','기초','응용','심화'].map(d=><option key={d} value={d}>{d==='전체'?'난이도':d}</option>)}</select></div><div className="law-buttons">{studyLaws.map(({law,short})=>{const count=freeQueue(law).length,records=attempts.filter(a=>storyLaw(caseById.get(a.case_id)?.law||'')===law),rate=records.length?Math.round(records.filter(a=>a.correct).length/records.length*100):null;return <button key={law} disabled={!ready||!count} onClick={()=>{setFilter(law);begin(freeQueue(law),'free')}}><b>{short}</b><small>{!count?'문항 없음':rate===null?`${count}건`:`정답률 ${rate}%`}</small></button>})}</div><button className="secondary law-all" disabled={!ready||!freeQueue('전체').length} onClick={()=>{setFilter('전체');begin(freeQueue('전체'),'free')}}>전체 섞어서 심사 <ArrowRight size={16}/></button></section>}
{tab==='review'&&<section className="law-picker review-box">{filter==='전체'?<><div className="picker-head"><h1>오답 재심사함 <small>{wrong.length}건</small></h1>{wrong.length>0&&<button className="text-button" disabled={!ready||busy} onClick={()=>void clearReviewCases()}>비우기</button>}</div><div className="law-buttons">{studyLaws.map(({law,short})=>{const count=wrong.filter(c=>storyLaw(c.law)===law).length;return <button key={law} className={count?'has-items':''} disabled={!count} onClick={()=>{setFilter(law);window.scrollTo({top:0})}}><b>{short}</b><small>{count?`${count}건`:'없음'}</small></button>})}</div>{wrong.length>0?<button className="primary law-all" disabled={!ready||busy} onClick={()=>begin(wrong.slice(0,5),'review')}>{Math.min(5,wrong.length)}건 재심사 <ArrowRight size={16}/></button>:<p className="picker-empty">틀리거나 ‘모르겠음’을 누른 사건이 여기에 모입니다.</p>}</>:<><div className="picker-head"><button className="hud-back" aria-label="법령 목록으로" onClick={()=>setFilter('전체')}><ArrowLeft size={20}/></button><h1>{reviewLawName} <small>{reviewItems.length}건</small></h1></div>{reviewItems.length?<><button className="primary law-all" disabled={!ready||busy} onClick={()=>begin(reviewItems,'review')}>{reviewItems.length}건 모두 재심사 <ArrowRight size={16}/></button><div className="panel case-list">{reviewItems.map(c=>{const misses=attempts.filter(a=>a.case_id===c.id&&!a.correct).length;return <div className="review-case-row" key={c.id}><button disabled={busy} onClick={()=>begin([c],'review')}><div><small>{c.article}{misses?` · 오답 ${misses}회`:' · 직접 추가'}</small><h3>{studentCaseTitle(c)}</h3><p className="review-snippet">{c.body}</p></div><ArrowRight/></button><button className="review-remove" disabled={busy} aria-label={`${studentCaseTitle(c)} 재심사함에서 빼기`} onClick={()=>void removeReviewCase(c.id)}>빼기</button></div>})}</div></>:<p className="picker-empty">이 법령의 재심사 사건이 없습니다.</p>}</>}</section>}
{tab==='admin-records'&&member?.isAdmin&&<AdminLearningRecords key={member.id} bank={bank}/>}
{tab==='stats'&&<><div className="page-heading"><div><div className="eyebrow">LEARNING RECORD</div><h1>학습 기록</h1>{member?.isAdmin&&<button className="secondary" onClick={()=>go('admin-records')}>전체 사용자 학습 기록 보기</button>}</div><button className="secondary" onClick={exportCSV} disabled={!attempts.length}><Download size={17}/> 기록 CSV</button></div><div className="stats-grid"><Stat label="학습 경험치" value={`${xp} EXP`} sub={`Lv. ${level+1} ${chapters[level].role}`}/><Stat label="총 학습 시간" value={`${Math.round(attempts.reduce((s,a)=>s+a.duration,0)/60)}분`} sub="문항별 응답 시간 합계"/><Stat label="전체 정답률" value={attempts.length?`${accuracy}%`:'—'} sub={`${attempts.length}회 중 ${correctCount}회 정답`}/></div><div className="home-grid"><section className="panel"><h2>최근 7일 학습</h2><div className="bar-chart">{Array.from({length:7},(_,i)=>{const dt=new Date(today+'T12:00:00+09:00');dt.setDate(dt.getDate()-6+i);const count=days.get(day(dt))||0;const max=Math.max(5,...Array.from(days.values()));return <div key={i}><strong>{count}</strong><div className="bar-track"><span style={{height:`${Math.max(2,count/max*100)}%`}}/></div><small>{dt.getMonth()+1}/{dt.getDate()}</small></div>})}</div></section><section className="panel"><h2>모드별 학습</h2>{Object.entries(modes).map(([k,v])=>{const a=attempts.filter(a=>a.mode===k);return <div className="mode-stat" key={k}><span>{v}</span><strong>{a.length}건</strong><small>{a.length?Math.round(a.filter(a=>a.correct).length/a.length*100)+'% 정답':'기록 없음'}</small></div>})}<button className="secondary full" onClick={share}><Share2 size={17}/> 친구에게 보낼 기록 복사</button></section></div><section className="panel"><h2>법령별 학습 현황</h2>{laws.map(l=>{const a=attempts.filter(a=>lawCategory(caseById.get(a.case_id)?.law)===l);return <div className="mastery" key={l}><strong>{l}</strong><Progress value={a.length?a.filter(a=>a.correct).length/a.length*100:0}/><span>{a.length?Math.round(a.filter(a=>a.correct).length/a.length*100)+'%':'—'} · {a.length}회</span></div>})}</section><section className="panel"><div className="section-heading"><h2>친구 심사실</h2><span>{member?.groupCode?`그룹 ${member.groupCode}`:'그룹 코드로 친구와 연결하세요'}</span></div>{member?<><div className="button-row"><input className="search" style={{margin:0}} value={groupCode} onChange={e=>setGroupCode(e.target.value)} placeholder="친구와 공유할 그룹 코드 (예: CAPSTONE3)"/><button className="primary" onClick={saveGroup} disabled={busy}>연결</button></div>{friendLeaders.length?<div className="bank-list">{friendLeaders.map((x,i)=><div className="mode-stat" key={x.nickname}><span>{i+1}위 · {x.nickname}</span><strong>{x.correct}점</strong><small>{x.solved}건 · {Math.round(x.accuracy)}%</small></div>)}</div>:<p className="small">아직 같은 그룹의 학습 기록이 없습니다.</p>}</>:<p className="small">로그인하면 친구 그룹을 만들고 학습 기록을 비교할 수 있습니다.</p>}</section></>}
{tab==='bank'&&member?.isAdmin&&<><div className="page-heading"><div><div className="eyebrow">ADMIN CASE LIBRARY</div><h1>문항 관리</h1><p>이 화면은 관리자에게만 보입니다. 저장한 문항은 모든 이용자에게 적용됩니다.</p></div><button className="secondary" onClick={()=>download('보건법규_문제은행.json',JSON.stringify(bank,null,2))}><Download size={17}/> 문항 내보내기</button></div><section className="notice"><strong>문항 검수 안내</strong><p>추가 전 법령 원문, 정답, 해설, 출처 링크를 확인하세요. 같은 문항 ID로 저장하면 기존 공용 문항을 수정합니다.</p></section><section className="panel import-panel"><div><h3>공용 문항·규칙 추가</h3><p>JSON 문항 또는 검수된 엑셀 규칙 파일을 가져오세요. 엑셀은 값목록과 판정기준에서 승인·반려 사례를 만들어 모든 사용자에게 반영합니다.</p></div><div className="button-row"><button className="secondary" onClick={()=>download('문항_추가_양식.json',JSON.stringify([{...initialCases[0],id:'custom-001',origin:'팀 제작 · 검수자와 검수일 기재'}],null,2))}>양식 받기</button><button className="secondary" disabled={!ready||busy} onClick={clearSharedCases}>기존 공용 문제 비우기</button><button className="primary" disabled={!ready||busy} onClick={()=>fileRef.current?.click()}><Upload size={17}/> 공용 문항 저장</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e=>e.target.files?.[0]&&importCases(e.target.files[0])}/></div></section><input className="search" placeholder="사건명, 법령, 조문 검색" aria-label="문항 검색" value={search} onChange={e=>setSearch(e.target.value)}/><div className="bank-list">{bank.filter(c=>(c.title+c.law+c.article).includes(search)).map(c=><details className="panel" key={c.id}><summary><span className="case-code">{c.id}</span><div><small>{c.law} {c.article} · {c.difficulty}</small><strong>{c.title}</strong></div><ChevronRight size={18}/></summary><div className="bank-detail"><p>{c.body}</p><ul>{c.details.map((v,i)=><li key={i}>{v}</li>)}</ul><strong>정답: {c.answer?'승인':'반려'}</strong><p>{c.explanation}</p><a href={c.source} target="_blank" rel="noreferrer">국가법령정보센터 원문 ↗</a><p className="small">{c.origin}</p></div></details>)}</div></>}
</>}
<footer><span>보건법규 심사관 · 캡스톤 3조</span><span>{member?member.nickname:'게스트 · 이 기기에 저장'}</span></footer></main><nav className="mobile-tabbar" aria-label="앱 하단 메뉴">{visibleNav.slice(0,5).map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>go(key)} disabled={busy}><Icon size={21}/><span>{label.replace('오늘의 ','').replace(' 모드','')}</span>{key==='review'&&wrong.length>0&&<b>{wrong.length}</b>}</button>)}</nav></div></div></LawBookContext.Provider>;
}

