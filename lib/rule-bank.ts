import * as XLSX from 'xlsx';
import type {Case} from './cases';

export type RuleBank={kind:'rule-bank';id:string;name:string;rules:Rule[];createdAt:string};
type Rule={id:string;lawKey:string;law:string;article:string;title:string;difficulty:string;note:string;scenario:string;approveFacts:Record<string,unknown>[];rejectFacts:Record<string,unknown>[];factLabels:Record<string,string>;factOrder:string[];changedField:string;source:string;lawText:string};
type Row=Record<string,unknown>;

const text=(value:unknown)=>String(value??'').trim();
const object=(value:unknown)=>{try{const parsed=JSON.parse(text(value));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch{return {};}};
const sheetRows=(workbook:XLSX.WorkBook,name:string):Row[]=>{
  const sheet=workbook.Sheets[name];
  return sheet?XLSX.utils.sheet_to_json<Row>(sheet,{defval:''}):[];
};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const variants=(base:Record<string,unknown>,field:string,values:string[])=>values.length?values.slice(0,20).map(value=>({...base,[field]:value})):[base];
const materializeFacts=(source:Record<string,unknown>|undefined):Record<string,unknown>=>Object.fromEntries(Object.entries(source||{}).map(([key,value])=>{
  if(typeof value!=='string') return [key,value];
  const match=value.match(/^RAND_INT:(\d+):(\d+):(\d+)$/);
  if(!match) return [key,value];
  const min=Number(match[1]),max=Number(match[2]),step=Number(match[3]);
  const count=Math.floor((max-min)/step);
  return [key,String(min+Math.floor(Math.random()*(count+1))*step)];
}));
// 법전 원문은 인위적으로 쪼개지 않는다. 날짜·호수까지 끊기면 읽기 어려워진다.
const formatLawText=(value:string)=>value.replace(/\r\n/g,'\n').trim();
const displayValue=(value:unknown)=>Array.isArray(value)?value.join(', '):String(value);
const topicParticle=(word:string)=>{const code=word.charCodeAt(word.length-1);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0?'은':'는';};
const factSentence=(key:string,value:unknown,label:string)=>{
  const shown=displayValue(value);
  if(key==='bed_count') return `개설 예정 병상은 ${shown}병상입니다.`;
  if(key==='departments') return `설치 예정 진료과목은 ${shown}입니다.`;
  if(key==='department_count') return `설치 예정 진료과목은 모두 ${shown}개입니다.`;
  if(key==='specialist') return '각 진료과목마다 전속 전문의를 배치했습니다.';
  if(key==='guidance') return `보고된 지도 업무는 ${shown}입니다.`;
  if(key==='midwife_duty') return `조산, 임산부ㆍ태아ㆍ신생아에 대한 산전ㆍ산후관리, 보건교육ㆍ상담 및 ${shown}를 수행했습니다.`;
  if(key==='medical_service') return `제공한 의료는 ${shown}입니다.`;
  if(key==='scope') return `업무 대상은 ${shown}입니다.`;
  if(key==='supervision') return `해당 업무는 ${shown} 시행했습니다.`;
  if(key==='institution_type') return `신청 의료기관의 종류는 ${shown}입니다.`;
  if(key==='treatment_target'||key==='target') return `전문적으로 수행하려는 의료행위 대상은 ${shown}입니다.`;
  if(key==='training') return shown==='없음'?'전문의 수련기관으로 운영하지 않습니다.':'전문의가 되려는 사람을 수련시키는 기관으로 운영합니다.';
  if(key==='resources') return '법정 인력ㆍ시설ㆍ장비 요건을 갖추었습니다.';
  if(key==='case_mix') return '질병군별 환자구성비율은 법정 기준에 해당합니다.';
  if(key==='designator') return `지정권자는 ${shown}입니다.`;
  if(key==='review_years') return `다음 평가는 ${shown}년 뒤에 받겠다고 신청했습니다.`;
  if(key==='fine_amount') return `통지된 과태료는 ${shown}만원입니다.`;
  if(key==='name_badge') return `명찰에는 “${shown}”라고 표시되어 있습니다.`;
  return `${label}${topicParticle(label)} ${shown}입니다.`;
};
const facts=(value:Record<string,unknown>,labels:Record<string,string>={},order:string[]=[])=>Object.entries(value).sort(([a],[b])=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?Number.MAX_SAFE_INTEGER:ai)-(bi<0?Number.MAX_SAFE_INTEGER:bi);}).map(([key,item])=>factSentence(key,item,labels[key]||key));
const caseBody=(rule:Rule)=>rule.scenario?`${rule.scenario} 이 신청을 승인할 수 있는지 판단하세요.`:'제출된 신청 내용을 검토해 승인 또는 반려를 결정하세요.';
const caseExplanation=(rule:Rule,selected:Record<string,unknown>,approved:boolean)=>{
  const field=rule.changedField,label=rule.factLabels[field]||field;
  const stated=factSentence(field,selected[field],label);
  if(approved) return `승인: ${stated} 법정 기준에 맞습니다.`;
  const standard=factSentence(field,rule.approveFacts[0]?.[field],label);
  return `반려: ${stated} 법정 기준은 ${standard}`;
};

export async function parseRuleBank(file:File):Promise<RuleBank>{
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
  for(const required of ['법전','문항규칙','판정기준','값목록','학생 사례 미리보기','사례검증']) if(!workbook.SheetNames.includes(required)) throw Error(`${required} 시트를 찾을 수 없습니다.`);
  const laws=new Map(sheetRows(workbook,'법전').map(row=>[text(row['법전키']),row]));
  const verification=new Map(sheetRows(workbook,'사례검증').map(row=>[text(row['규칙ID']),row]));
  const previews=new Map(sheetRows(workbook,'학생 사례 미리보기').map(row=>[text(row['규칙ID']),row]));
  const criteria=sheetRows(workbook,'판정기준');
  const values=sheetRows(workbook,'값목록');
  const rawRules=sheetRows(workbook,'문항규칙').filter(row=>text(row['출제 상태'])!=='비출제');
  const rules=rawRules.map(row=>{
    const id=text(row['규칙ID']);const lawKey=text(row['법전키']);const lawRow=laws.get(lawKey);const checked=verification.get(id);const preview=previews.get(id);
    if(!id||!lawRow||!checked) return null;
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
    return {id,lawKey,law:text(lawRow['법령명'])||'의료법',article:text(row['주요참조'])||text(lawRow['조문참조']),title:text(row['문항명']),difficulty:text(row['난이도'])||'보통',note:text(row['메모']),scenario:text(row['고정 시나리오'])||text(preview?.['승인 사례(화면 초안)']),approveFacts:variants(approve,changedField,passValues),rejectFacts:variants(reject,changedField,rejectValues),factLabels,factOrder:criteria.filter(item=>text(item['규칙ID'])===id).map(item=>text(item['필드키'])).filter(Boolean),changedField,source:text(lawRow['공식 링크']),lawText:formatLawText(text(lawRow['조문 원문']))};
  }).filter((rule):rule is Rule=>rule!==null);
  if(!rules.length) throw Error('검수 통과한 출제 규칙을 찾지 못했습니다.');
  return {kind:'rule-bank',id:`rulebank-${Date.now()}`,name:file.name.replace(/\.xlsx$/i,''),rules,createdAt:new Date().toISOString()};
}

export const isRuleBank=(value:unknown):value is RuleBank=>!!value&&typeof value==='object'&&(value as RuleBank).kind==='rule-bank'&&Array.isArray((value as RuleBank).rules);
export function makeRuleCase(bank:RuleBank,rule:Rule,approved:boolean,index=0):Case{
  const selected=materializeFacts((approved?rule.approveFacts:rule.rejectFacts)[index]);
  return {id:`${bank.id}:${rule.id}:${approved?'approve':'reject'}:${index}`,law:rule.law,article:rule.article,title:rule.title,sender:'보건법규 심사 접수실',body:caseBody(rule),details:facts(selected,rule.factLabels,rule.factOrder),answer:approved,explanation:caseExplanation(rule,selected,approved),rule:rule.lawText||rule.article,chapter:0,difficulty:rule.difficulty==='쉬움'?'기초':rule.difficulty==='어려움'?'심화':'응용',source:rule.source,origin:`자동출제 규칙 · ${bank.name}`};
}
export function makeRuleCases(banks:RuleBank[]):Case[]{return banks.flatMap(bank=>bank.rules.flatMap(rule=>[...rule.approveFacts.map((_,index)=>makeRuleCase(bank,rule,true,index)),...rule.rejectFacts.map((_,index)=>makeRuleCase(bank,rule,false,index))]));}
