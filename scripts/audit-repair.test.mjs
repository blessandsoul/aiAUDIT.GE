import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAudit,assess,createIntakeState,questionFor,requiredFields} from '../src/lib/audit-engine.ts';
import {BANK} from '../src/lib/audit-bank.ts';
import {buildFinalBrief} from '../src/lib/audit-report.ts';
const empty={focus:'discovery',focusEvidence:'',updates:[],nextField:null};
const fact=(field,value)=>({id:field+':1',field,value,quote:value,status:'confirmed',turn:1});
const update=(field,value,correction=false)=>({...empty,updates:[{field,value,status:'confirmed',evidence:value,correction}]});
function clinic(){const s=createIntakeState('en');s.focus='chats';s.turn=5;s.currentQuestion='impact';s.facts.scale=fact('scale','200 messages per day');s.facts.business=fact('business','Clinic');s.facts.objective=fact('objective','Reduce delays');return s;}
for(const quantity of ['800 messages per day','200 messages per month','200 leads per day','Many messages']){
 test('quantity replacement requires context: '+quantity,()=>{
  const s=advanceAudit(clinic(),quantity,update('scale',quantity));
  assert.equal(s.facts.scale.status,'partial');assert.equal(s.facts.scale.previous.value,'200 messages per day');
  assert.equal(s.currentQuestion,'scale');assert.equal(s.complete,false);assert.equal(assess(s).product,null);
  assert.match(questionFor(s).content,/different periods or processes/);
 });
}
test('explicit correction resolves numeric replacement',()=>{
 const s=advanceAudit(clinic(),'Correction: 20 messages per day',update('scale','20 messages per day',true));
 assert.equal(s.facts.scale.status,'confirmed');assert.equal(s.facts.scale.value,'20 messages per day');
});
test('repeating the same quantity is not a conflict',()=>{
 const s=advanceAudit(clinic(),'200 messages per day',update('scale','200 messages per day'));
 assert.equal(s.facts.scale.status,'confirmed');assert.equal(s.facts.scale.previous,undefined);
});
test('no-pain discovery reaches not-now after one priority check',()=>{
 let s=createIntakeState('en');s.turn=1;s.currentQuestion='priority_check';
 s.facts.business=fact('business','Jewellery workshop');s.facts.objective=fact('objective','Check AI need');s.facts.severity=fact('severity','none');
 s=advanceAudit(s,'I don’t know',empty);assert(s.complete);assert.equal(assess(s).verdict,'not_now');
});
test('unknown-only discovery terminates without repeating area',()=>{
 let s=createIntakeState('en');const fields=[];
 for(let i=0;i<10&&!s.complete;i++){s=advanceAudit(s,'I don’t know',empty);fields.push(s.currentQuestion);}
 assert(s.complete);assert(fields.filter(f=>f==='area').length<=1);assert.equal(assess(s).product,null);
});
test('another priority asks for a new area, then unknown can end without looping',()=>{
 let s=clinic();s.currentQuestion='priority_check';s.facts.severity=fact('severity','none');
 s=advanceAudit(s,BANK.priority_check.options.find(o=>o.value==='another').label.en,empty);
 assert.equal(s.currentQuestion,'area');
 const questions=[];
 for(let i=0;i<18&&!s.complete;i++){questions.push(s.currentQuestion);s=advanceAudit(s,'I don’t know',empty);}
 assert(s.complete);assert(questions.filter(f=>f==='area').length<=2);assert.equal(assess(s).product,null);
});
test('revisiting an area clears the old no-pain conclusion',()=>{
 const s=createIntakeState('en');s.turn=3;s.currentQuestion='area';
 s.facts.priority_check=fact('priority_check','another');s.facts.severity=fact('severity','none');
 const next=advanceAudit(s,'Customer communication',empty);
 assert.equal(next.focus,'chats');assert.equal(next.facts.severity,undefined);assert.equal(next.facts.priority_check,undefined);
});
test('unresolved quantity stays out of an explicitly finished report',()=>{
 const pending=advanceAudit(clinic(),'800 messages per day',update('scale','800 messages per day'));
 const s=advanceAudit(pending,'Finish',empty,true);
 assert(s.complete);assert.equal(assess(s).product,null);
 assert.match(buildFinalBrief(s,'en'),/Statements requiring clarification/);
});
test('known tracking gap yields actionable measurement-first without a fabricated pain',()=>{
 let s=createIntakeState('en');s.focus='ads';s.turn=2;s.currentQuestion='priority_check';
 for(const [f,v]of Object.entries({business:'Furniture shop',objective:'Assess ads',acquisition:'paid',tracking:'none',systems:'Store admin',owner:'unavailable'}))s.facts[f]=fact(f,v);
 s=advanceAudit(s,'I don’t know',empty);assert(s.complete);assert.equal(assess(s).verdict,'measurement_first');
 assert.equal(assess(s).product,null);assert.equal(s.facts.pain,undefined);
 const report=buildFinalBrief(s,'en');assert.match(report,/test order/);assert.match(report,/unattributed orders/);assert.doesNotMatch(report,/Case outcome, cause of delay/);
});
test('completed supported clinic reopens on changed scale',()=>{
 const s=clinic();
 for(const f of requiredFields(s))if(!s.facts[f])s.facts[f]=fact(f,BANK[f].options[0]?.value||'Reported process');
 for(const[f,v]of Object.entries({severity:'material',repetition:'repeatable',data:'ready',owner:'available',constraints:'review',alternative:'insufficient',priority_check:'primary'}))s.facts[f]=fact(f,v);
 assert.equal(assess(s).product,'aiCHATS');s.complete=true;s.currentQuestion=null;
 const next=advanceAudit(s,'დღეში 800 შეტყობინება გვაქვს.',update('scale','დღეში 800 შეტყობინება გვაქვს.'));
 assert.equal(next.complete,false);assert.equal(next.currentQuestion,'scale');assert.equal(assess(next).product,null);
});
