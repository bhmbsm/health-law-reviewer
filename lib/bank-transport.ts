type SharedRow={payload:unknown};
type PackedBank={version:1;rows:SharedRow[];texts:string[];slots:[number,number,number][]};
const rulePayload=(value:unknown):value is {kind:string;rules:Record<string,unknown>[]}=>!!value&&typeof value==='object'&&(value as any).kind==='rule-bank'&&Array.isArray((value as any).rules);

/** Transfer repeated originals once; restore exact texts before case generation. */
export function packQuestionBanks(source:SharedRow[]):PackedBank {
 const texts:string[]=[],indices=new Map<string,number>(),slots:[number,number,number][]=[];
 const rows=source.map((row,rowIndex)=>{
  if(!rulePayload(row.payload))return row;
  const rules=row.payload.rules.map((rule,ruleIndex)=>{
   if(typeof rule.lawText!=='string')return rule;
   let index=indices.get(rule.lawText);
   if(index===undefined){index=texts.length;indices.set(rule.lawText,index);texts.push(rule.lawText);}
   slots.push([rowIndex,ruleIndex,index]);
   const {lawText,...rest}=rule;return rest;
  });
  return {...row,payload:{...row.payload,rules}};
 });
 return {version:1,rows,texts,slots};
}

export function unpackQuestionBanks(value:PackedBank):SharedRow[] {
 if(value?.version!==1||!Array.isArray(value.rows)||!Array.isArray(value.texts)||!Array.isArray(value.slots))throw Error('문제은행 응답 형식이 올바르지 않습니다.');
 const rows=value.rows.map(row=>rulePayload(row.payload)?{...row,payload:{...row.payload,rules:row.payload.rules.map(rule=>({...rule}))}}:row);
 for(const slot of value.slots){
  if(!Array.isArray(slot)||slot.length!==3||!slot.every(Number.isInteger))throw Error('법령 원문 연결이 올바르지 않습니다.');
  const [row,rule,text]=slot,payload=rows[row]?.payload;
  if(!rulePayload(payload)||!payload.rules[rule]||typeof value.texts[text]!=='string')throw Error('법령 원문 연결이 올바르지 않습니다.');
  payload.rules[rule].lawText=value.texts[text];
 }
 return rows;
}

export async function loadPublicQuestionBanks():Promise<SharedRow[]> {
 try{
  const response=await fetch('/api/question-bank',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('문제은행을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.');
  return unpackQuestionBanks(await response.json());
 }catch(error){
  if(error instanceof Error&&['TimeoutError','AbortError','TypeError'].includes(error.name))throw Error('문제은행 연결이 지연됩니다. 인터넷 연결을 확인하고 다시 불러오기를 눌러 주세요.');
  throw error;
 }
}
