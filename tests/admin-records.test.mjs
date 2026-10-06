import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/admin-records.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {filterStudyRecords,summarizeStudyRecords,studyCSV}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('period filters use Korean midnight and include both boundary days',()=>{
  const records=[{created:'2026-10-05T14:59:59Z'},{created:'2026-10-05T15:00:00Z'},{created:'2026-10-06T14:59:59Z'},{created:'2026-10-06T15:00:00Z'}];
  assert.deepEqual(filterStudyRecords(records,'2026-10-06','2026-10-06'),records.slice(1,3));
});
test('summaries keep zero-activity and missing-profile users without mixing records',()=>{
  const profiles=[{id:'a',nickname:'가',group_code:'TEAM'},{id:'b',nickname:'나',group_code:null}];
  const rows=[{user_id:'a',correct:true,duration:30,created:'2026-10-06T01:00:00Z'},{user_id:'a',correct:false,duration:90,created:'2026-10-06T02:00:00Z'},{user_id:'c',correct:true,duration:15,created:'2026-10-06T03:00:00Z'}];
  const result=summarizeStudyRecords(profiles,rows);
  assert.equal(result.length,3);assert.equal(result[0].solved,2);assert.equal(result[0].accuracy,50);assert.equal(result[0].seconds,120);
  assert.equal(result.find(row=>row.id==='b').accuracy,null);assert.equal(result.find(row=>row.id==='c').solved,1);
});
test('CSV escapes commas and quotes and neutralizes spreadsheet formula injection',()=>{
  const csv=studyCSV([['=HYPERLINK("bad")','한,의사','normal',0]]);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=HYPERLINK(\"\"bad\"\")\""));assert.ok(csv.includes('"한,의사"'));assert.ok(csv.endsWith('"0"'));
});
