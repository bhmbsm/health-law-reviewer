'use client';
import CaseDesk from '../CaseDesk';
import type {Case} from '../../lib/cases';
import {lawSearchUrl} from '../../lib/story';
export default function StoryCaseDocument({selected,index,total,result,unknownAnswer=false,saving,onAnswer,onNext,nextLabel,inReview=false,onAddReview}:{selected:Case;index:number;total:number;result:boolean|null;unknownAnswer?:boolean;saving:boolean;onAnswer:(choice:boolean|null)=>void;onNext:()=>void;nextLabel:string;inReview?:boolean;onAddReview?:()=>void}){
 return <CaseDesk item={selected} meta={[selected.law,`${index+1} / ${total}`]} result={result} unknownAnswer={unknownAnswer} saving={saving} onAnswer={onAnswer} onNext={onNext} nextLabel={nextLabel} inReview={inReview} onAddReview={onAddReview} lawUrl={selected.source||lawSearchUrl(selected.law)}/>;
}
