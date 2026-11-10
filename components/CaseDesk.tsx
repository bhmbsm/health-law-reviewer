'use client';
import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Check,X,HelpCircle,ArrowRight,BookOpen,ChevronDown,ChevronUp,ExternalLink,FileText} from 'lucide-react';
import LawBook,{useLawBook,BookSprite,formatLawText} from './LawBook';
import {storyLaw} from '../lib/story-curriculum';
import CaseText from './CaseText';
import ReviewAddButton from './ReviewAddButton';
import {caseNarrative} from '../lib/case-narrative';
import {studentCaseTitle} from '../lib/question-bank';
import type {Case} from '../lib/cases';

/** Delay before "next" accepts input so a double tap on a stamp cannot skip the explanation. */
export const NEXT_GUARD_MS=350;

type Props={
 item:Case;
 /** Small labels above the case title (law, difficulty, progress). Never the answer. */
 meta:string[];
 result:boolean|null;
 unknownAnswer?:boolean;
 saving:boolean;
 onAnswer:(choice:boolean|null)=>void;
 onNext:()=>void;
 nextLabel:string;
 inReview?:boolean;
 onAddReview?:()=>void;
 /** Extra actions shown inside the result sheet, e.g. removing a review item. */
 extra?:ReactNode;
 sender?:string;
 lawUrl?:string;
 className?:string;
};

const noopSubscribe=()=>()=>{};
const typing=(target:EventTarget|null)=>target instanceof HTMLElement&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * One-hand review desk. Before an answer only the complaint is visible and the stamps
 * sit in the thumb zone; afterwards the explanation and law text rise in a bottom sheet
 * whose "next" button occupies the exact spot the stamps were in.
 */
export default function CaseDesk({item,meta,result,unknownAnswer=false,saving,onAnswer,onNext,nextLabel,inReview=false,onAddReview,extra,sender,lawUrl,className=''}:Props){
 const answered=result!==null;
 const decision=answered?(result?item.answer:!item.answer):null;
 const [collapsed,setCollapsed]=useState(false);
 const [armed,setArmed]=useState(false);
 const nextRef=useRef<HTMLButtonElement>(null);
 // Fixed controls live under <body> so no animated ancestor can trap them. Server markup keeps them inline.
 const host=useSyncExternalStore(noopSubscribe,()=>document.body,()=>null);
 const dock=(node:ReactNode)=>host?createPortal(node,host):node;
 useEffect(()=>{
  // Callers key this component by case id, so collapsed/armed start fresh for every case.
  if(!answered)return;
  const timer=window.setTimeout(()=>{setArmed(true);nextRef.current?.focus({preventScroll:true});},NEXT_GUARD_MS);
  return()=>window.clearTimeout(timer);
 },[answered,item.id]);
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||typing(event.target))return;
   if(!answered){
    if(saving)return;
    if(event.key==='ArrowRight'){event.preventDefault();onAnswer(true);}
    else if(event.key==='ArrowLeft'){event.preventDefault();onAnswer(false);}
    else if(event.key==='?'||event.key==='/'){event.preventDefault();onAnswer(null);}
    return;
   }
   if(event.key==='Escape'){event.preventDefault();setCollapsed(value=>!value);}
   else if(event.key==='ArrowRight'&&armed&&!saving){event.preventDefault();onNext();}
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[answered,armed,saving,onAnswer,onNext]);
 const verdict=answered?(unknownAnswer?'재심사함에 넣었습니다':result?'정답입니다':'오답입니다'):'';
 const tone=!answered?'':unknownAnswer?'unknown':result?'correct':'wrong';
 const source=lawUrl||item.source;
 const book=useLawBook();
 const category=storyLaw(item.law);
 return <div className={`case-desk ${answered?'is-answered':''} ${collapsed?'sheet-collapsed':''} ${className}`.trim()}>
  <article className={`case-paper ${answered?'case-filed':''} ${tone==='correct'?'case-correct':tone==='wrong'?'case-incorrect':''}`} aria-label="민원 접수 서류">
   <div className="case-paper-head"><span className="pixel-label">민원 접수</span>{meta.length>0&&<div className="chips">{meta.map((label,index)=><span key={index}>{label}</span>)}</div>}</div>
   <h2>{studentCaseTitle(item)}</h2>
   <CaseText className="case-body" text={caseNarrative(item)}/>
   {answered&&!unknownAnswer&&<div className={`ink-stamp ${decision?'ink-green':'ink-red'}`} role="img" aria-label={result?'정답':'오답'}>{decision?'승인':'반려'}</div>}
   <div className="document-foot">제출자: {sender||item.sender||'보건법규 심사 접수실'} · 학습용 가상 사건</div>
  </article>
  {book.entries.length>0&&<aside className={`law-panel ${book.open?'is-open':''}`} aria-label="법전">{book.open?<LawBook key={category} initialCategory={category} focus={answered?{law:item.law,article:item.article}:undefined} onClose={()=>book.setOpen(false)}/>:<button type="button" className="law-cover" onClick={()=>book.setOpen(true)}><BookSprite size={64}/><b>법전 펼치기</b><small>{item.law}</small></button>}</aside>}
  {dock(!answered?<div className="thumb-dock" role="group" aria-label="판단">
   <div className="decision-buttons">
    <button type="button" className="reject" disabled={saving} onClick={()=>onAnswer(false)}><X size={24} aria-hidden="true"/><span>반려<small>보완 필요</small></span></button>
    <button type="button" className="approve" disabled={saving} onClick={()=>onAnswer(true)}><Check size={24} aria-hidden="true"/><span>승인<small>요건 충족</small></span></button>
    <button type="button" className="unknown" disabled={saving} onClick={()=>onAnswer(null)}><HelpCircle size={16} aria-hidden="true"/>모르겠음</button>
   </div>
   {saving&&<p className="dock-hint" aria-live="polite">저장 중…</p>}
  </div>:<section className={`result-sheet story-feedback tone-${tone} ${collapsed?'is-collapsed':''}`} aria-label="심사 결과와 해설">
   <button type="button" className="sheet-handle" onClick={()=>setCollapsed(value=>!value)} aria-expanded={!collapsed} aria-label={collapsed?'해설 펼치기':'해설 접고 서류 보기'}><span/>{collapsed?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
   <div className="sheet-verdict" role="status"><strong>{verdict}</strong><span>정답은 <b className={item.answer?'answer-approve':'answer-reject'}>{item.answer?'승인':'반려'}</b></span></div>
   <div className="sheet-slide" aria-hidden={collapsed}><div className="sheet-body" inert={collapsed}>
    <section className="sheet-section"><h3><span className="pixel-label">해설</span></h3><CaseText text={item.explanation}/></section>
    <section className="sheet-section sheet-law"><h3><span className="pixel-label"><BookOpen size={14} aria-hidden="true"/> 법전</span><small>{item.law} {item.article}</small></h3>
     {item.rule?<p className="rule-text">{formatLawText(item.rule)}</p>:null}
     {source&&<a href={source} target="_blank" rel="noreferrer">국가법령정보센터에서 원문 확인 <ExternalLink size={13} aria-hidden="true"/></a>}
    </section>
    {(result===true&&onAddReview)||extra?<div className="sheet-actions">{result===true&&onAddReview&&<ReviewAddButton added={inReview} busy={saving} onAdd={onAddReview}/>}{extra}</div>:null}
   </div></div>
   <div className="sheet-footer"><button ref={nextRef} type="button" className="primary next-button" disabled={saving||!armed} onClick={onNext}>{nextLabel}<ArrowRight size={20} aria-hidden="true"/></button><button type="button" className="sheet-toggle" onClick={()=>setCollapsed(value=>!value)} aria-expanded={!collapsed}>{collapsed?<><BookOpen size={16} aria-hidden="true"/>해설 보기<ChevronUp size={16} aria-hidden="true"/></>:<><FileText size={16} aria-hidden="true"/>문제 보기<ChevronDown size={16} aria-hidden="true"/></>}</button></div>
  </section>)}
 </div>;
}
