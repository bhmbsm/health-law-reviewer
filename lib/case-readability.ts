import type {Rule} from './rule-bank';

/** Number complete fact sentences; never split dates, numbers, or legal names. */
export function numberedScenario(scenario:string,rule?:Rule):string {
 if(rule?.id.startsWith('ML-A3-4-')&&rule.approveFacts[0]?.training&&!scenario.includes('{training}'))scenario=scenario.replace('준비한 인력','수련기관 운영 현황은 “{training}”입니다. 준비한 인력');
 if(/\n\s*\d+\. /.test(scenario))return scenario;
 const sentences=scenario.trim().split(/(?<=[가-힣”"')\]}][.!?。])\s+/u);
 const list=sentences.findIndex(s=>/\{(?:document_items|consent_items)\}/.test(s));
 if(list>=0){
  const row=sentences[list],key=row.includes('{consent_items}')?'consent_items':'document_items';
  const header=key==='consent_items'?'환자에게 설명하고 서면동의를 받으려는 사항은 다음과 같습니다.':row.includes('가져온 서류')?'다음 서류를 가져왔습니다.':row.includes('서류에 기재')?'기재·제출하려는 항목은 다음과 같습니다.':'';
  // Keep background facts before the list, and the actual question after it.
  const rest=sentences.filter((_,i)=>i!==list),tail=rest.at(-1)||'';
  return [rest.slice(0,-1).join(' '),header,`{${key}}`,tail].filter(Boolean).join('\n\n');
 }
 const compound=(scenario.match(/\{[a-z_0-9]+\}/gi)||[]).length>=3||Object.keys(rule?.approveFacts[0]||{}).length>=3;
 if(!compound||sentences.length<4)return scenario;
 return [sentences[0],sentences.slice(1,-1).map((s,i)=>`${i+1}. ${s}`).join('\n\n'),sentences.at(-1)].join('\n\n');
}

export function numberedItems(value:string):string {
 const items=value.split(/\s+\/\s+/).filter(Boolean);
 return items.length>1?items.map((s,i)=>`${i+1}. ${s}`).join('\n'):value;
}

export function compactExplanation(value:string):string {
 const clean=value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 return clean.split(/(?<=[가-힣”"')\]][.!?。])\s+/u).join('\n');
}

/** Do not append the entire law to a selected insurance variant. */
export function insuranceExplanation(rule:Rule,selected:Record<string,unknown>,approved:boolean):string|undefined {
 if(!rule.law.startsWith('국민건강보험법'))return;
 const field=rule.changedField;if(!field)return;
 const value=String(selected[field]??'');
 const label=rule.factLabels?.[field]||'제시한 내용';
 // Reviewed legal standards are authoritative. An example value is never a
 // deadline, maximum, minimum, or exhaustive legal definition.
 if(rule.judgmentBasis?.trim())return `${approved?'승인':'반려'}: 제시한 내용은 이 문항의 판단 기준에 ${approved?'맞습니다.':'맞지 않습니다.'}\n${rule.judgmentBasis.trim()}`;
 const pass=rule.approveFacts.map(f=>String(f[field]??''));
 if(approved)return `승인: ${value}는 ${label}의 법정 기준에 맞습니다.`;
 const concrete=[...new Set(pass)].filter(s=>!s.startsWith('RAND_'));
 if(concrete.length&&concrete.join(' 또는 ').length<=100)return `반려: ${label}의 기준은 ${concrete.join(' 또는 ')}입니다.\n제시한 ${value}는 이 기준에 맞지 않습니다.`;
 // Multiple long permissible paths: explain the selected exclusion, without a wall of alternatives.
 return `반려: 제시한 ${value}는 ${label}에 관한 법정 요건에 해당하지 않습니다.\n구체적인 요건은 연결된 법령 원문에서 확인할 수 있습니다.`;
}

/** Evaluate legal categories, never treat an example's optional specialty as mandatory. */
export function hospitalExplanation(rule:Rule,selected:Record<string,unknown>,approved:boolean):string|undefined {
 if(!rule.id.startsWith('ML-A3-3-'))return;
 const beds=Number(selected.bed_count),departments=String(selected.departments||'').split(/\s*,\s*/).filter(Boolean);
 const count=new Set(departments).size;
 const has=(s:string)=>departments.includes(s);
 const reasons:string[]=[];
 if(beds<100)reasons.push(`종합병원은 100병상 이상이어야 하지만, 제시한 병상은 ${beds}병상입니다.`);
 const high=beds>300,minimum=high?9:7;
 if(count<minimum)reasons.push(`진료과목은 ${minimum}개 이상이어야 하지만, 제시한 과목은 총 ${count}개입니다.`);
 const core=['내과','외과','소아청소년과','산부인과'];
 if(high){const missing=[...core,'영상의학과','마취통증의학과','정신건강의학과','치과'].filter(s=>!has(s));if(missing.length)reasons.push(`필수 진료과목인 ${missing.join('·')}가 빠졌습니다.`);}
 else{const coreCount=core.filter(has).length;if(coreCount<3)reasons.push(`내과·외과·소아청소년과·산부인과 중 3개 이상이 필요하지만, ${coreCount}개만 있습니다.`);const missing=['영상의학과','마취통증의학과'].filter(s=>!has(s));if(missing.length)reasons.push(`필수 진료과목인 ${missing.join('·')}가 빠졌습니다.`);}
 if(!has('진단검사의학과')&&!has('병리과'))reasons.push('진단검사의학과 또는 병리과 중 하나가 있어야 하지만, 둘 다 없습니다.');
 if(approved)return `승인: ${beds}병상이고 진료과목은 ${count}개로, 병상·전체 과목 수·필수 과목 요건을 충족합니다.`;
 if(!reasons.length)return; // Preserve unrelated answer rules rather than inventing a reason.
 return reasons.map((s,i)=>(i===0?'반려: ':'')+s).join('\n');
}

