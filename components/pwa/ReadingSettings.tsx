'use client';
import {useEffect,useState} from 'react';
const KEY='health-law-reading-scale-v1';
const choices=[100,120,140,160] as const;
export default function ReadingSettings(){
 const [scale,setScale]=useState<number>(100);
 useEffect(()=>{
  let saved=100;
  try{const value=Number(localStorage.getItem(KEY));if(choices.some(n=>n===value))saved=value;}catch{}
  document.documentElement.style.setProperty('--reading-scale',String(saved/100));
  const timer=window.setTimeout(()=>setScale(saved),0);
  return()=>window.clearTimeout(timer);
 },[]);
 function choose(value:number){
  setScale(value);
  document.documentElement.style.setProperty('--reading-scale',String(value/100));
  try{localStorage.setItem(KEY,String(value));}catch{}
 }
 return <details className="reading-settings">
  <summary aria-label="글자 크기 조절">가<span>글자 크기</span></summary>
  <div className="reading-settings-panel">
   <strong>글자 크기</strong>
   <p>문제·해설·법전 본문을 편하게 읽으세요.</p>
   <div className="reading-size-options">{choices.map(value=><button key={value} type="button" aria-pressed={scale===value} onClick={()=>choose(value)}>{value}%</button>)}</div>
   <p className="reading-size-preview" style={{fontSize:18*scale/100}}>사례를 읽고 승인 또는 반려를 선택하세요.</p>
   <small>선택한 크기는 이 기기에 저장됩니다.</small>
  </div>
 </details>;
}
