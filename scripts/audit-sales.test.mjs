import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAudit,assess,createIntakeState,questionFor,requiredFields} from '../src/lib/audit-engine.ts';
import {buildFinalBrief} from '../src/lib/audit-report.ts';
const empty={focus:'discovery',focusEvidence:'',updates:[],nextField:null};
test('explicit expert decision gets a safe boundary before impact is known',()=>{
 const s=createIntakeState('en');s.focus='docs';s.facts.business=fact('business','Engineering');s.facts.docs_task=fact('docs_task','decision');
 assert.equal(assess(s).product,null);assert.match(buildFinalBrief(s,'en'),/qualified specialist/);
});
test('approval plan does not require inventing volume',()=>{
 const s=createIntakeState('en');s.focus='office';
 for(const [f,v] of Object.entries({business:'Supplier',pain:'Director waits ten days',office_task:'approvals'}))s.facts[f]=fact(f,v);
 assert.equal(assess(s).verdict,'process_first');assert.match(buildFinalBrief(s,'en'),/approval deadline/);
});
test('one explicit task can refine a broad area before workflow is known',()=>{
 const message='Make the final professional safety decision.';
 const next=advanceAudit(createIntakeState('en'),message,{...empty,updates:[{field:'docs_task',value:'decision',status:'confirmed',evidence:message,correction:false}]});
 assert.equal(next.focus,'docs');assert.equal(assess(next).product,null);
});
test('phone process beats broad customer communication even with invalid model focus quote',()=>{
 const message='An administrator phones existing customers to confirm bookings. Calls take time.';
 const updates=[['area','chats',message],['process',message,message],['call_task','booking','An administrator phones existing customers to confirm bookings.']].map(([field,value,evidence])=>({field,value,evidence,status:'confirmed',correction:false}));
 const s=advanceAudit(createIntakeState('en'),message,{...empty,focus:'calls',focusEvidence:'The user has phone calls.',updates});
 assert.equal(s.focus,'calls');
});
test('mixed process tasks do not pick an arbitrary first candidate',()=>{
 const message='We write descriptions and extract invoice fields.';
 const updates=[['process',message],['content_gap','production'],['docs_task','extract']].map(([field,value])=>({field,value,evidence:message,status:'confirmed',correction:false}));
 const s=advanceAudit(createIntakeState('en'),message,{...empty,updates});
 assert.equal(s.focus,'discovery');
});
test('generic growth can refine to measured ad workflow when no sales bottleneck was established',()=>{
 const s=createIntakeState('en');s.focus='growth';s.currentQuestion='process';s.facts.pain=fact('pain','Cannot link orders to campaign');
 const message='Marketer compares paid campaign reports and store orders.';
 const next=advanceAudit(s,message,{...empty,updates:[{field:'process',value:message,evidence:message,status:'confirmed',correction:false}]});
 assert.equal(next.focus,'ads');assert.equal(next.facts.process.quote,message);
});
test('catalog description drafting is content rather than operational document drafting',()=>{
 const message='A writer drafts product descriptions for publication.';
 const updates=[['process',message],['docs_task','draft']].map(([field,value])=>({field,value,evidence:message,status:'confirmed',correction:false}));
 assert.equal(advanceAudit(createIntakeState('en'),message,{...empty,focus:'docs',focusEvidence:message,updates}).focus,'content');
});
test('literal PDF document workflow can refine broad operations after fabricated task quote is rejected',()=>{
 const message='A clerk reads PDF documents and copies fields into a spreadsheet.';
 const updates=[{field:'process',value:message,evidence:message,status:'confirmed',correction:false},{field:'docs_task',value:'extract',evidence:'invented text',status:'confirmed',correction:false}];
 const s=advanceAudit(createIntakeState('en'),message,{...empty,updates});
 assert.equal(s.focus,'docs');assert.equal(s.facts.docs_task,undefined);
});
test('known process without volume gets measurement instructions, not a generic discovery reset',()=>{
 const s=createIntakeState('en');s.focus='chats';
 for(const [f,v] of Object.entries({business:'Hotel',pain:'Messages wait overnight',process:'Clerk replies manually',response:'delays'}))s.facts[f]=fact(f,v);
 const report=buildFinalBrief(s,'en');assert.match(report,/without enabling AI/);assert.match(report,/Response time/);assert.doesNotMatch(report,/Review one actual case/);
});
for (const language of ['ka','ru','en']) {
 for (const [focus,field,value,pattern] of [
  ['content','content_gap','approval',/დამმტკიცებელი|согласующего|assign an approver/],
  ['office','office_task','transfer',/CSV/],
  ['docs','docs_task','decision',/კვალიფიციურ სპეციალისტს|квалифицированному специалисту|qualified specialist/],
 ]) test(`specific process plan ${focus} ${language}`,()=>{
  const s=createIntakeState(language); s.focus=focus;
  for(const [f,v] of Object.entries({business:'Example company',pain:'Repeated delay',process:'Copy records for approval',repetition:'unique',[field]:value})) s.facts[f]=fact(f,v);
  assert.equal(assess(s).verdict,'process_first');
  assert.equal(assess(s).product,null);
  const report=buildFinalBrief(s,language);
  assert.match(report,pattern);
  assert.doesNotMatch(report,/Review one actual case:|Разберите один реальный случай:|აირჩიეთ ერთი რეალური შემთხვევა/);
  if(focus==='office')assert.match(report,/თუ აქვს|Если функция доступна|If available/);
  if(focus==='docs')assert.match(report,/კრიტიკული შეცდომისას|При критической ошибке|Stop on a critical error/);
  assert.doesNotMatch(report,/If the cause remains unknown|Если причина пока неизвестна|თუ მიზეზი ჯერ უცნობია/);
 });
}
test('unconfirmed approval does not receive a confirmed approval plan',()=>{
 const s=createIntakeState('en');s.focus='content';
 s.facts.business=fact('business','Example');s.facts.pain=fact('pain','Delay');
 s.facts.content_gap=fact('content_gap','approval','contradicted');
 assert.doesNotMatch(buildFinalBrief(s,'en'),/assign an approver/);
});
test('office approval workflow does not get a CSV plan',()=>{
 const s=createIntakeState('en');s.focus='office';
 for(const [f,v] of Object.entries({business:'Example',pain:'Delay',process:'Manager approves',office_task:'approvals',repetition:'unique'}))s.facts[f]=fact(f,v);
 assert.doesNotMatch(buildFinalBrief(s,'en'),/CSV import/);
});
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
