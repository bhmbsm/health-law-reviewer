import type {Case} from './cases';
import type {RuleBank} from './rule-bank';

export const isRuleBank=(value:unknown):value is RuleBank=>!!value&&typeof value==='object'&&(value as RuleBank).kind==='rule-bank'&&Array.isArray((value as RuleBank).rules);
export function shuffle<T>(items:readonly T[],random= Math.random):T[]{
 const result=[...items];
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 return result;
}
export function selectRandomCases(items:Case[],limit=5):Case[]{
 const groups=new Map<string,Case[]>();
 for(const item of items){
  const key=item.law+'|'+item.id.replace(/:(approve|reject):\d+$/,'');
  const group=groups.get(key)||[];group.push(item);groups.set(key,group);
 }
 return shuffle([...groups.values()]).slice(0,limit).map(group=>{
  const sides=[group.filter(c=>c.answer),group.filter(c=>!c.answer)].filter(side=>side.length);
  const side=sides[Math.floor(Math.random()*sides.length)];
  return side[Math.floor(Math.random()*side.length)];
 });
}
export async function ruleBankStorageId(bank:Pick<RuleBank,'name'>):Promise<string>{
 const name=bank.name.normalize('NFKC').trim().toLowerCase();
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(name));
 return 'custom-rulebank-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function assertLawSource(law:string,source:string):void{
 const match=decodeURIComponent(source).match(/\/법령\/([^/]+)/);
 if(match&&!law.replace(/\s/g,'').split(/[·ㆍ]/).includes(match[1].replace(/\s/g,'')))
  throw Error('문제의 법령명과 법전 링크가 다릅니다: '+law);
}
export function assertReadyCase(item:Case):void{
 if(!item||typeof item.id!=='string'||!Array.isArray(item.details))throw Error('문항 형식이 올바르지 않습니다.');
 assertLawSource(item.law,item.source||'');
 if(/RAND_|STAFF_MIN:|DUTY_MIN:|ROLE_OF:|\{[a-z_]+\}/.test([item.body,...item.details,item.explanation].join(' ')))throw Error('엑셀 변수 처리가 끝나지 않은 고정 문항입니다. 원본 엑셀을 등록해 주세요.');
}
export async function buildQuestionBank(shared:{payload:unknown}[],saved:Case[]=[],localRuleBanks:RuleBank[]=[],online=true):Promise<Case[]>{
 // Shared uploads are authoritative. Old browser questions must never override new rules.
 const payloads=online?shared.map(row=>row.payload):[...localRuleBanks,...saved];
 const rules=payloads.filter(isRuleBank);
 const fixed=payloads.filter(item=>!isRuleBank(item)) as Case[];
 const generated=rules.length?(await import('./rule-bank')).makeRuleCases(rules):[];
 const seen=new Set<string>();
 return [...generated,...fixed].filter(item=>{
  assertReadyCase(item);
  const key=item.law+'|'+item.id;
  if(seen.has(key))return false;seen.add(key);return true;
 });
}

/** Student headings describe the task, never the tested condition or answer. */
export function studentCaseTitle(item:Pick<Case,'law'|'article'>):string{
 const article=item.article?.match(/^제(\d+)조(?:의(\d+))?/);
 const key=article?article[1]+(article[2]?'-'+article[2]:''):'';
 if(item.law==='의료법'){
  const titles:Record<string,string>={
   '3-2':'의료기관 개설 심사',
   '3-3':'종합병원 개설 심사',
   '3-4':'상급종합병원 지정 심사',
   '3-5':'전문병원 지정 심사'
  };
  if(titles[key])return titles[key];
 }
 return item.law+' 사례 심사';
}

/** Learning categories may combine laws; their source names and original text stay intact. */
export function lawCategory(law=''):string{
 return ['간호법','간호법시행령','간호법시행규칙'].includes(law.replace(/\s/g,''))?'의료법':law;
}
