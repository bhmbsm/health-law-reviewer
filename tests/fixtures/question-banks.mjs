// Synthetic fixtures keep transport tests independent of private files and live uploads.
const lawText = '전송 검사용 원문: 조건·기간·숫자와 줄바꿈을 보존합니다.\n'.repeat(80);
const makeRule = id => ({
  id, lawKey:'transport-test', law:'전송 검사용 법령', article:'제1조', title:'전송 검사',
  difficulty:'기초', note:'', scenario:'제시한 값은 {value}입니다. 이 값으로 처리할까요?',
  approveFacts:[{value:'검사용 승인값'}], rejectFacts:[{value:'검사용 반려값'}],
  factLabels:{value:'검사값'}, factOrder:['value'], changedField:'value',
  source:'', lawText, approveBody:'', rejectBody:'', judgmentBasis:'전송 검사용 판단 기준입니다.'
});
export const questionBankFixtures = [
  ...[0,1].map(group => ({kind:'rule-bank',id:`transport-bank-${group}`,name:`전송 검사 ${group}`,createdAt:'2026-10-25',rules:[0,1,2].map(i=>makeRule(`transport-${group}-${i}`))})),
  {id:'transport-fixed',law:'전송 검사용 법령',article:'제2조',title:'고정 문항 검사',body:'고정 문항입니다.',details:[],answer:true,rule:lawText,explanation:'고정 해설입니다.',source:'',chapter:0,difficulty:'기초'}
];
