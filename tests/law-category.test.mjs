import assert from 'node:assert/strict';
import test from 'node:test';
import {stripTypeScriptTypes} from 'node:module';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../lib/question-bank.ts',import.meta.url),'utf8');
const {lawCategory,selectRandomCases}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
test('law, enforcement decree and enforcement rule share a learning category',()=>{
 for(const law of ['의료법','혈액관리법','국민건강보험법','응급의료에 관한 법률','지역보건법','감염병의 예방 및 관리에 관한 법률']){
  for(const suffix of ['',' 시행령',' 시행규칙','시행령','시행규칙'])assert.equal(lawCategory(' '+law+suffix+' '),law);
 }
 assert.equal(lawCategory('간호법 시행규칙'),'의료법');
 assert.equal(lawCategory('간호법'),'의료법');
 assert.equal(lawCategory(), '');
});
test('one free-review category includes all three sources and excludes other laws',()=>{
 const pool=['의료법','의료법 시행령','의료법 시행규칙','혈액관리법'].map((law,i)=>({id:'node-'+i,law,answer:true}));
 const selected=selectRandomCases(pool.filter(c=>lawCategory(c.law)==='의료법'),5);
 assert.deepEqual(selected.map(c=>c.law).sort(),pool.slice(0,3).map(c=>c.law).sort());
 assert.equal(new Set(pool.map(c=>lawCategory(c.law))).size,2);
 assert.equal(pool[1].law,'의료법 시행령');
});
