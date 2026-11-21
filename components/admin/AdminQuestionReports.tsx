'use client';
import {useCallback,useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import type {QuestionReport} from '../../lib/question-reports';
import {readReportCase} from '../../lib/question-reports';
import CaseText from '../CaseText';

const PAGE_SIZE=30;
export default function AdminQuestionReports(){
 const [reports,setReports]=useState<QuestionReport[]>([]),[names,setNames]=useState<Record<string,string>>({}),[filter,setFilter]=useState('open'),[page,setPage]=useState(0);
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState<string|null>(null),[error,setError]=useState(''),[more,setMore]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase)return;setBusy(true);setError('');
  try{
   const {data:admin,error:permissionError}=await supabase.rpc('is_admin');
   if(permissionError||admin!==true)throw Error('관리자만 신고함을 볼 수 있습니다.');
   let query=supabase.from('question_reports').select('*').order('created_at',{ascending:false}).order('id').range(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
   if(filter!=='all')query=query.eq('status',filter);
   const {data,error}=await query;if(error)throw Error('신고함을 불러오지 못했습니다. 다시 시도해 주세요.');
   const rows=((data||[]) as QuestionReport[]).map(row=>({...row,case_snapshot:readReportCase(row.case_snapshot)}));setMore(rows.length>PAGE_SIZE);setReports(rows.slice(0,PAGE_SIZE));
   const ids=Array.from(new Set(rows.map(row=>row.reporter_id)));
   if(ids.length){const {data:profiles}=await supabase.from('profiles').select('id,nickname').in('id',ids);setNames(Object.fromEntries((profiles||[]).map(p=>[p.id,p.nickname])));}else setNames({});
  }catch(error){setReports([]);setError((error as Error).message);}finally{setBusy(false);}
 },[filter,page]);
 useEffect(()=>{void load();},[load]);
 async function updateStatus(report:QuestionReport){
  if(!supabase||saving)return;setSaving(report.id);setError('');
  const status=report.status==='open'?'resolved':'open';
  try{const {data,error}=await supabase.from('question_reports').update({status}).eq('id',report.id).select('id');if(error||!data?.length)throw Error('처리 상태를 저장하지 못했습니다.');await load();}
  catch(error){setError((error as Error).message);}finally{setSaving(null);}
 }
 return <section className="panel report-inbox"><div className="section-heading"><div><h1>문제 신고함</h1><p>관리자 전용 · 신고 당시의 문제와 메시지입니다.</p></div><button className="secondary" disabled={busy||!!saving} onClick={()=>void load()}>새로고침</button></div>
  <label>처리 상태 <select value={filter} disabled={busy||!!saving} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="open">미처리</option><option value="resolved">처리 완료</option><option value="all">전체</option></select></label>
  {error&&<p role="alert" className="dialog-error">{error}</p>}{busy?<p role="status">신고를 불러오는 중…</p>:<>
   {!reports.length&&!error&&<p>접수된 신고가 없습니다.</p>}
   {reports.map(report=><article key={report.id} className="report-card"><div className="section-heading"><strong>{report.status==='open'?'미처리':'처리 완료'} · {report.case_snapshot.law} {report.case_snapshot.article}</strong><button className="secondary" disabled={!!saving} onClick={()=>void updateStatus(report)}>{saving===report.id?'저장 중…':report.status==='open'?'처리 완료로 표시':'미처리로 되돌리기'}</button></div>
    <p className="report-meta">{names[report.reporter_id]||'회원'} · {new Date(report.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>
    <h3>신고 내용</h3><p className="report-message">{report.message}</p>
    <details><summary>신고 당시 문제·정답·해설 보기</summary><h3>{report.case_snapshot.title}</h3><CaseText text={report.case_snapshot.body}/><p><strong>정답: {report.case_snapshot.answer?'승인':'반려'}</strong></p><CaseText text={report.case_snapshot.explanation}/><details><summary>근거 조문</summary><p className="report-message">{report.case_snapshot.rule}</p></details><small>문항 ID: {report.case_id}</small></details>
   </article>)}
   <div className="button-row"><button className="secondary" disabled={page===0||!!saving} onClick={()=>setPage(page-1)}>이전</button><span>{page+1}페이지</span><button className="secondary" disabled={!more||!!saving} onClick={()=>setPage(page+1)}>다음</button></div>
  </>}
 </section>;
}
