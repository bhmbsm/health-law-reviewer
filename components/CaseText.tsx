import { caseTextBlocks } from '../lib/case-narrative';

/** Render paragraphs and numbered conditions without changing the tested facts. */
export default function CaseText({text,className=''}:{text:string;className?:string}){
 return <div className={`case-copy ${className}`.trim()}>{caseTextBlocks(text).map((block,index)=>block.kind==='list'
  ? <ol key={index} start={block.items[0].number}>{block.items.map((item,i)=><li key={i} value={item.number}>{item.text}</li>)}</ol>
  : <p key={index}>{block.text}</p>)}</div>;
}
