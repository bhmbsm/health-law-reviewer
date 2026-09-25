import * as XLSX from 'xlsx';
import type {Case} from './cases';

export type RuleBank={kind:'rule-bank';id:string;name:string;rules:Rule[];createdAt:string};
type Rule={id:string;lawKey:string;law:string;article:string;title:string;difficulty:string;note:string;scenario:string;approveFacts:Record<string,unknown>[];rejectFacts:Record<string,unknown>[];factLabels:Record<string,string>;source:string;lawText:string};
type Row=Record<string,unknown>;

const text=(value:unknown)=>String(value??'').trim();
const object=(value:unknown)=>{try{const parsed=JSON.parse(text(value));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch{return {};}};
const sheetRows=(workbook:XLSX.WorkBook,name:string):Row[]=>{
  const sheet=workbook.Sheets[name];
  return sheet?XLSX.utils.sheet_to_json<Row>(sheet,{defval:''}):[];
};
const facts=(value:Record<string,unknown>,labels:Record<string,string>={})=>Object.entries(value).map(([key,item])=>`${labels[key]||key}: ${Array.isArray(item)?item.join(', '):String(item)}`);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const variants=(base:Record<string,unknown>,field:string,values:string[])=>values.length?values.slice(0,20).map(value=>({...base,[field]:value})):[base];
// 숫자(연도·날짜·금액)는 줄바꿈하지 않는다. 법령의 실제 구조 표시만 나눈다.
const formatLawText=(value:string)=>value.replace(/\s*(?=[①-⑳])/g,'\n').replace(/\s*(?=[가-하]\.\s)/g,'\n').replace(/\n{2,}/g,'\n').trim();
const caseBody=(rule:Rule)=>`${rule.law} ${rule.article}에 따른 「${rule.title}」 신청이 접수되었습니다.\n신청인이 제출한 사항이 법령 기준에 맞는지 확인한 뒤 승인 또는 반려를 결정하세요.`;

export async function parseRuleBank(file:File):Promise<RuleBank>{
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
  for(const required of ['법전','문항규칙','판정기준','값목록','학생 사례 미리보기','사례검증']) if(!workbook.SheetNames.includes(required)) throw Error(`${required} 시트를 찾을 수 없습니다.`);
  const laws=new Map(sheetRows(workbook,'법전').map(row=>[text(row['법전키']),row]));
  const verification=new Map(sheetRows(workbook,'사례검증').map(row=>[text(row['규칙ID']),row]));
  const previews=new Map(sheetRows(workbook,'학생 사례 미리보기').map(row=>[text(row['규칙ID']),row]));
  const criteria=sheetRows(workbook,'판정기준');
  const values=sheetRows(workbook,'값목록');
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  const rawRules=sheetRows(workbook,'문항규칙').filter(row=>text(row['출제 상태'])!=='비출제');
  const rules=rawRules.map(row=>{
    const id=text(row['규칙ID']);const lawKey=text(row['법전키']);const lawRow=laws.get(lawKey);const checked=verification.get(id);const preview=previews.get(id);
    if(!id||!lawRow||!checked) return null;
    const effectiveDate=text(lawRow['기준일']);
    if(/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)&&effectiveDate>today) return null;
    const approve=object(checked['승인 사실값(JSON)']||row['승인 사례 사실값(JSON)']);
    const reject=object(checked['반려 사실값(JSON)']||row['반려 사례 사실값(JSON)']);
    if(!Object.keys(approve).length||!Object.keys(reject).length||text(checked['변경 사실 개수'])!=='1'||text(checked['검증 상태'])!=='통과') return null;
    const changedField=text(checked['변경 필드키'])||Object.keys({...approve,...reject}).find(key=>!same(approve[key],reject[key]))||'';
    const criterion=criteria.find(item=>text(item['규칙ID'])===id&&text(item['필드키'])===changedField);
    if(!changedField||!criterion) return null;
    const listId=text(criterion['목록ID'])||text(criterion['통과값/목록ID']);
    const passValues=values.filter(item=>text(item['목록ID'])===listId&&text(item['판정역할'])==='통과').map(item=>text(item['표시값'])).filter(Boolean);
    const rejectValues=values.filter(item=>text(item['목록ID'])===listId&&text(item['판정역할'])==='반려').map(item=>text(item['표시값'])).filter(Boolean);
    const factLabels=Object.fromEntries(criteria.filter(item=>text(item['규칙ID'])===id).map(item=>[text(item['필드키']),text(item['화면 표시명'])||text(item['필드키'])]));
    return {id,lawKey,law:text(lawRow['법령명'])||'의료법',article:text(row['주요참조'])||text(lawRow['조문참조']),title:text(row['문항명']),difficulty:text(row['난이도'])||'보통',note:text(row['메모']),scenario:text(row['고정 시나리오'])||text(preview?.['승인 사례(화면 초안)']),approveFacts:variants(approve,changedField,passValues),rejectFacts:variants(reject,changedField,rejectValues),factLabels,source:text(lawRow['공식 링크']),lawText:formatLawText(text(lawRow['조문 원문']))};
  }).filter((rule):rule is Rule=>rule!==null);
  if(!rules.length) throw Error('검수 통과한 출제 규칙을 찾지 못했습니다.');
  return {kind:'rule-bank',id:`rulebank-${Date.now()}`,name:file.name.replace(/\.xlsx$/i,''),rules,createdAt:new Date().toISOString()};
}

export const isRuleBank=(value:unknown):value is RuleBank=>!!value&&typeof value==='object'&&(value as RuleBank).kind==='rule-bank'&&Array.isArray((value as RuleBank).rules);
export function makeRuleCase(bank:RuleBank,rule:Rule,approved:boolean,index=0):Case{
  const selected=(approved?rule.approveFacts:rule.rejectFacts)[index];
  return {id:`${bank.id}:${rule.id}:${approved?'approve':'reject'}:${index}`,law:rule.law,article:rule.article,title:rule.title,sender:'보건법규 심사 접수실',body:caseBody(rule),details:facts(selected,rule.factLabels),answer:approved,explanation:rule.note||`${rule.article}의 기준에 따라 판정합니다.`,rule:rule.lawText||rule.article,chapter:0,difficulty:rule.difficulty==='쉬움'?'기초':rule.difficulty==='어려움'?'심화':'응용',source:rule.source,origin:`자동출제 규칙 · ${bank.name}`};
}
export function makeRuleCases(banks:RuleBank[]):Case[]{return banks.flatMap(bank=>bank.rules.flatMap(rule=>[...rule.approveFacts.map((_,index)=>makeRuleCase(bank,rule,true,index)),...rule.rejectFacts.map((_,index)=>makeRuleCase(bank,rule,false,index))]));}
