import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAudit,assess,createIntakeState,questionFor,requiredFields} from '../src/lib/audit-engine.ts';
import {buildFinalBrief} from '../src/lib/audit-report.ts';
const empty={focus:'discovery',focusEvidence:'',updates:[],nextField:null};
const fact=(field,value,status='confirmed')=>({id:field+':1',field,value,quote:value,status,turn:1});
function renovation(){const s=createIntakeState('ka');s.focus='growth';s.turn=10;for(const [f,v] of Object.entries({business:'სარემონტო კომპანია',objective:'გაყიდვები',bottleneck:'conversion',loss_reason:'ძვირია',pain:'რეკლამაზე ფული იხარჯება შედეგი არ მოაქვს',process:'თანამშრომლები შემოსულ ლიდებს ამუშავებენ',severity:'material',priority_check:'primary'}))s.facts[f]=fact(f,v);return s;}
test('lost-sale interview requires a case, stage and follow-up before closure',()=>{
 const s=renovation();const required=requiredFields(s);
 for(const f of ['lost_case','loss_stage','follow_up','customer'])assert(required.includes(f));
 assert(!required.includes('baseline'),'do not repeat unknown conversion as another baseline question');
 const next=advanceAudit(s,'არ ვიცი',empty);assert.equal(next.complete,false);assert.equal(next.currentQuestion,'lost_case');
});
test('known service survives generic restatement',()=>{
 const s=renovation();const next=advanceAudit(s,'სერვისს',{...empty,updates:[{field:'business',value:'სერვისს',status:'confirmed',evidence:'სერვისს',correction:false}]});
 assert.equal(next.facts.business.value,'სარემონტო კომპანია');
 assert.equal(next.facts.customer,undefined);
});
test('ad spend mention cannot erase established conversion bottleneck',()=>{
 const s=renovation();delete s.facts.pain;s.currentQuestion='pain';
 const message='რეკლამაზე ფული იხარჯება შედეგი არ მოაქვს';
 const next=advanceAudit(s,message,{...empty,focus:'ads',focusEvidence:message,updates:[{field:'pain',value:message,status:'confirmed',evidence:message,correction:false}]});
 assert.equal(next.focus,'growth');assert.equal(next.facts.bottleneck.value,'conversion');assert(next.facts.loss_reason);
});
test('renovation stage question is contextual, not a repeated metrics request',()=>{
 const s=renovation();s.currentQuestion='loss_stage';assert.match(questionFor(s).content,/ხარჯთაღრიცხვის/);
});
for(const language of ['ka','ru','en'])test('actionable non-AI report despite missing customer/metrics: '+language,()=>{
 const s=renovation();const report=buildFinalBrief(s,language);
 assert.equal(assess(s).product,null);assert.equal(assess(s).verdict,'process_first');
 assert(report.includes('სარემონტო კომპანია'));assert(report.includes('ძვირია'));
 assert.match(report,language==='ka'?/ხარჯთაღრიცხვა/:language==='ru'?/подробную смету/:/detailed estimate/);
 assert.match(report,language==='ka'?/ვარიანტებია და არა დადგენილი/:language==='ru'?/гипотезы, не установленные/:/hypotheses to test, not established/);
 assert.match(report,language==='ka'?/განმეორებითი კონტაქტის შედეგი/:language==='ru'?/результат повторного контакта/:/follow-up outcome/);
});
test('partial business does not erase the specific sales diagnostic plan',()=>{
 const s=renovation();s.facts.business.status='partial';const report=buildFinalBrief(s,'en');
 assert.equal(assess(s).verdict,'insufficient');assert.match(report,/Partial business description/);assert.match(report,/recent lost enquiries/);
 assert.doesNotMatch(report,/Review one actual case: what happened/);
});
test('unknown case and metrics terminate conservatively without loops',()=>{
 let s=renovation();let n=0;while(!s.complete&&n++<24)s=advanceAudit(s,'არ ვიცი',empty);
 assert(s.complete);assert.equal(assess(s).product,null);assert.match(buildFinalBrief(s,'en'),/Leave unknown reasons unknown/);
});
