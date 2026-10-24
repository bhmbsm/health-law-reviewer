import type {Case} from './cases';

export type CaseTextBlock={kind:'paragraph';text:string}|{kind:'list';items:{number:number;text:string}[]};

export function normalizeCaseText(text:string):string{
 return text.replace(/\r\n?/g,'\n')
  // An inline list after a complete Korean sentence is a new block. A date or
  // decimal has a numeric predecessor and must never be split by this rule.
  .replace(/([가-힣][.!?。]|[:：])[ \t]+([1-9]\d?)\.[ \t]+(?!\d{1,2}\.[ \t])(?=\S)/g,'$1\n\n$2. ')
  .replace(/\n{3,}/g,'\n\n').trim();
}

export function caseTextBlocks(text:string):CaseTextBlock[]{
 const blocks:CaseTextBlock[]=[];
 let paragraph:string[]=[];
 const flush=()=>{if(paragraph.length){blocks.push({kind:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
 for(const line of normalizeCaseText(text).split('\n')){
  const marker=line.match(/^\s*([1-9]\d?)\.[ \t]+(?!\d{1,2}\.[ \t])(.+)$/);
  if(marker){
   flush();const number=Number(marker[1]),last=blocks.at(-1);
   if(last?.kind==='list'&&number===last.items.at(-1)!.number+1)last.items.push({number,text:marker[2]});
   else blocks.push({kind:'list',items:[{number,text:marker[2]}]});
  }else if(!line.trim())flush();
  else paragraph.push(line);
 }
 flush();return blocks;
}

/** Keep the tested facts in source order and ask the question after those facts. */
export function caseNarrative(item:Pick<Case,'body'|'details'>):string {
 const body=item.body.trim();
 const details=item.details.map(value=>value.trim()).filter(Boolean);
 if(!details.length)return normalizeCaseText(body);
 const sentences=body.split(/(?<=[.!?。])\s+/u);
 const tail=sentences.at(-1)||'';
 const hasQuestion=/[?？]$|(?:판단|검토|결정)(?:해\s*주세요|하세요|하십시오)[.!]?$/.test(tail);
 const opening=hasQuestion?body.slice(0,body.lastIndexOf(tail)).trim():body;
 // Ignore exact duplicate facts, without dropping distinct or omitted conditions.
 const unique=details.filter((value,index)=>details.indexOf(value)===index&&!body.includes(value));
 const offset=Math.max(0,...[...opening.matchAll(/^\s*(\d+)\. /gm)].map(m=>Number(m[1])));
 if(!unique.length)return normalizeCaseText(body);
 return normalizeCaseText([opening,unique.map((value,i)=>`${offset+i+1}. ${value}`).join('\n\n'),hasQuestion?tail:''].filter(Boolean).join('\n\n'));
}


