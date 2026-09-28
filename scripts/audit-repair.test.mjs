import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAudit,assess,createIntakeState,questionFor,requiredFields} from '../src/lib/audit-engine.ts';
import {BANK} from '../src/lib/audit-bank.ts';
import {buildFinalBrief} from '../src/lib/audit-report.ts';
import {hasNamedMerchandiseStore,normalizeBusinessExtraction} from '../src/lib/audit-extractor.ts';
const empty={focus:'discovery',focusEvidence:'',updates:[],nextField:null};
const fact=(field,value)=>({id:field+':1',field,value,quote:value,status:'confirmed',turn:1});
const update=(field,value,correction=false)=>({...empty,updates:[{field,value,status:'confirmed',evidence:value,correction}]});
test('named merchandise stores confirm business without inferring customer details',()=>{
 const blank={focus:'discovery',focusEvidence:'',updates:[],nextField:null};
 assert.equal(hasNamedMerchandiseStore('მაქვს ფეხსაცმლის მაღაზია'),true);
 const specific=normalizeBusinessExtraction(blank,'მაქვს ფეხსაცმლის მაღაზია');
 assert.equal(specific.updates.length,1);assert.equal(specific.updates[0].field,'business');assert.equal(specific.updates[0].status,'confirmed');assert.equal(specific.updates[0].value,'მაქვს ფეხსაცმლის მაღაზია');
 const applied=advanceAudit(createIntakeState('ka'),'მაქვს ფეხსაცმლის მაღაზია',specific);
 assert.equal(applied.facts.business.status,'confirmed');assert.equal(applied.facts.business.value,'მაქვს ფეხსაცმლის მაღაზია');
 const partial={...blank,updates:[{field:'business',value:'generic shop',status:'partial',evidence:'მაქვს მაღაზია',correction:false}]};
 const corrected=normalizeBusinessExtraction(partial,'მაქვს ფეხსაცმლის მაღაზია');
 assert.equal(corrected.updates[0].value,'მაქვს ფეხსაცმლის მაღაზია');
 assert.equal(corrected.updates[0].evidence,'მაქვს ფეხსაცმლის მაღაზია');
 assert.equal(hasNamedMerchandiseStore('მაქვს მაღაზია'),false);
 assert.equal(normalizeBusinessExtraction(blank,'მაქვს მაღაზია').updates.length,0);
 assert.equal(hasNamedMerchandiseStore('I have a shoe store'),true);
 assert.equal(hasNamedMerchandiseStore('У меня магазин обуви'),true);
 for(const message of [
  "I don't have a shoe store",
  'Do you know a shoe store?',
  'I have a shoe and visited a furniture store',
  'არ მაქვს ფეხსაცმლის მაღაზია',
  'ფეხსაცმლის მაღაზია არ მაქვს',
  'მაქვს ფეხსაცმლის\u200b მაღაზია',
 ]) {
  assert.equal(normalizeBusinessExtraction(blank,message).updates.length,0,message);
 }
 const later=createIntakeState('en');later.turn=1;later.currentQuestion='objective';
 assert.equal(normalizeBusinessExtraction(blank,'I have a shoe store',later).updates.length,0);
 const longMessage='I have a shoe store. ' + 'Additional context that is not business evidence. '.repeat(12);
 const providerConfirmed={...blank,updates:[{field:'business',value:'Footwear retailer',status:'confirmed',evidence:'I have a shoe store',correction:false}]};
 assert.equal(normalizeBusinessExtraction(providerConfirmed,longMessage).updates[0].value,'Footwear retailer');
 const bounded=normalizeBusinessExtraction(blank,longMessage).updates[0];
 assert(bounded.value.length<=400);assert(longMessage.includes(bounded.value));assert.equal(bounded.evidence,bounded.value);
});
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
test('minor growth concern stops after one priority check and uses a concise funnel report',()=>{
 let s=createIntakeState('ka');s.focus='growth';s.turn=9;s.currentQuestion='severity';
 for(const [field,value] of Object.entries({
  business:'მაქვს ფეხსაცმლის მაღაზია',
  objective:'მომხმარებლის მოზიდვა და გაყიდვები',
  bottleneck:'enquiries',
  pain:'ნახვა არის, მომართვა ცოტაა',
  acquisition:'პოსტებითა და რეკომენდაციებით',
 })) s.facts[field]=fact(field,value);
 s.facts.bottleneck.quote='ნახვა არის, მომართვა ცოტაა';
 s=advanceAudit(s,'მცირე უხერხულობაა, ვუმკლავდებით',{...empty,updates:[{field:'severity',value:'minor',status:'confirmed',evidence:'მცირე უხერხულობაა, ვუმკლავდებით',correction:false}]});
 assert.equal(s.complete,false);assert.equal(s.currentQuestion,'priority_check');
 s=advanceAudit(s,'ეს არის მთავარი პრიორიტეტი',empty);assert.equal(s.complete,true);assert.equal(s.currentQuestion,null);
 assert.equal(assess(s).verdict,'not_now');
 for(const [language, funnel, period, priority, forbidden] of [
  ['ka','ნახვები → მომართვები → შეძენები','ერთი არხი და შედარებადი ჩვეულებრივი პერიოდები','მთავარი პრიორიტეტი','AI შესაძლებლობა|სანდოობა და ინფორმაციის ნაკლებობა|რა დაგჭირდებათ'],
  ['ru','просмотры → обращения → покупки','один канал и сопоставимые обычные периоды','главный приоритет','Возможность AI|Уверенность и пробелы|Что потребуется'],
  ['en','views → enquiries → purchases','one channel and equivalent typical periods','main priority','AI opportunity|Confidence and gaps|Requirements'],
 ]) {
  const report=buildFinalBrief(s,language);
  assert.match(report,new RegExp(funnel));assert.match(report,new RegExp(period));assert.match(report,new RegExp(priority));assert.doesNotMatch(report,new RegExp(forbidden));assert.doesNotMatch(report,/ROI/u);
  assert.match(report,/ნახვა არის, მომართვა ცოტაა/u);
 }
 const report=buildFinalBrief(s,'ka');
 assert.doesNotMatch(report,/რომელი შედეგის გაუმჯობესებაა|ბოლოს რა მოხდა ამ პროცესში|დაახლოებით რა მოცულობის სამუშაოა/u);
});
test('minor severity with another priority redirects once before diagnosing the other area',()=>{
 let s=createIntakeState('en');s.focus='growth';s.turn=9;s.currentQuestion='severity';
 for(const [field,value] of Object.entries({business:'Shoe store',objective:'Acquire customers',bottleneck:'enquiries'}))s.facts[field]=fact(field,value);
 s=advanceAudit(s,'A minor inconvenience we can manage',{...empty,updates:[{field:'severity',value:'minor',status:'confirmed',evidence:'A minor inconvenience we can manage',correction:false}]});
 assert.equal(s.currentQuestion,'priority_check');
 s=advanceAudit(s,'Another process matters more',empty);assert.equal(s.complete,false);assert.equal(s.currentQuestion,'area');
 s=advanceAudit(s,'Customer communication',{...empty,updates:[{field:'area',value:'chats',status:'confirmed',evidence:'Customer communication',correction:false}]});
 assert.equal(s.focus,'chats');assert.equal(s.complete,false);assert.equal(s.facts.severity,undefined);assert.notEqual(s.currentQuestion,'area');
});
test('minor severity can stop after an unknown or declined priority check',()=>{
 for(const [message,status] of [['I don’t know','unknown'],['Skip','declined']]) {
  let s=createIntakeState('en');s.focus='growth';s.turn=9;s.currentQuestion='priority_check';
  for(const [field,value] of Object.entries({business:'Shoe store',objective:'Acquire customers',severity:'minor'}))s.facts[field]=fact(field,value);
  s=advanceAudit(s,message,empty);assert.equal(s.complete,true);assert.equal(s.currentQuestion,null);assert.equal(s.facts.priority_check.status,status);
 }
});
test('other growth not-now verdicts keep the generic fact-specific report',()=>{
 for(const [severity,bottleneck] of [['none','enquiries'],['minor','conversion']]) {
  const s=createIntakeState('ka');s.focus='growth';s.complete=true;s.turn=4;
  for(const [field,value] of Object.entries({business:'მაქვს ფეხსაცმლის მაღაზია',objective:'გაყიდვები',severity,bottleneck}))s.facts[field]=fact(field,value);
  const report=buildFinalBrief(s,'ka');
  assert.equal(assess(s).verdict,'not_now');
  assert.doesNotMatch(report,/მცირე უხერხულობას|ნახვები → მომართვები → შეძენები/u);
  assert.match(report,/AI შესაძლებლობა/u);
 }
});
test('quick growth reach/enquiry flow gates severity before conversion and stops minor cases early',()=>{
 const start=()=>{
  const s=createIntakeState('ka');s.focus='growth';s.turn=3;s.currentQuestion='bottleneck';
  s.facts.business=fact('business','მაქვს ფეხსაცმლის მაღაზია');
  s.facts.objective=fact('objective','მომხმარებლის მოზიდვა და გაყიდვები');
  return s;
 };
 let s=start();
 s=advanceAudit(s,'ნახვა არის, მომართვა ცოტაა',{...empty,updates:[{field:'bottleneck',value:'enquiries',status:'confirmed',evidence:'ნახვა არის, მომართვა ცოტაა',correction:false}]});
 assert.equal(s.currentQuestion,'acquisition');
 s=advanceAudit(s,'არ ვიცი',empty);assert.equal(s.currentQuestion,'severity');
 s=advanceAudit(s,'მცირე უხერხულობაა, ვუმკლავდებით',empty);assert.equal(s.currentQuestion,'priority_check');
 s=advanceAudit(s,'ეს არის მთავარი პრიორიტეტი',empty);assert.equal(s.complete,true);assert.equal(s.turn,7);
 const material=start();
 let m=advanceAudit(material,'ნახვა არის, მომართვა ცოტაა',{...empty,updates:[{field:'bottleneck',value:'enquiries',status:'confirmed',evidence:'ნახვა არის, მომართვა ცოტაა',correction:false}]});
 m=advanceAudit(m,'არ ვიცი',empty);m=advanceAudit(m,'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას',empty);
 assert.equal(m.complete,false);assert.equal(m.currentQuestion,'pain');
});
test('material growth concern keeps the diagnostic path',()=>{
 let s=createIntakeState('en');s.focus='growth';s.turn=9;s.currentQuestion='severity';
 for(const [field,value] of Object.entries({business:'Shoe store',objective:'Acquire customers',bottleneck:'enquiries'}))s.facts[field]=fact(field,value);
 s=advanceAudit(s,'We regularly lose time or opportunities',{...empty,updates:[{field:'severity',value:'material',status:'confirmed',evidence:'We regularly lose time or opportunities',correction:false}]});
 assert.equal(s.complete,false);assert.notEqual(s.currentQuestion,'priority_check');
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
