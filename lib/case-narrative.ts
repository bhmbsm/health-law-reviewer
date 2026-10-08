import type {Case} from './cases';

/** Keep the tested facts in source order and ask the question after those facts. */
export function caseNarrative(item:Pick<Case,'body'|'details'>):string {
 const body=item.body.trim();
 const details=item.details.map(value=>value.trim()).filter(Boolean);
 if(!details.length)return body;
 const sentences=body.split(/(?<=[.!?。])\s+/u);
 const tail=sentences.at(-1)||'';
 const hasQuestion=/[?？]$|(?:판단|검토|결정)(?:해\s*주세요|하세요|하십시오)[.!]?$/.test(tail);
 const opening=hasQuestion?body.slice(0,body.lastIndexOf(tail)).trim():body;
 // Ignore exact duplicate facts, without dropping distinct or omitted conditions.
 const unique=details.filter((value,index)=>details.indexOf(value)===index&&!body.includes(value));
 const offset=Math.max(0,...[...opening.matchAll(/^\s*(\d+)\. /gm)].map(m=>Number(m[1])));
 return [opening,unique.map((value,i)=>`${offset+i+1}. ${value}`).join('\n\n'),hasQuestion?tail:''].filter(Boolean).join('\n\n');
}

