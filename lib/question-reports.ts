import type {SupabaseClient} from '@supabase/supabase-js';
import type {Case} from './cases';
import {caseNarrative} from './case-narrative';
import {isRegisteredStudyUser,LOGIN_REQUIRED_MESSAGE} from './study-access';

export type QuestionReport={id:string;reporter_id:string;case_id:string;message:string;case_snapshot:Case;status:'open'|'resolved';created_at:string};
/** Stored JSON is untrusted; malformed reports must not break the administrator's inbox. */
export function readReportCase(value:unknown):Case{
 const data=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const text=(key:string)=>typeof data[key]==='string'?data[key] as string:'';
 return {id:text('id'),law:text('law'),article:text('article'),title:text('title'),sender:text('sender'),body:text('body'),details:[],answer:data.answer===true,explanation:text('explanation'),rule:text('rule'),chapter:typeof data.chapter==='number'?data.chapter:0,difficulty:text('difficulty'),source:text('source'),origin:text('origin')};
}
/** Capture the actual randomized case, not a later regeneration of the same rule. */
export function questionReportPayload(item:Case,message:string,id:string,userId:string){
 const text=message.trim();
 if(!text||text.length>2000)throw Error('신고 내용은 1~2,000자로 입력해 주세요.');
 const snapshot:Case={id:item.id,law:item.law,article:item.article,title:item.title,sender:item.sender,body:caseNarrative(item),details:[],answer:item.answer,explanation:item.explanation,rule:item.rule,chapter:item.chapter,difficulty:item.difficulty,source:item.source,origin:item.origin};
 return {id,reporter_id:userId,case_id:item.id,message:text,case_snapshot:snapshot};
}
export async function submitQuestionReport(client:SupabaseClient,item:Case,message:string,id:string){
 const {data,error:authError}=await client.auth.getUser();
 if(authError||!isRegisteredStudyUser(data.user))throw Error(LOGIN_REQUIRED_MESSAGE);
 const payload=questionReportPayload(item,message,id,data.user.id);
 const {error}=await client.from('question_reports').insert(payload);
 // Retry after a lost response is idempotent; report IDs are generated once per form.
 if(error&&error.code!=='23505')throw Error('신고를 전송하지 못했습니다. 작성 내용은 유지됩니다. 다시 시도해 주세요.');
}
