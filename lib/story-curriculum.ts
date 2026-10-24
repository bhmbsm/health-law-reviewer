import type {Case} from './cases';
import {lawCategory} from './question-bank';

export const STORY_CHAPTER_TARGET=50;
const M='의료법',I='감염병의 예방 및 관리에 관한 법률',A='후천성면역결핍증 예방법',E='응급의료에 관한 법률',B='혈액관리법',N='국민건강보험법',H='연명의료결정법',D='마약류 관리에 관한 법률',Q='검역법',L='지역보건법',P='국민건강증진법',F='보건의료기본법';
const draft=[
 ['첫 심사',[M],[50],'새 심사관으로 발령받았습니다. 의료기관 개설과 의료인의 기본 의무를 확인하며 첫 50건을 처리하세요.','첫 근무의 조언','선임이 서류 한 장을 돌려줍니다. “빠른 판단보다 무엇을 판단해야 하는지 찾는 게 먼저예요.”','수습 심사관','badge'],
 ['진료실에서 지역사회로',[M,I],[20,30],'병원 민원에 감염병 신고가 더해졌습니다. 의료인의 의무와 감염병 대응 절차를 함께 심사하세요.','신고가 몰리는 오후','보건소에서 연락이 왔습니다. 동료들이 신고 경로를 나눠 확인하는 동안 담당 서류의 근거를 점검합니다.','심사관','shield'],
 ['감염 관리와 정보 보호',[I,A],[25,25],'감염 확산을 막는 조치와 감염인의 권리를 함께 살펴야 합니다. 검진·신고·비밀유지 사건을 처리하세요.','닫힌 상담실','민원인이 조용히 묻습니다. “이 기록은 누구에게 전달되나요?” 보호해야 할 정보도 업무의 일부입니다.','주임 심사관','badgeCheck'],
 ['응급 현장의 선택',[E,B],[35,15],'응급의료와 수혈 관련 민원이 접수됩니다. 긴급한 상황에서도 법정 절차와 담당 주체를 확인하세요.','야간 연락망','응급실에서 이송 기관을 확인해 달라는 연락이 왔습니다. 당직자가 연락망을 정리하는 동안 접수 서류를 검토합니다.','선임 심사관','shieldCheck'],
 ['혈액과 진료의 안전',[B,M],[30,20],'의료기관과 혈액원의 안전관리 사건을 맡았습니다. 검사·보존·공급과 진료 현장의 의무를 점검하세요.','안전 점검 회의','혈액원 담당자가 점검표를 가져왔습니다. “한 항목을 놓치지 않으려고 서로의 기록을 확인하고 있습니다.”','책임 심사관','medal'],
 ['건강보험 민원실',[N,M],[40,10],'보험 자격과 급여에 관한 문의가 늘었습니다. 적용 대상·기한·담당 기관을 구별해 설명하세요.','창구에 남은 질문','민원인이 진료비 영수증을 펼칩니다. “제가 어떤 기준을 적용받는지 알고 싶어요.” 쉬운 설명을 준비합니다.','수석 심사관','award'],
 ['환자의 결정과 기록',[H,M],[35,15],'환자의 의사와 의료기관의 절차를 검토합니다. 연명의료결정과 의료기록 관련 사건을 심사하세요.','가족의 기다림','가족이 상담실 앞에서 기다리고 있습니다. 담당자는 환자의 의사 확인에 필요한 기록을 다시 살펴봅니다.','부심사관','star'],
 ['마약류와 의료기관 감독',[D,M,B],[30,10,10],'팀 단위 점검을 맡았습니다. 의료용 마약류와 의료기관·혈액원의 관리 기준을 점검하세요.','점검팀의 합류','동료가 점검표를 건넵니다. “업무가 넓어졌어도 판단은 한 가지씩 확인하면 됩니다.”','팀장 심사관','crown'],
 ['국경을 넘는 보건 대응',[Q,I],[30,20],'입국 단계의 검역과 국내 감염병 대응을 연결합니다. 상황별 조치와 권한을 구별하세요.','검역소의 연락','입국 현장과 지역 보건기관에서 연락이 이어집니다. 두 기관 사이에 빠진 절차가 없는지 살펴봅니다.','부서 심사관','trophy'],
 ['지역 보건사업 조정',[L,P],[30,20],'지역 보건기관의 사업과 건강증진 업무를 조정합니다. 사업 범위와 담당 주체를 심사하세요.','주민 설명회','주민들이 원하는 사업을 제안했습니다. 동료들과 사업의 목적과 법정 범위를 대조해 봅니다.','과장 심사관','gem'],
 ['보건의료 계획과 행정',[F,L,P],[25,15,10],'개별 민원을 넘어 보건의료 계획을 검토합니다. 권리·책임·계획 수립 절차를 연결하세요.','회의를 앞둔 밤','부서별 계획서가 모였습니다. 각 사업이 어떤 권리와 책임에 연결되는지 최종 검토합니다.','국장 심사관','landmark'],
 ['최종 정책 심사',[F,L,P,N],[30,10,5,5],'최종 정책 심사를 맡았습니다. 보건의료기본법을 중심으로 지역 보건과 건강증진·보험 정책의 근거를 확인하세요.','마지막 발령 심사','후배가 첫날의 서류를 가져왔습니다. “이제는 저도 판단의 근거를 설명할 수 있어요.” 마지막 업무를 마무리합니다.','보건정책 총괄 심사관','sparkles'],
] as const;
export const storyChapters=draft.map(([title,laws,weights,briefing,incidentTitle,incident,rank,rankIcon])=>({title,law:laws[0],laws:[...laws] as string[],weights:[...weights] as number[],target:STORY_CHAPTER_TARGET,briefing,incidentTitle,incident,rank,rankIcon}));

/** Aliases affect curriculum selection only, never law text or answers. */
export function storyLaw(law:string):string{
 const category=lawCategory(law),key=category.replace(/[\s·ㆍ]/g,'');
 if(key.includes('후천성면역결핍증'))return A;
 if(key.startsWith('호스피스')||key==='연명의료결정법')return H;
 if(key.startsWith('마약류'))return D;
 return category;
}
export function chapterPool(bank:Case[],chapterIndex:number):Case[]{
 const chapter=storyChapters[chapterIndex];
 return chapter?bank.filter(item=>chapter.laws.includes(storyLaw(item.law))):[];
}
export function availableChapterLaws(bank:Case[],chapterIndex:number):string[]{
 const present=new Set(bank.map(item=>storyLaw(item.law)));
 return storyChapters[chapterIndex]?.laws.filter(law=>present.has(law))||[];
}
export function chapterLawSchedule(bank:Case[],chapterIndex:number):string[]{
 const chapter=storyChapters[chapterIndex];if(!chapter)return [];
 const present=availableChapterLaws(bank,chapterIndex);if(!present.length)return [];
 const weights=present.map(law=>chapter.weights[chapter.laws.indexOf(law)]),total=weights.reduce((a,b)=>a+b,0),used=present.map(()=>0),schedule:string[]=[];
 for(let position=0;position<chapter.target;position++){
  let best=0;
  for(let i=1;i<present.length;i++)if(weights[i]*(position+1)/total-used[i]>weights[best]*(position+1)/total-used[best])best=i;
  used[best]++;schedule.push(present[best]);
 }
 return schedule;
}
