'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import type {Case} from '../../lib/cases';
import {filterStudyRecords,summarizeStudyRecords,studyCSV,studyModes,type StudyProfile,type StudyRecord} from '../../lib/admin-records';

const timestamp=(value:string)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'학습 기록 없음';
const pageSize=30;
export default function AdminLearningRecords({bank}:{bank:Case[]}) {
  const [profiles,setProfiles]=useState<StudyProfile[]>([]),[records,setRecords]=useState<StudyRecord[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [search,setSearch]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[selected,setSelected]=useState(''),[page,setPage]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setError('');setProfiles([]);setRecords([]);
      try{
        if(!supabase)throw new Error('회원 서버에 연결할 수 없습니다.');
        const {data:{user},error:authError}=await supabase.auth.getUser();
        if(authError||!user)throw new Error('관리자 계정으로 로그인하세요.');
        const {data:profile,error:profileError}=await supabase.from('profiles').select('is_admin').eq('id',user.id).single();
        if(profileError||!profile?.is_admin)throw new Error('관리자만 전체 학습 기록을 볼 수 있습니다.');
        const users:StudyProfile[]=[],attempts:StudyRecord[]=[];
        for(let offset=0;;offset+=1000){
          const {data,error}=await supabase.from('profiles').select('id,nickname,group_code').order('id').range(offset,offset+999);
          if(error)throw new Error('사용자 목록을 불러오지 못했습니다.');
          if(cancelled)return;users.push(...(data||[]));if((data||[]).length<1000)break;
        }
        for(let offset=0;;offset+=1000){
          const {data,error}=await supabase.from('attempts').select('id,user_id,case_id,mode,correct,choice,hint,duration,created').order('created',{ascending:false}).order('id').range(offset,offset+999);
          if(error)throw new Error('전체 학습 기록을 불러오지 못했습니다.');
          if(cancelled)return;attempts.push(...(data||[]));if((data||[]).length<1000)break;
        }
        if(!cancelled){setProfiles(users);setRecords(attempts);}
      }catch(error){if(!cancelled)setError((error as Error).message);}finally{if(!cancelled)setLoading(false);}
    }
    void load();return()=>{cancelled=true;};
  },[reload]);
  useEffect(()=>setPage(0),[selected,from,to,search,reload]);
  const invalidRange=!!from&&!!to&&from>to;
  const filtered=invalidRange?[]:filterStudyRecords(records,from,to);
  const summaries=summarizeStudyRecords(profiles,filtered).filter(profile=>(profile.nickname+' '+(profile.group_code||'')).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const visibleUsers=new Set(summaries.map(profile=>profile.id));
  const shown=filtered.filter(record=>visibleUsers.has(record.user_id)&&(!selected||record.user_id===selected));
  const names=new Map(profiles.map(profile=>[profile.id,profile.nickname]));
  const cases=new Map(bank.map(item=>[item.id,item]));
  const totalCorrect=shown.filter(record=>record.correct).length;
  const pages=Math.max(1,Math.ceil(shown.length/pageSize)),currentPage=Math.min(page,pages-1);
  function exportRecords(){
    const rows:unknown[][]=[['닉네임','그룹','사용자ID','사건ID','사건명','법령','조문','모드','선택','정답여부','도움말','소요초','학습시각(한국시간)']];
    for(const record of shown){const item=cases.get(record.case_id);rows.push([names.get(record.user_id)||'프로필 없는 사용자',profiles.find(profile=>profile.id===record.user_id)?.group_code||'',record.user_id,record.case_id,item?.title||'현재 문제은행에 없는 문항',item?.law||'',item?.article||'',studyModes[record.mode]||record.mode,record.choice?'승인':'반려',record.correct?'정답':'오답',record.hint?'사용':'미사용',record.duration,timestamp(record.created)]);}
    const url=URL.createObjectURL(new Blob([studyCSV(rows)],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='보건법규_전체학습기록.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMIN LEARNING RECORDS</div><h1>전체 사용자 학습 기록</h1><p>로그인한 사용자가 서버에 저장한 기록입니다. 게스트의 기기 기록은 포함되지 않습니다.</p></div><div className="button-row"><button className="secondary" disabled={loading} onClick={()=>setReload(value=>value+1)}>새로고침</button><button className="secondary" disabled={loading||!!error||!shown.length} onClick={exportRecords}>기록 CSV 다운로드</button></div></div>
    {error&&<section className="notice" role="alert">{error}</section>}
    <section className="panel"><div className="button-row"><label>닉네임·그룹 검색<input className="search" aria-label="닉네임·그룹 검색" value={search} onChange={event=>setSearch(event.target.value)} placeholder="전체 사용자"/></label><label>시작일<input className="search" type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>종료일<input className="search" type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><button className="secondary" onClick={()=>{setSearch('');setFrom('');setTo('');setSelected('');}}>필터 초기화</button></div>{invalidRange&&<p role="alert">종료일은 시작일 이후로 선택하세요.</p>}</section>
    {loading?<section className="panel" role="status">학습 기록을 불러오고 있습니다.</section>:!error&&<>
      <section className="panel"><h2>조회 현황</h2><p>{summaries.length}명 · {shown.length}회 풀이 · 정답률 {shown.length?Math.round(totalCorrect/shown.length*100)+'%':'—'} · 학습 시간 {Math.round(shown.reduce((sum,row)=>sum+row.duration,0)/60)}분</p></section>
      <section className="panel"><h2>사용자별 학습</h2><p className="small">사용자를 선택하면 아래에서 개별 풀이를 확인할 수 있습니다. 수치는 선택한 기간 기준입니다.</p><button className="secondary" aria-pressed={!selected} onClick={()=>setSelected('')}>모든 사용자 기록</button><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}><thead><tr>{['사용자','그룹','풀이 수','정답률','학습 시간','최근 학습'].map(label=><th style={{padding:12}} key={label}>{label}</th>)}</tr></thead><tbody>{summaries.map(profile=><tr key={profile.id}><td style={{padding:12}}><button className="secondary" aria-pressed={selected===profile.id} onClick={()=>setSelected(profile.id)}>{profile.nickname}</button></td><td>{profile.group_code||'—'}</td><td>{profile.solved}회</td><td>{profile.accuracy===null?'—':profile.accuracy+'%'}</td><td>{Math.round(profile.seconds/60)}분</td><td>{timestamp(profile.last)}</td></tr>)}</tbody></table></div>{!summaries.length&&<p>검색에 해당하는 사용자가 없습니다.</p>}</section>
      <section className="panel"><h2>{selected?(names.get(selected)||'선택 사용자')+'의 풀이 기록':'전체 풀이 기록'}</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}><thead><tr>{['학습 시각','사용자','문항','모드','선택','결과','시간'].map(label=><th style={{padding:12}} key={label}>{label}</th>)}</tr></thead><tbody>{shown.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(record=>{const item=cases.get(record.case_id);return <tr key={record.id}><td style={{padding:12,whiteSpace:'nowrap'}}>{timestamp(record.created)}</td><td>{names.get(record.user_id)||'프로필 없는 사용자'}</td><td>{item?.title||'현재 문제은행에 없는 문항'}<small style={{display:'block'}}>{item?item.law+' '+item.article:record.case_id}</small></td><td>{studyModes[record.mode]||record.mode}</td><td>{record.choice?'승인':'반려'}</td><td>{record.correct?'정답':'오답'}{record.hint?' · 도움말 사용':''}</td><td>{record.duration}초</td></tr>;})}</tbody></table></div>{!shown.length&&<p>이 조건에 해당하는 학습 기록이 없습니다.</p>}<div className="button-row"><button className="secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage+1} / {pages}</span><button className="secondary" disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)}>다음</button></div></section>
    </>}
  </>;
}
