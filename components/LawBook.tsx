'use client';
import {createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Search,ExternalLink} from 'lucide-react';
import type {Case} from '../lib/cases';
import {studyLaws,storyLaw} from '../lib/story-curriculum';

export type LawEntry={category:string;law:string;article:string;title:string;text:string;source:string};
type LawBookState={entries:LawEntry[];open:boolean;setOpen:(open:boolean)=>void};
export const LawBookContext=createContext<LawBookState>({entries:[],open:false,setOpen:()=>{}});
export const useLawBook=()=>useContext(LawBookContext);

const lawRank=(law:string)=>/시행규칙/.test(law)?2:/시행령/.test(law)?1:0;
const articleRank=(article:string)=>{const m=article.match(/제(\d+)조(?:의(\d+))?/);return m?Number(m[1])*1000+Number(m[2]||0):1e9;};

const baseArticle=(article:string)=>article.match(/제\d+조(?:의\d+)?/)?.[0]||article;

/** One entry per law + article (제N조), merging the verified law text the question bank carries for its clauses. */
export function buildLawEntries(bank:Case[]):LawEntry[]{
 const groups=new Map<string,{law:string;article:string;texts:Set<string>;source:string}>();
 for(const item of bank){
  if(!item.rule||item.rule===item.article)continue;
  const article=baseArticle(item.article),key=item.law+'|'+article;
  const group=groups.get(key)||{law:item.law,article,texts:new Set<string>(),source:item.source};
  group.texts.add(item.rule.trim());groups.set(key,group);
 }
 return Array.from(groups.values()).map(group=>{
  const texts=Array.from(group.texts);
  const kept=texts.filter(text=>!texts.some(other=>other!==text&&other.includes(text)));
  const text=kept.join('\n\n');
  const title=text.match(new RegExp(group.article+'\\(([^)]+)\\)'))?.[1]||'';
  return {category:storyLaw(group.law),law:group.law,article:group.article,title,text,source:group.source};
 }).sort((a,b)=>lawRank(a.law)-lawRank(b.law)||a.law.localeCompare(b.law,'ko')||articleRank(a.article)-articleRank(b.article));
}

export const lawEntryKey=(law:string,article:string)=>law+'|'+baseArticle(article);

/** Start each paragraph (①), item (1.) and sub-item (가.) on its own line. Dates such as "2019. 12. 3." are left alone. */
export function formatLawText(text:string):string{
 return text
  .replace(/[ \t]+(?=[①-⑳])/g,'\n')
  .replace(/[ \t]+(?=\d{1,2}\.[ \t](?![\d\s]))/g,'\n')
  .replace(/[ \t]+(?=[가-하]\.[ \t])/g,'\n');
}

type Props={initialCategory?:string;focus?:{law:string;article:string};onClose?:()=>void};

export default function LawBook({initialCategory,focus,onClose}:Props){
 const {entries}=useLawBook();
 const categories=useMemo(()=>studyLaws.filter(x=>entries.some(e=>e.category===x.law)),[entries]);
 const [category,setCategory]=useState(initialCategory&&categories.some(x=>x.law===initialCategory)?initialCategory:categories[0]?.law||'');
 const [query,setQuery]=useState('');
 const listRef=useRef<HTMLDivElement>(null);
 const q=query.trim();
 const shown=useMemo(()=>entries.filter(e=>e.category===category&&(!q||e.article.includes(q)||e.title.includes(q)||e.text.includes(q))),[entries,category,q]);
 const focusKey=focus?lawEntryKey(focus.law,focus.article):'';
 useEffect(()=>{
  if(!focusKey)return;
  // Scroll the list only, never the page behind it.
  const list=listRef.current,target=list?.querySelector<HTMLElement>('[data-focus="true"]');
  if(list&&target)list.scrollTop=Math.max(0,target.offsetTop-8);
 },[focusKey,category]);
 return <div className="lawbook">
  <div className="lawbook-head">
   <span className="pixel-label">법전</span>
   <select aria-label="법령 선택" value={category} onChange={e=>{setCategory(e.target.value);listRef.current?.scrollTo({top:0});}}>{categories.map(x=><option key={x.law} value={x.law}>{x.short}</option>)}</select>
   {onClose&&<button type="button" className="lawbook-close" onClick={onClose} aria-label="법전 닫기"><X size={20}/></button>}
  </div>
  <label className="lawbook-search"><Search size={15} aria-hidden="true"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="조문·단어 검색" aria-label="법전 검색"/></label>
  <div className="lawbook-list" ref={listRef}>
   {shown.length?shown.map((e,index)=>{const isFocus=e.law+'|'+e.article===focusKey;const lawChanged=index===0||shown[index-1].law!==e.law;return <div key={e.law+e.article}>
    {lawChanged&&<h4 className="lawbook-law">{e.law}</h4>}
    <details className={isFocus?'is-focus':''} open={isFocus||undefined} data-focus={isFocus||undefined}>
     <summary><b>{e.article}</b>{e.title&&<span>{e.title}</span>}</summary>
     <p className="lawbook-text">{formatLawText(e.text)}</p>
     {e.source&&<a href={e.source} target="_blank" rel="noreferrer">원문 <ExternalLink size={12} aria-hidden="true"/></a>}
    </details>
   </div>;}):<p className="lawbook-empty">{q?'검색 결과가 없습니다.':'등록된 조문이 없습니다.'}</p>}
  </div>
 </div>;
}

/** Full-screen law book for phones, opened from the home office scene. */
export function LawBookDialog({onClose}:{onClose:()=>void}){
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  window.addEventListener('keydown',onKey);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{window.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;};
 },[onClose]);
 return createPortal(<div className="lawbook-dialog" role="dialog" aria-modal="true" aria-label="법전"><LawBook onClose={onClose}/></div>,document.body);
}

/** 16×16 pixel book used on the home scene button and the closed panel. */
export function BookSprite({size=40}:{size?:number}){
 return <svg className="book-sprite" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
  <rect x="2" y="2" width="12" height="12" fill="#120d08"/>
  <rect x="3" y="3" width="10" height="10" fill="#7a2f22"/>
  <rect x="3" y="3" width="2" height="10" fill="#5a2017"/>
  <rect x="6" y="5" width="6" height="1" fill="#f2b45a"/>
  <rect x="7" y="7" width="4" height="2" fill="#f2b45a"/>
  <rect x="6" y="10" width="6" height="1" fill="#f2b45a"/>
  <rect x="13" y="4" width="1" height="9" fill="#efe2bf"/>
  <rect x="3" y="13" width="11" height="1" fill="#efe2bf"/>
 </svg>;
}
