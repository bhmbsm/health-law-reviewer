export type StudyRecord = {id:string; user_id:string; case_id:string; mode:string; correct:boolean; choice:boolean|null; hint:boolean; duration:number; created:string};
export type StudyProfile = {id:string; nickname:string; group_code:string|null};
export const studyModes:Record<string,string> = {story:'스토리 심사',free:'자유 심사',review:'오답 재심사',audit:'감사 재심사'};
export const koreanDay = (date:string) => new Date(date).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
export function filterStudyRecords(records:StudyRecord[],from:string,to:string) {
  return records.filter(record=>{const date=koreanDay(record.created);return (!from||date>=from)&&(!to||date<=to);});
}
export function summarizeStudyRecords(profiles:StudyProfile[],records:StudyRecord[]) {
  const byUser=new Map<string,StudyRecord[]>();
  for(const record of records){const bucket=byUser.get(record.user_id)||[];bucket.push(record);byUser.set(record.user_id,bucket);}
  const known=new Set(profiles.map(profile=>profile.id));
  const allProfiles=[...profiles,...[...byUser.keys()].filter(id=>!known.has(id)).map(id=>({id,nickname:'프로필 없는 사용자',group_code:null}))];
  return allProfiles.map(profile=>{
    const rows=byUser.get(profile.id)||[],correct=rows.filter(row=>row.correct).length;
    return {...profile,solved:rows.length,correct,accuracy:rows.length?Math.round(correct/rows.length*100):null,seconds:rows.reduce((sum,row)=>sum+row.duration,0),last:rows.reduce((last,row)=>row.created>last?row.created:last,'')};
  }).sort((a,b)=>b.solved-a.solved||a.nickname.localeCompare(b.nickname));
}
export function studyCSV(rows:unknown[][]) {
  // Prevent spreadsheet formulas in user-supplied nicknames and labels.
  return '\uFEFF'+rows.map(row=>row.map(value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
}
