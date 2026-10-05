import * as XLSX from 'xlsx';
import type {Case} from './cases';
import {correctKnownMedicalRule} from './medical-rule-corrections';

export type RuleBank={kind:'rule-bank';id:string;name:string;rules:Rule[];createdAt:string};
export type Rule={id:string;lawKey:string;law:string;article:string;title:string;difficulty:string;note:string;scenario:string;approveFacts:Record<string,unknown>[];rejectFacts:Record<string,unknown>[];factLabels:Record<string,string>;factOrder:string[];changedField:string;source:string;lawText:string;approveBody:string;rejectBody:string;judgmentBasis?:string;auditVersion?:number};
type Row=Record<string,unknown>;

const text=(value:unknown)=>String(value??'').trim();
const object=(value:unknown)=>{try{const parsed=JSON.parse(text(value));return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch{return {};}};
const sheetRows=(workbook:XLSX.WorkBook,name:string):Row[]=>{
  const sheet=workbook.Sheets[name];
  return sheet?XLSX.utils.sheet_to_json<Row>(sheet,{defval:''}):[];
};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const variants=(base:Record<string,unknown>,field:string,values:string[])=>values.length?values.map(value=>({...base,[field]:value})):[base];
const staffToken=(value:unknown)=>typeof value==='string'?value.match(/^STAFF_MIN:(inpatients):(outpatients):(60|120):(-1|0|1)$/):null;
const dutyToken=(value:unknown)=>typeof value==='string'?value.match(/^DUTY_MIN:(inpatients):(200|300):(0|WRONG)$/):null;
export function calculateDutyMinimum(inpatients:number,divisor:200|300):number{
  if(!Number.isInteger(inpatients)||inpatients<10||inpatients>1000||inpatients%10!==0||![200,300].includes(divisor))throw Error('당직의료인 계산값이 올바르지 않습니다.');
  return Math.ceil(inpatients/divisor);
}
export function calculateStaffMinimum(inpatients:number,outpatients:number,divisor:60|120):number{
  if(![inpatients,outpatients].every(n=>Number.isInteger(n)&&n>=1&&n<=1000)||![60,120].includes(divisor))throw Error('의료인 정원 계산값이 올바르지 않습니다.');
  // Integer numerator avoids floating-point errors at exact staffing boundaries.
  return Math.ceil((3*inpatients+outpatients)/divisor);
}
export const materializeFacts=(source:Record<string,unknown>|undefined):Record<string,unknown>=>{
const result:Record<string,unknown>=Object.fromEntries(Object.entries(source||{}).map(([key,value])=>{
  if(typeof value!=='string') return [key,value];
  if(value==='OMIT')return [key,''];
  if(value.startsWith('RAND_CHOICE:')){
    const options=value.slice(12).split(':').filter(Boolean);
    if(!options.length)throw Error('선택 난수의 값목록이 비어 있습니다.');
    return [key,options[Math.floor(Math.random()*options.length)]];
  }
  if(value.startsWith('RAND_INT_MIN:'))throw Error('상한이 없는 정수 난수는 지원하지 않습니다. 최소·최대·간격을 지정해 주세요.');
  const match=value.match(/^RAND_INT:(\d+):(\d+):(\d+)$/);
  if(!match){if(value.startsWith('RAND_'))throw Error('난수 규칙이 올바르지 않습니다.');return [key,value];}
  const min=Number(match[1]),max=Number(match[2]),step=Number(match[3]);
  if(step<1||max<min||max>1000000)throw Error('정수 난수 범위가 올바르지 않습니다.');
  const count=Math.floor((max-min)/step);
  return [key,String(min+Math.floor(Math.random()*(count+1))*step)];
}));
for(const [key,value]of Object.entries(result)){
  if(typeof value==='string'&&value.startsWith('ROLE_OF:')){
    const target=result[value.slice(8)];const match=typeof target==='string'?target.match(/(?:치과의사|한의사|조산사|의사)$/):null;
    if(!match)throw Error('연동할 의료인 직종을 찾을 수 없습니다.');result[key]=match[0];
  }
}
for(const [key,value] of Object.entries(result)){
  const duty=dutyToken(value);
  if(typeof value==='string'&&value.startsWith('DUTY_MIN:')&&!duty)throw Error('당직의료인 계산 규칙이 올바르지 않습니다.');
  if(duty){
    const minimum=calculateDutyMinimum(Number(result[duty[1]]),Number(duty[2]) as 200|300);
    const draw=1+Math.floor(Math.random()*9);
    result[key]=String(duty[3]==='0'?minimum:draw>=minimum?draw+1:draw);
    continue;
  }
  const token=staffToken(value);
  if(typeof value==='string'&&value.startsWith('STAFF_MIN:')&&!token)throw Error('의료인 정원 계산 규칙이 올바르지 않습니다.');
  if(!token)continue;
  const minimum=calculateStaffMinimum(Number(result[token[1]]),Number(result[token[2]]),Number(token[3]) as 60|120);
  const offset=Number(token[4]);
  // A natural-number distractor must never be zero or equal to the minimum.
  result[key]=String(minimum===1&&offset===-1?minimum+1:minimum+offset);
}
return result;
};
// 법전 원문은 인위적으로 쪼개지 않는다. 날짜·호수까지 끊기면 읽기 어려워진다.
const formatLawText=(value:string)=>value.replace(/\r\n/g,'\n').trim();
const displayValue=(value:unknown)=>Array.isArray(value)?value.join(', '):String(value);
const topicParticle=(word:unknown)=>{const normalized=text(word);const code=normalized.charCodeAt(normalized.length-1);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28!==0?'은':'는';};
const factSentence=(key:string,value:unknown,label:string)=>{
  const shown=displayValue(value);
  if(key==='duty_inpatients') return `현재 입원환자는 ${shown}명입니다.`;
  if(key==='inpatients') return label==='현재 입원환자 수'?`현재 입원환자는 ${shown}명입니다.`:`연평균 1일 입원환자는 ${shown}명입니다.`;
  if(key==='outpatients') return `연평균 1일 외래환자는 ${shown}명입니다.`;
  if(key==='staff_minimum') return `최소 필요 한의사 수를 ${shown}명으로 계산했습니다.`;
  if(key==='duty_minimum') return `당직 한의사의 최소 필요 인원을 ${shown}명으로 계산했습니다.`;
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
  if(key==='disqualification_fact')return `면허 심사자료: ${shown}.`;
  if(key==='elapsed_hours')return `최종 진료 시부터 사망까지 ${shown}시간이 지났습니다.`;
  if(key==='patient_age')return `환자는 만 ${shown}세입니다.`;
  return `${label}: ${shown}.`;
};
const renderTemplate=(template:string,selected:Record<string,unknown>)=>template.replace(/\{([a-zA-Z_][a-zA-Z_0-9]*)\}/g,(_,key)=>{
  if(!(key in selected))throw Error(`사례 틀에 연결되지 않은 필드가 있습니다: ${key}`);
  return displayValue(selected[key]??'');
}).replace(/\s{2,}/g,' ').trim();
const caseBody=(rule:Rule,selected:Record<string,unknown>)=>renderTemplate(rule.scenario||'제출된 신청 내용을 검토해 승인 또는 반려를 결정하세요.',selected);
const facts=(value:Record<string,unknown>,labels:Record<string,string>={},order:string[]=[],scenario='')=>Object.entries(value).sort(([a],[b])=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?Number.MAX_SAFE_INTEGER:ai)-(bi<0?Number.MAX_SAFE_INTEGER:bi);}).filter(([key,item])=>item!==''&&item!==null&&item!==undefined&&!scenario.includes(`{${key}}`)).flatMap(([key,item])=>{
  const shown=displayValue(item);
  if(['document_items','consent_items'].includes(key))return shown.split(' / ').map((part,i)=>`${i+1}. ${part}`);
  const label=labels[key]&&!/^[a-z_0-9]+$/i.test(labels[key])?labels[key]:'제출 사항';
  return [factSentence(key,item,label)];
});
const caseExplanation=(rule:Rule,selected:Record<string,unknown>,approved:boolean)=>{
  // Older stored banks predate changedField. Recover it only when one fact differs.
  const pass=rule.approveFacts[0]||{},reject=rule.rejectFacts[0]||{};
  const differences=Object.keys({...pass,...reject}).filter(key=>!same(pass[key],reject[key]));
  const field=text(rule.changedField)||(rule.approveFacts.length&&rule.rejectFacts.length&&differences.length===1?differences[0]:'');
  if(!field)return `${approved?'승인':'반려'}: ${text(rule.note)||'제출된 사실과 법령 원문의 판단 기준을 확인하세요.'}`;
  const label=rule.factLabels?.[field]||field;
  const duty=dutyToken(pass[field]);
  if(duty){
    const patients=Number(selected[duty[1]]),divisor=Number(duty[2]) as 200|300;
    const minimum=calculateDutyMinimum(patients,divisor);
    return `${approved?'승인':'반려'}: 현재 입원환자 ${patients}명을 ${divisor}명으로 나눈 수를 올림하면 당직 한의사는 최소 ${minimum}명입니다. 제시된 ${selected[field]}명은 ${approved?'정확한 최소 인원입니다.':'최소 인원 계산과 다릅니다. 더 많이 배치할 수 있는지와 최소 인원 계산은 구분해야 합니다.'}`;
  }
  const calculation=staffToken(pass[field]);
  if(calculation){
    const inpatients=Number(selected[calculation[1]]),outpatients=Number(selected[calculation[2]]),divisor=Number(calculation[3]) as 60|120;
    const minimum=calculateStaffMinimum(inpatients,outpatients,divisor);
    return `${approved?'승인':'반려'}: 입원환자 ${inpatients}명 ÷ ${divisor/3} + 외래환자 ${outpatients}명 ÷ ${divisor}의 합을 마지막에 올림하면 최소 ${minimum}명입니다. 제시된 ${selected[field]}명은 ${approved?'정확한 최소 인원입니다.':'최소 인원 계산과 다릅니다. 더 많이 배치할 수 있는지와 최소 인원 계산은 구분해야 합니다.'}`;
  }
  const stated=factSentence(field,selected[field],label);
  if(rule.judgmentBasis){
    const basis=rule.judgmentBasis;
    if(!approved&&['document_items','consent_items','departments'].includes(field)){
      const split=(v:unknown)=>displayValue(v??'').split(field==='departments'?', ':' / ');
      const required=split(pass[field]),submitted=split(selected[field]);
      const missing=required.filter(x=>!submitted.includes(x));const added=submitted.filter(x=>!required.includes(x));
      return `반려: ${missing.length?`필수사항 “${missing.join('”, “')}”이 빠졌습니다.`:'법정 필수사항과 다릅니다.'}${added.length?` 대신 들어간 “${added.join('”, “')}”은 빠진 필수사항을 대신하지 못합니다.`:''} ${basis}`;
    }
    if(field==='disqualification_fact'){
      const v=text(selected[field]);let reason='';
      if(/정신질환/.test(v))reason=approved?'전문의가 의료인으로 적합하다고 인정한 예외입니다.':'적합하다는 전문의 인정이 제시되지 않아 정신질환자 결격사유를 충족합니다.';
      else if(/집행 종료|집행면제/.test(v))reason=approved?'집행 종료·면제 확정 후 5년이 지났습니다.':'집행 종료·면제 확정 후 5년이 지나지 않았습니다.';
      else if(/집행유예/.test(v))reason=approved?'집행유예 종료 후 2년이 지났습니다.':'집행유예 종료 후 2년이 지나지 않았습니다.';
      else if(/선고유예/.test(v))reason=approved?'선고유예 기간이 끝났습니다.':'선고유예 기간 중입니다.';
      else if(approved)reason='제시된 사실 자체는 의료법 제8조의 결격사유가 아닙니다.';
      return `${approved?'승인':'반려'}: ${v}. ${reason} ${basis}`;
    }
    return `${approved?'승인':'반려'}: ${selected[field]===''?'신청서에 필수 요건이 제시되지 않았습니다.':stated} ${basis}`;
  }
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
  const rules=rawRules.map((row):Rule|null=>{
    const id=text(row['규칙ID']);const lawKey=text(row['법전키']);const lawRow=laws.get(lawKey);const checked=verification.get(id);const preview=previews.get(id);
    if(!id||!lawRow||!checked) return null;
    const approve=object(checked['승인 사실값(JSON)']||row['승인 사례 사실값(JSON)']);
    const reject=object(checked['반려 사실값(JSON)']||row['반려 사례 사실값(JSON)']);
    const hasApprove=Object.keys(approve).length>0;
    const hasReject=Object.keys(reject).length>0;
    const changedCount=text(checked['변경 사실 개수']);
    if((!hasApprove&&!hasReject)||text(checked['검증 상태'])!=='통과') return null;
    if(hasApprove&&hasReject&&changedCount!=='1') return null;
    const changedField=text(checked['변경 필드키'])||Object.keys({...approve,...reject}).find(key=>!same(approve[key],reject[key]))||'';
    if(hasApprove&&hasReject){const differences=Object.keys({...approve,...reject}).filter(key=>!same(approve[key],reject[key]));if(differences.length!==1||differences[0]!==changedField)throw Error(`${id}: 승인·반려에서 바뀌는 사실은 지정한 필드 한 개여야 합니다.`);}
    const criterion=criteria.find(item=>text(item['규칙ID'])===id&&text(item['필드키'])===changedField);
    if(!changedField||!criterion) return null;
    const listId=text(criterion['목록ID'])||text(criterion['통과값/목록ID']);
    const passValues=values.filter(item=>text(item['목록ID'])===listId&&text(item['판정역할'])==='통과').map(item=>text(item['표시값'])).filter(Boolean);
    const rejectValues=values.filter(item=>text(item['목록ID'])===listId&&text(item['판정역할'])==='반려').map(item=>text(item['표시값'])).filter(Boolean);
    if((hasApprove&&!passValues.length)||(hasReject&&!rejectValues.length))throw Error(`${id}: 값목록의 승인·반려 값이 누락됐습니다.`);
    const factLabels=Object.fromEntries(criteria.filter(item=>text(item['규칙ID'])===id).map(item=>[text(item['필드키']),text(item['화면 표시명'])||text(item['필드키'])]));
    return {id,lawKey,law:text(lawRow['법령명'])||'의료법',article:text(row['주요참조'])||text(lawRow['조문참조']),title:text(row['문항명']),difficulty:text(row['난이도'])||'보통',note:text(row['메모']),scenario:text(row['고정 시나리오'])||text(preview?.['승인 사례(화면 초안)']),approveFacts:hasApprove?variants(approve,changedField,passValues):[],rejectFacts:hasReject?variants(reject,changedField,rejectValues):[],factLabels,factOrder:criteria.filter(item=>text(item['규칙ID'])===id).sort((a,b)=>Number(a['순서'])-Number(b['순서'])).map(item=>text(item['필드키'])).filter(Boolean),changedField,source:text(lawRow['공식 링크']),lawText:formatLawText(text(lawRow['조문 원문'])),approveBody:text(preview?.['승인 사례(화면 초안)']),rejectBody:text(preview?.['반려 사례(화면 초안)']),judgmentBasis:text(row['판정 근거']),auditVersion:text(row['판정 근거'])?1:undefined};
  }).filter((rule):rule is Rule=>rule!==null);
  if(rules.length!==rawRules.length)throw Error(`출제 규칙 ${rawRules.length-rules.length}개가 법전·판정기준·사례검증 연결 검사를 통과하지 못했습니다. 일부 규칙을 누락시킨 채 저장할 수 없습니다.`);
  for(const raw of rules){
    const rule=correctKnownMedicalRule(raw);if(!rule)continue;
    const all=[...rule.approveFacts,...rule.rejectFacts];
    if(all.some(f=>Object.keys(f).length===0))throw Error(`${rule.id}: 사례 사실값이 비어 있습니다.`);
    if(rule.approveFacts.some(p=>rule.rejectFacts.some(q=>same(p,q))))throw Error(`${rule.id}: 동일한 사실을 승인과 반려로 동시에 지정했습니다.`);
    for(const [approved,side]of [[true,rule.approveFacts],[false,rule.rejectFacts]] as const)side.forEach((_,index)=>makeRuleCase({name:file.name} as RuleBank,rule,approved,index));
  }
  if(!rules.length) throw Error('검수 통과한 출제 규칙을 찾지 못했습니다.');
  const normalizedRules=rules.map(correctKnownMedicalRule).filter((rule):rule is Rule=>rule!==null);
  return {kind:'rule-bank',id:file.name.includes('응급의료법')?'rulebank-emergency-medical-law':`rulebank-${file.name.replace(/[^a-z0-9]/gi,'-').toLowerCase().replace(/^-+|-+$/g,'')||'uploaded'}`,name:file.name.replace(/\.xlsx$/i,''),rules:normalizedRules,createdAt:new Date().toISOString()};
}

export const isRuleBank=(value:unknown):value is RuleBank=>!!value&&typeof value==='object'&&(value as RuleBank).kind==='rule-bank'&&Array.isArray((value as RuleBank).rules);
export function makeRuleCase(bank:RuleBank,rule:Rule,approved:boolean,index=0):Case{
  const corrected=correctKnownMedicalRule(rule);if(!corrected)throw Error('판정이 중첩되는 기존 의료법 규칙은 출제하지 않습니다.');rule=corrected;
  const selected=materializeFacts((approved?rule.approveFacts:rule.rejectFacts)[index]);
  const item:Case={id:`${rule.id}:${approved?'approve':'reject'}:${index}`,law:rule.law,article:rule.article,title:rule.title,sender:'보건법규 심사 접수실',body:caseBody(rule,selected),details:facts(selected,rule.factLabels,rule.factOrder,rule.scenario),answer:approved,explanation:caseExplanation(rule,selected,approved),rule:rule.lawText||rule.article,chapter:0,difficulty:rule.difficulty==='쉬움'?'기초':rule.difficulty==='어려움'?'심화':'응용',source:rule.source,origin:`자동출제 규칙 · ${bank.name}`};
  if(/RAND_|STAFF_MIN|DUTY_MIN|ROLE_OF|OMIT|\{[a-z_]+\}/.test([item.body,...item.details,item.explanation].join(' ')))throw Error('처리되지 않은 출제 규칙이 화면 문장에 남았습니다.');
  return Object.values(selected).length?Object.assign(item,{ruleGeneration:{name:bank.name,rule,index}}):item;
}
// Keep the generated question stable while answering, then redraw on a new session.
export function refreshRuleCase(item:Case):Case{
  const generation=(item as Case&{ruleGeneration?:{name:string;rule:Rule;index:number}}).ruleGeneration;
  return generation?makeRuleCase({name:generation.name} as RuleBank,generation.rule,item.answer,generation.index):item;
}
export function makeRuleCases(banks:RuleBank[]):Case[]{return banks.flatMap(bank=>bank.rules.flatMap(raw=>{const rule=correctKnownMedicalRule(raw);return rule?[...rule.approveFacts.map((_,index)=>makeRuleCase(bank,rule,true,index)),...rule.rejectFacts.map((_,index)=>makeRuleCase(bank,rule,false,index))]:[];}));}
