import type {Case} from './cases';

/** Keep the tested facts in source order and ask the question after those facts. */
export function caseNarrative(item:Pick<Case,'body'|'details'>):string {
 const body=item.body.trim();
 const details=item.details.map(value=>value.trim()).filter(Boolean);
 if(!details.length)return body;
 const sentences=body.split(/(?<=[.!?。])\s+/u);
 const tail=sentences.at(-1)||'';
 const hasQuestion=/[?？]$|(?:판단|검토|결정)(?:해\s*주세요|하세요|하십시오)[.!]?$/.test(tail);
 const opening=hasQuestion?sentences.slice(0,-1).join(' '):body;
 // Ignore exact duplicate facts, without dropping distinct or omitted conditions.
 const unique=details.filter((value,index)=>details.indexOf(value)===index&&!body.includes(value));
 return [opening,...unique,hasQuestion?tail:''].filter(Boolean).join(' ');
}
