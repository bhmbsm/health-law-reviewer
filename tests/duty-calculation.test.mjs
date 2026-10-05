import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import{createServer}from'vite';
const vite=await createServer({appType:'custom',configFile:false,server:{middlewareMode:true,hmr:false,ws:false}});
after(()=>vite.close());
const{calculateDutyMinimum,makeRuleCase,refreshRuleCase}=await vite.ssrLoadModule('/lib/rule-bank.ts');
const rule=(d,p='RAND_INT:10:1000:10')=>({id:'duty-'+d,law:'의료법 시행규칙',article:'제39조의18',title:'당직',difficulty:'보통',scenario:'최소 인원 계산이 맞나요?',changedField:'duty_minimum',factLabels:{inpatients:'현재 입원환자 수'},factOrder:['inpatients','duty_minimum'],approveFacts:[{inpatients:p,duty_minimum:`DUTY_MIN:inpatients:${d}:0`}],rejectFacts:[{inpatients:p,duty_minimum:`DUTY_MIN:inpatients:${d}:WRONG`}]});
test('duty staffing includes exactly 200 and 300, then adds a person above the boundary',()=>{
 assert.equal(calculateDutyMinimum(200,200),1);assert.equal(calculateDutyMinimum(210,200),2);
 assert.equal(calculateDutyMinimum(300,300),1);assert.equal(calculateDutyMinimum(310,300),2);
 for(const d of[200,300])for(let p=10;p<=1000;p+=10)assert.equal(calculateDutyMinimum(p,d),Math.floor((p+d-1)/d));
 assert.equal(calculateDutyMinimum(1000,200),5);assert.equal(calculateDutyMinimum(1000,300),4);
});
test('every distractor from 1 through 10 except the correct minimum can be drawn',()=>{
 const saved=Math.random;
 try{for(const d of[200,300])for(let p=10;p<=1000;p+=10){const min=calculateDutyMinimum(p,d),seen=new Set();for(let draw=0;draw<9;draw++){Math.random=()=> (draw+0.5)/9;const c=makeRuleCase({name:'bank'},rule(d,String(p)),false),value=Number(c.details[1].match(/\d+/)[0]);seen.add(value);assert.notEqual(value,min);assert.ok(c.explanation.includes(`최소 ${min}명`));assert.match(c.details[0],/^현재 입원환자는/);assert.ok(!c.details[0].includes('연평균'))}assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:10},(_,i)=>i+1).filter(x=>x!==min))}}
 finally{Math.random=saved}
});
test('patients redraw for a new session and rendered cases contain no formula directives',()=>{
 const c=makeRuleCase({name:'bank'},rule(200),true),fresh=Array.from({length:12},()=>refreshRuleCase(c));
 assert.ok(new Set(fresh.map(x=>x.details[0])).size>1);assert.ok(fresh.every(x=>!JSON.stringify([x.body,x.details,x.explanation]).includes('DUTY_MIN')));
 assert.throws(()=>calculateDutyMinimum(15,200));assert.throws(()=>calculateDutyMinimum(1010,300));
});
