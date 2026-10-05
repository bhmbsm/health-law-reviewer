'use client';
import type {Case} from '../../lib/cases';
import {lawSearchUrl} from '../../lib/story';
export default function StoryCaseDocument({selected,index,total,result,saving,onAnswer,onNext,nextLabel}:{selected:Case;index:number;total:number;result:boolean|null;saving:boolean;onAnswer:(choice:boolean)=>void;onNext:()=>void;nextLabel:string}){
 const decision=result===null?null:result?selected.answer:!selected.answer;
 return <div className={`panel story-case-document ${result!==null?'case-filed':''} ${result===true?'case-correct':result===false?'case-incorrect':''}`}>
  <small>{selected.law} · {selected.article} · {index+1}/{total}</small>
  <h2>{selected.title}</h2><p>{selected.body}</p>
  <ul>{selected.details.map((detail,i)=><li key={i}>{detail}</li>)}</ul>
  {result===null?<div className="decision-buttons"><button className="approve" disabled={saving} onClick={()=>onAnswer(true)}>승인</button><button className="reject" disabled={saving} onClick={()=>onAnswer(false)}>반려</button></div>:<>
   <div className={`ink-stamp story-ink-stamp ${decision?'ink-green':'ink-red'}`} role="img" aria-label={result?'정답':'오답'}>{decision?'승인':'반려'}</div>
   <div className="story-feedback" role="status"><strong>{result?`정답입니다 · ${selected.answer?'승인':'반려'}`:`오답입니다 · 정답은 ${selected.answer?'승인':'반려'}`}</strong><p>{selected.explanation}</p><a href={selected.source||lawSearchUrl(selected.law)} target="_blank" rel="noreferrer">법전에서 {selected.law} {selected.article} 확인 ↗</a></div>
   <button className="primary" onClick={onNext} disabled={saving}>{nextLabel}</button>
  </>}
  {saving&&<p role="status">심사 기록 저장 중…</p>}
 </div>;
}
