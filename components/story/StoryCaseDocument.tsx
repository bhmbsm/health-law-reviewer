'use client';
import {caseNarrative} from '../../lib/case-narrative';
import type {Case} from '../../lib/cases';
import {studentCaseTitle} from '../../lib/question-bank';
import {lawSearchUrl} from '../../lib/story';
export default function StoryCaseDocument({selected,index,total,result,unknownAnswer=false,saving,onAnswer,onNext,nextLabel}:{selected:Case;index:number;total:number;result:boolean|null;unknownAnswer?:boolean;saving:boolean;onAnswer:(choice:boolean|null)=>void;onNext:()=>void;nextLabel:string}){
 const decision=result===null?null:result?selected.answer:!selected.answer;
 return <div className={`panel story-case-document ${result!==null?'case-filed':''} ${result===true?'case-correct':result===false?'case-incorrect':''}`}>
  <small>{selected.law} · {selected.article} · {index+1}/{total}</small>
  <h2>{studentCaseTitle(selected)}</h2><p>{caseNarrative(selected)}</p>
  {result===null?<div className="decision-buttons"><button className="approve" disabled={saving} onClick={()=>onAnswer(true)}>승인</button><button className="reject" disabled={saving} onClick={()=>onAnswer(false)}>반려</button><button className="unknown" disabled={saving} onClick={()=>onAnswer(null)}>모르겠음</button></div>:<>
   {!unknownAnswer&&<div className={`ink-stamp story-ink-stamp ${decision?'ink-green':'ink-red'}`} role="img" aria-label={result?'정답':'오답'}>{decision?'승인':'반려'}</div>}
   <div className="story-feedback" role="status"><strong>{unknownAnswer?`복습에 추가했습니다 · 정답은 ${selected.answer?'승인':'반려'}`:result?`정답입니다 · ${selected.answer?'승인':'반려'}`:`오답입니다 · 정답은 ${selected.answer?'승인':'반려'}`}</strong><p>{selected.explanation}</p><a href={selected.source||lawSearchUrl(selected.law)} target="_blank" rel="noreferrer">법전에서 {selected.law} {selected.article} 확인 ↗</a></div>
   <button className="primary" onClick={onNext} disabled={saving}>{nextLabel}</button>
  </>}
  {saving&&<p role="status">심사 기록 저장 중…</p>}
 </div>;
}
