import type {Rule} from './rule-bank';
import {reviewedExplanations} from './reviewed-explanations';

const text=(value:unknown)=>String(value??'').trim();
const normalize=(value:string)=>value.replace(/[\s·ㆍ,，.。\-–—()（）“”"']/g,'');
const productionNote=/사용자(?:의)?\s*(?:요청|정정|승인|확정|오타)|사용자는.*(?:승인|확정)|반려값|통과값|출제값|출제상|노드|난수|원본 반려|정정했|수정했|생성합니다|고정합니다|표현값|바꿔치기|이 문항|이 문제|본 문항|학습용|사례에서는.*고정/;

/** Shared authoring notes are not learner explanations; keep only this case's basis. */
export function learnerBasis(rule:Rule,selected:Record<string,unknown>,approved:boolean,fallback=''):string{
 const basis=reviewedExplanations[rule.id]??(rule.judgmentBasis?.trim()||fallback);
 const field=rule.changedField,current=normalize(text(selected[field]));
 const otherRejections=rule.rejectFacts.map(f=>text(f[field])).filter(v=>v.length>=2&&!/^\d+(?:\.\d+)?$/.test(v)&&!/RAND_|STAFF_MIN|DUTY_MIN/.test(v))
  .map(normalize).filter(v=>v&&(approved||v!==current));
 return basis.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(s=>s&&!productionNote.test(s))
  .filter(s=>!otherRejections.some(v=>normalize(s).includes(v))).slice(0,2).join(' ');
}

/** Explicit reasons for multi-option categories and measured blood-donation thresholds. */
export function selectedCaseReason(rule:Rule,selected:Record<string,unknown>,approved:boolean):string|undefined{
 const v=text(selected[rule.changedField]);
 const membership:Record<string,string>={
  'BMA-A2-WORK-001':'혈액관리법 제2조제2호의 혈액관리업무',
  'BMR-A8-TEST-001':'시행규칙 제8조제1항에 열거된 혈액 검사',
  'BMR-A6-HEALTH-001':'시행규칙 제6조제2항의 채혈 전 건강진단 항목',
  'BMA-A12-DOCUMENT-001':'시행규칙 제14조제1항의 작성ㆍ비치 대상 서류',
  'BMD-A7-2-CRITERIA-001':'시행령 제7조의2제3항에 명시된 심사평가 기준',
  'BMA-A17-DELEGATED-001':'대한적십자사 회장에게 위탁하는 법정 업무',
  'LDA-A2-HOSPICE-DISEASE-001':'법 제2조제6호에 열거된 호스피스 대상 질환'
 };
 if(membership[rule.id])return `제시한 “${v}” 항목은 ${membership[rule.id]}에 ${approved?'해당합니다.':'해당하지 않습니다.'}`+
  (approved&&rule.id==='BMR-A8-TEST-001'&&/HTLV/.test(v)?' HTLV 검사는 혈장성분 채혈을 제외합니다.':'');
 if(rule.id==='BMA-A6-MEDICAL-WORK-001')return `${text(selected.institution)}의 ${v} 업무는 혈액관리법 제6조제1항에 따라 허용됩니다.`;
 if(rule.id==='BMA-A6-MANUF-WORK-001')return approved?`혈액제제 제조업자의 ${v} 업무는 허용됩니다.`:'혈액제제 제조업자는 혈액관리업무 중 채혈을 할 수 없습니다.';
 if(rule.id==='BMR-A3-REACTION-001'){
  if(approved)return `제시한 “${v}” 항목은 시행규칙 제3조에 따른 특정수혈부작용에 해당합니다.`;
  if(/통원/.test(v))return '시행규칙 제3조의 치료 관련 요건은 입원치료를 요하는 부작용입니다. 통원치료만을 제시한 내용은 이 요건과 다릅니다.';
  return `제시한 “${v}” 항목은 채혈부작용에 해당하며, 특정수혈부작용의 법정 항목과 구별됩니다.`;
 }
 if(rule.id==='BMR-A8-NOTIFY-001')return approved?`“${v}”의 검사결과는 시행규칙 제8조제4항에 따른 헌혈자 통보 대상입니다.`:'후천성면역결핍증 검사결과는 시행규칙 제8조제4항의 헌혈자 통보 대상에서 제외됩니다.';
 if(rule.id==='BMA-A15-FUND-USE-001')return approved?`“${v}” 항목은 헌혈환급적립금의 법정 사용 용도에 해당합니다.`:'시행령 제8조에 명시된 부작용 실태조사ㆍ연구의 대상은 특정수혈부작용입니다. 제시한 채혈부작용 연구는 이 항목과 다릅니다.';
 const measured:Record<string,{name:string;unit:string;standard:string}>={
  'BMR-A7-MALE-WEIGHT-001':{name:'남성 체중',unit:'kg',standard:'320mL 전혈채혈을 위한 남성의 최소 체중은 50kg입니다.'},
  'BMR-A7-FEMALE-WEIGHT-001':{name:'여성 체중',unit:'kg',standard:'320mL 전혈채혈을 위한 여성의 최소 체중은 45kg입니다.'},
  'BMR-A7-TEMP-001':{name:'체온',unit:'℃',standard:'체온은 37.5℃를 초과하면 채혈할 수 없습니다.'},
  'BMR-A7-SBP-001':{name:'수축기혈압',unit:'mmHg',standard:'수축기혈압은 90mmHg 이상 180mmHg 미만이어야 합니다.'},
  'BMR-A7-DBP-001':{name:'이완기혈압',unit:'mmHg',standard:'이완기혈압은 100mmHg 미만이어야 합니다.'},
  'BMR-A7-PULSE-001':{name:'분당 맥박',unit:'회',standard:'맥박은 분당 50회 이상 100회 이하여야 합니다.'}
 };
 const measurement=measured[rule.id];
 if(measurement)return `${measurement.standard} 제시한 수치(${measurement.name} ${v}${measurement.unit})는 이 기준을 ${approved?'충족합니다.':'충족하지 못합니다.'}`;
 const elapsed:Record<string,{event:string;minimum:string;unit:string}>={
  'BMR-A7-MALARIA-001':{event:'말라리아 치료 종료',minimum:'36개월',unit:'개월'},
  'BMR-A7-BRUCELLA-001':{event:'브루셀라증 치료 종료',minimum:'24개월',unit:'개월'},
  'BMR-A7-SYPHILIS-001':{event:'매독 치료 종료',minimum:'12개월',unit:'개월'},
  'BMR-A7-ACUTE-HBV-001':{event:'급성 B형간염 완치',minimum:'6개월',unit:'개월'},
  'BMR-A7-ACUTE-SYMPTOM-001':{event:'급성 감염성 질환 의심 증상 소실',minimum:'3일',unit:'일'}
 };
 const period=elapsed[rule.id];
 if(period)return `${period.event} 후 ${period.minimum}이 경과해야 채혈할 수 있습니다. 제시한 ${v}${period.unit}은 이 기간 요건을 ${approved?'충족합니다.':'충족하지 못합니다.'}`;
 if(rule.id.startsWith('BMR-A7-VACCINE-')){
  const minimum=text(rule.approveFacts[0]?.[rule.changedField]);
  return `${text(selected.vaccine)} 접종 후 채혈 전 법정 최소 대기기간은 ${minimum}입니다.`+(approved?'':` 제시한 대기기간(${v})은 법정 최소 대기기간과 다릅니다.`);
 }
 if(rule.id==='LDA-A17-WILL-METHOD-001'){
  if(!approved)return /스스로/.test(v)?'사전연명의료의향서의 내용은 담당의사가 환자에게 확인해야 합니다. 환자의 자기 확인만으로 대신할 수 없습니다.':'담당의사와 전문의의 확인만으로는 환자의 과거 의사에 관한 가족의 진술을 대신할 수 없습니다.';
  if(/연명의료계획서/.test(v))return '의료기관에서 작성된 연명의료계획서는 법 제17조제1항제1호에 따라 환자의 의사로 봅니다.';
  if(/사전연명의료의향서/.test(v))return '담당의사가 사전연명의료의향서의 내용을 환자에게 확인하면 법 제17조제1항제2호에 따른 의사 확인 방법에 해당합니다.';
  return '환자의 과거 의사에 관한 가족의 일치하는 진술을 담당의사와 해당 분야 전문의 1명이 확인하는 것은 법 제17조제1항제3호의 의사 확인 방법입니다.';
 }
 if(rule.id==='LDA-A23-CENTRAL-DUTIES-001')return approved?'호스피스사업 결과의 평가 및 활용은 중앙호스피스센터의 법정 업무입니다.':`“${v}”의 권한은 보건복지부장관에게 있으며, 중앙호스피스센터의 업무가 아닙니다.`;
}
