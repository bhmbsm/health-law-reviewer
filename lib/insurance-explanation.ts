import type {Rule} from './rule-bank';

/** Quote the uploaded law, never mistake the first generated example for a legal boundary. */
export function insuranceLawBasis(rule:Rule):string{
 if(!rule.law.startsWith('국민건강보험법')||!rule.lawText?.trim())return '';
 const original=rule.lawText.replace(/\\n/g,'\n').replace(/\r\n/g,'\n').trim();
 let excerpt=original;
 const heading=original.match(/(?:^|\n)\s*(제\d+조(?:의\d+)?)/)?.[1];
 const references=[...rule.article.matchAll(/(제\d+조(?:의\d+)?)(?:제(\d+)항)?(?:제(\d+)호)?/g)];
 const reference=references.find(match=>match[1]===heading);
 if(reference?.[2]){
  const paragraph=Number(reference[2]);
  const marker=String.fromCharCode(0x2460+paragraph-1);
  const starts=[...original.matchAll(/(?:^|\n)\s*([①-⑳])/g)];
  const index=starts.findIndex(match=>match[1]===marker);
  if(index>=0)excerpt=original.slice(starts[index].index!,index+1<starts.length?starts[index+1].index:undefined).trim();
 }
 // Keep the introductory conditions together with a referenced item.
 if(reference?.[3]&&(rule.article.match(/제\d+호/g)||[]).length===1){
  const items=[...excerpt.matchAll(/(?:^|\n)\s*(\d+)\.\s/g)];
  const index=items.findIndex(match=>match[1]===reference[3]);
  if(index>=0){
   const intro=excerpt.slice(0,items[0].index).trim();
   const item=excerpt.slice(items[index].index!,index+1<items.length?items[index+1].index:undefined).trim();
   excerpt=[intro,item].filter(Boolean).join('\n');
  }
 }
 return '판단 근거 ('+rule.article+'): '+excerpt;
}

/** These old sentences asserted a penalty even in the timely-filing variants. */
export function insuranceScenario(rule:Rule):string{
 if(!rule.law.startsWith('국민건강보험법'))return rule.scenario;
 if(rule.id==='NHI-A7-DAYS-001'&&rule.scenario==='카페를 개업한 윤OO씨가 첫 직원을 채용해 적용대상사업장이 되었고, 이후 보험자에게 사업장 신고를 했다. 공단은 과태료를 부과했다.')
  return '카페를 개업한 윤OO씨가 첫 직원을 채용해 적용대상사업장이 된 뒤 보험자에게 사업장 신고를 했습니다. 아래 신고 시점이 법정 신고 기한에 맞는지 판단해 주세요.';
 if(rule.id==='NHI-A8-DAYS-001'&&rule.scenario==='OO회사는 신입사원 장OO씨의 자격 취득 신고를 했는데, 신고가 늦었다며 과태료 처분을 받았다.')
  return 'OO회사는 신입사원 장OO씨의 자격 취득 신고를 했습니다. 아래 신고 시점이 법정 신고 기한에 맞는지 판단해 주세요.';
 return rule.scenario;
}
