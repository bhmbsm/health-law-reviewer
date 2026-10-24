import type {Case} from './cases';
import {selectRandomCases} from './question-bank';

export type StudySession={queue:Case[];index:number;mode:string;right:number;answered:number;unknown:number;pool:Case[];seenIds:string[]};

export function nextFreeStudyCase(pool:Case[],seenIds:readonly string[],lastId?:string,random=Math.random):{item:Case;seenIds:string[]}|null{
 if(!pool.length)return null;
 let seen=[...seenIds];
 let candidates=pool.filter(item=>!seen.includes(item.id));
 if(!candidates.length){seen=[];candidates=pool;}
 if(candidates.length>1)candidates=candidates.filter(item=>item.id!==lastId);
 const item=selectRandomCases(candidates,1,random)[0];
 return item?{item,seenIds:[...seen,item.id]}:null;
}

export function studySummary(session:Pick<StudySession,'answered'|'right'|'unknown'>){
 return {solved:session.answered,correct:session.right,incorrect:session.answered-session.right,unknown:session.unknown,accuracy:session.answered?Math.round(session.right/session.answered*100):0};
}
