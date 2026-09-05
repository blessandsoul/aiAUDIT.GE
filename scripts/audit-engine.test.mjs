import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, FIELDS } from '../src/lib/audit-bank.ts';
import { advanceAudit, assess, createIntakeState, exactChoice, focusHint, isIntakeComplete, questionFor, requiredFields } from '../src/lib/audit-engine.ts';
import { buildFinalBrief } from '../src/lib/audit-report.ts';
import { signState, verifyState } from '../src/lib/audit-session.ts';
const empty = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };
function fact(s, field, value, status = 'confirmed') { s.facts[field] = { id: field+':1', field, value, status, quote: `${field}: ${value}`, turn: 1 }; }
function prepared(focus) {
  const s = createIntakeState('en'); s.focus = focus; s.turn = 4;
  for (const field of requiredFields(s)) fact(s, field, BANK[field].options[0]?.value || 'reported operational fact');
  fact(s,'severity','material'); fact(s,'repetition','repeatable'); fact(s,'data','ready'); fact(s,'owner','available'); fact(s,'constraints','review'); fact(s,'alternative','insufficient'); fact(s,'priority_check','primary');
  return s;
}
test('question owns its exact choices across every field and language', () => {
  for (const language of ['ka','ru','en']) for (const field of FIELDS) {
    const s = createIntakeState(language); s.currentQuestion = field;
    const q = questionFor(s);
    assert.equal(q.suggestions.length, BANK[field].options.length + 2);
    for (const option of BANK[field].options) assert.equal(exactChoice(s, option.label[language]).value, option.value);
    assert(!q.suggestions.some((c) => /\d/.test(c)), `invented quantities in ${field}`);
  }
});
test('original ten broad fields cannot finish influencer audit', () => {
  const s = createIntakeState(); s.focus = 'attribution';
  for (const f of ['business','objective','pain','process','scale','systems','owner','baseline']) fact(s,f,'known');
  const next = advanceAudit(s,'მადლობა', empty);
  assert.equal(next.complete,false); assert.equal(next.currentQuestion,'attribution');
});
test('acknowledgement does not accept provider fabricated updates', () => {
  const s = createIntakeState(); s.currentQuestion='constraints';
  const next=advanceAudit(s,'გასაგებია, მადლობა',{...empty,updates:[{field:'constraints',value:'review',status:'confirmed',evidence:'მადლობა',correction:false}]});
  assert.equal(next.facts.constraints,undefined);
});
test('reject invented quotes and wrong enum types', () => {
  const next=advanceAudit(createIntakeState(),'actual words',{...empty,updates:[{field:'attribution',value:'none',status:'confirmed',evidence:'invented',correction:false},{field:'severity',value:'none',status:'confirmed',evidence:'actual words',correction:false},{field:'data',value:'200',status:'confirmed',evidence:'actual words',correction:false}]});
  assert.equal(next.facts.attribution,undefined); assert.equal(next.facts.data,undefined);
});
test('unknown and declined only apply to current question', () => {
  for(const [text,status] of [['არ ვიცი','unknown'],['გამოტოვება','declined']]) {
    const s=createIntakeState();s.currentQuestion='baseline';
    const next=advanceAudit(s,text,empty);assert.equal(next.facts.baseline.status,status);assert.equal(next.facts.data,undefined);
  }
});
test('missing source is measurement first, never AI Ads', () => { const s=prepared('attribution');fact(s,'attribution','none');fact(s,'reporting_gap','missing');assert.equal(assess(s).verdict,'measurement_first');assert.equal(assess(s).product,null); });
test('low growth enquiry volume is not a chat recommendation',()=>{const s=prepared('growth');fact(s,'bottleneck','reach');assert.equal(assess(s).verdict,'process_first');assert.equal(assess(s).product,null);});
test('repetitive delays with impact, data, owner and exhausted alternatives support chats pilot',()=>{const s=prepared('chats');fact(s,'response','delays');assert.equal(assess(s).product,'aiCHATS');});
test('absence of readiness prevents product recommendation but preserves opportunity',()=>{const s=prepared('chats');fact(s,'owner','unavailable');assert.equal(assess(s).verdict,'prepare');assert.equal(assess(s).opportunity,'supported');assert.equal(assess(s).product,null);});
test('minor impact, expert calls, and legal decisions do not yield AI pilots',()=>{
  const s=prepared('chats');fact(s,'severity','minor');assert.equal(assess(s).verdict,'not_now');
  const c=prepared('calls');fact(c,'call_task','expert');assert.equal(assess(c).product,null);
  const d=prepared('docs');fact(d,'docs_task','decision');assert.equal(assess(d).product,null);
});
test('conflicting fact is excluded and a correction resolves it',()=>{
  const s=prepared('chats');s.currentQuestion='data';fact(s,'data','ready');
  const conflict=advanceAudit(s,'We have no data.',{...empty,updates:[{field:'data',value:'absent',status:'confirmed',evidence:'no data',correction:false}]});
  assert.equal(conflict.facts.data.status,'contradicted');assert.equal(assess(conflict).product,null);
  const fixed=advanceAudit(conflict,'Actually, data are absent.',{...empty,updates:[{field:'data',value:'absent',status:'confirmed',evidence:'data are absent',correction:true}]});
  assert.equal(fixed.facts.data.status,'confirmed');assert.equal(fixed.facts.data.value,'absent');
});
test('exhausted audit ends with limited report, not invented completion',()=>{
  const s=createIntakeState();s.turn=23;const next=advanceAudit(s,'არ ვიცი',empty);assert(next.complete);assert.equal(next.stopReason,'limited');assert.equal(assess(next).product,null);assert(isIntakeComplete(next));assert(buildFinalBrief(next,'en').includes('Limited.'));
});
test('all three reports include evidence, next step, metrics and uncertainty',()=>{
  const s=prepared('attribution');fact(s,'attribution','none');
  for(const lang of ['ka','ru','en']){const report=buildFinalBrief(s,lang);assert(report.includes('[attribution:1]'));assert(report.includes('ROI'));assert(!/37%|4000|4,000/.test(report));}
});
test('tampered, expired and unsigned state are rejected',()=>{
  process.env.AUDIT_SESSION_SECRET='test-only-secret-with-at-least-32-characters';
  const s=signState(createIntakeState());assert(verifyState(s));assert(!verifyState({...s,complete:true}));assert(!verifyState(createIntakeState()));assert(!verifyState({...s,proof:'1.'+s.proof.split('.')[1]}));
});

test('two unanswered attempts move on without confirming a fact',()=>{
  let s=createIntakeState();s.focus='attribution';fact(s,'business','online shop');fact(s,'objective','source measurement');
  s.currentQuestion='attribution';s.asked.attribution=2;
  s=advanceAudit(s,'thanks',empty);
  assert.notEqual(s.currentQuestion,'attribution');assert.equal(s.facts.attribution,undefined);assert.equal(assess(s).product,null);
});
test('partial enum value is not retained as an apparent answer',()=>{
  const s=advanceAudit(createIntakeState(),'Excel',{...empty,updates:[{field:'attribution',value:'none',status:'partial',evidence:'Excel',correction:false}]});
  assert.equal(s.facts.attribution.value,'');assert.equal(s.facts.attribution.status,'partial');
});
test('partial business answers stay partial instead of bypassing semantic validation',()=>{
  const s=createIntakeState();s.currentQuestion='business';
  const next=advanceAudit(s,'დისტრიბუციის კომპანია ვართ.',{...empty,updates:[{field:'business',value:'',status:'partial',evidence:'დისტრიბუციის კომპანია ვართ.',correction:false}]});
  assert.equal(next.facts.business.status,'partial');assert.equal(next.facts.business.quote,'დისტრიბუციის კომპანია ვართ.');
});
test('paid advertising without purchase measurement cannot receive an AI pilot',()=>{
  const s=prepared('ads');fact(s,'tracking','none');assert.equal(assess(s).verdict,'measurement_first');assert.equal(assess(s).product,null);
});
test('explicit influencer measurement overrides generic growth routing but invents no facts',()=>{
  for (const text of ['გვინდა ინფლუენსერების შედეგის გაზომვა', 'Не можем посчитать продажи от блогеров', 'We cannot attribute orders to influencers']) {
    const s=advanceAudit(createIntakeState(),text,{...empty,focus:'growth',focusEvidence:text});
    assert.equal(s.focus,'attribution');assert.equal(s.facts.attribution,undefined);assert.equal(assess(s).product,null);
  }
});
test('catalog routing recognizes every audited product domain without treating routing as evidence',()=>{
  const examples = {
    chats: 'გვიან ვპასუხობთ Instagram შეტყობინებებს', calls: 'ზარებით ვადასტურებთ ჩაწერას', ads: 'ფასიან რეკლამას და კამპანიებს ვმართავთ', content: 'კონტენტის შექმნა გვიგვიანდება', docs: 'დოკუმენტიდან მონაცემს ხელით ვწერთ', web: 'საიტზე კლიენტი ვერ ტოვებს მოთხოვნას', office: 'შეკვეთას ხელით გადაგვაქვს Excel-დან სისტემაში', app: 'ახალი აპლიკაციის აშენება გვჭირდება', rescue: 'არსებული AI აპლიკაცია ხშირად ფუჭდება', staff: 'ცოცხალი სპეციალისტი გვჭირდება რთული მოთხოვნებისთვის', fleet: 'ავტონომიური ფლოტის პროექტი გვაინტერესებს',
  };
  for (const [focus, message] of Object.entries(examples)) {
    assert.equal(focusHint(message), focus);
    const s=advanceAudit(createIntakeState(),message,{...empty,focus,focusEvidence:message});assert.equal(s.focus,focus);assert.deepEqual(s.facts,{});
  }
});
test('an explicit first-turn process route beats a generic model operations route',()=>{
  const message='შეკვეთების ინფორმაცია ხელით გადაგვაქვს Excel-დან საწყობის სისტემაში';
  const s=advanceAudit(createIntakeState(),message,{...empty,focus:'operations',focusEvidence:'შეკვეთების ინფორმაცია'});
  assert.equal(s.focus,'office');assert.deepEqual(s.facts,{});
});
test('aiCALL refuses cold-list route while bookings from own customers can reach a pilot',()=>{
  const cold=prepared('calls');fact(cold,'call_task','booking');fact(cold,'call_permission','cold');assert.equal(assess(cold).product,null);
  const own=prepared('calls');fact(own,'call_task','booking');fact(own,'call_permission','existing');assert.equal(assess(own).product,'aiCALL');
});
test('office, bespoke app, repair and live specialist have distinct recommendations',()=>{
  const office=prepared('office');fact(office,'office_task','transfer');assert.equal(assess(office).product,'aiOFFICE');
  const app=prepared('app');fact(app,'app_task','integration');assert.equal(assess(app).verdict,'scoped_discovery');assert.equal(assess(app).product,'aiAPP');
  const rescue=prepared('rescue');fact(rescue,'rescue_task','breaks');assert.equal(assess(rescue).verdict,'technical_assessment');assert.equal(assess(rescue).product,'vibeCODING');
  const staff=prepared('staff');fact(staff,'staff_task','complex');assert.equal(assess(staff).verdict,'human_service');assert.equal(assess(staff).product,'aiSTAFF');
});
test('autonomous fleet is understood but never sold through Quick Audit',()=>{
  const s=prepared('fleet');fact(s,'fleet_task','yes');assert.equal(assess(s).verdict,'not_available');assert.equal(assess(s).product,null);
});
test('explicit unavailable fleet request stays unavailable without invented pain',()=>{
  const s=advanceAudit(createIntakeState('ka'),'ავტონომიური ფლოტის პროექტი გვაინტერესებს',empty);
  assert.equal(s.focus,'fleet'); assert.equal(assess(s).verdict,'not_available');
  assert.equal(assess(s).product,null); assert.equal(s.facts.pain,undefined);
});
test('weather at impact is neither evidence nor progress',()=>{
  const s=prepared('chats');delete s.facts.impact;s.currentQuestion='impact';s.asked.impact=1;
  const next=advanceAudit(s,'А какая завтра погода в Тбилиси?',empty);
  assert.equal(next.facts.impact,undefined);assert.equal(next.currentQuestion,'impact');assert.equal(next.asked.impact,1);
  assert(!buildFinalBrief(next,'ru').includes('погода'));
});
test('repeating the same non-answer twice leaves a gap instead of a question loop',()=>{
  const s=prepared('chats');delete s.facts.impact;s.currentQuestion='impact';s.asked.impact=1;
  const first=advanceAudit(s,'I cannot add anything to that.',empty);
  assert.equal(first.currentQuestion,'impact');
  const second=advanceAudit(first,'I cannot add anything to that.',empty);
  assert.equal(second.facts.impact,undefined);assert.notEqual(second.currentQuestion,'impact');
});
test('natural uncertainty stays unknown and never enters report evidence',()=>{
  const s=prepared('growth');delete s.facts.loss_reason;s.currentQuestion='loss_reason';
  const next=advanceAudit(s,'Не знаю, мы их не спрашивали.',empty);
  assert.equal(next.facts.loss_reason.status,'unknown');assert(!buildFinalBrief(next,'ru').includes('мы их не спрашивали'));
});
test('growth word in Georgian does not create calls and generic mentions remain discovery',()=>{
  const message='Instagram-იდან დღეში 5-10 ადამიანი მწერს. მინდა გაყიდვები გავზარდო.';
  assert.notEqual(focusHint(message),'calls');
  const next=advanceAudit(createIntakeState(),message,{...empty,focus:'growth',focusEvidence:message});assert.equal(next.focus,'growth');
  assert.equal(advanceAudit(createIntakeState(),'Есть продажи, документы и отчёты, не знаем где проблема.',empty).focus,'discovery');
});
test('explicit correction changes process and drops old workload and readiness',()=>{
  const s=prepared('calls');s.currentQuestion='call_permission';
  const msg='ზარები არ გვაქვს. მთავარი პრობლემა დაბალი ნახვებია.';
  const next=advanceAudit(s,msg,{...empty,focus:'growth',focusEvidence:'მთავარი პრობლემა დაბალი ნახვებია',updates:[{field:'bottleneck',value:'reach',status:'confirmed',evidence:'დაბალი ნახვებია',correction:false}]});
  assert.equal(next.focus,'growth');assert.equal(next.facts.scale,undefined);assert.equal(next.facts.owner,undefined);assert(next.facts.business);assert.equal(assess(next).product,null);
  assert(!buildFinalBrief(next,'ru').includes('подтверждением записи'));
});
test('pilot uses client baseline and human boundary before evidence appendix',()=>{
  const s=prepared('chats');fact(s,'response','delays');fact(s,'baseline','90 evening enquiries, 11 hours');fact(s,'constraints','review');
  s.facts.baseline.quote='Вечером 90 обращений, ответ через 11 часов';s.facts.constraints.quote='Лечение — только врач';
  const report=buildFinalBrief(s,'ru');assert(report.includes('С чем сравнивать результат: [baseline:1]'));assert(report.includes('Лечение — только врач'));
  assert(!report.includes('до старта измерьте исходный результат'));assert(report.indexOf('С чем сравнивать')<report.indexOf('Основания — ваши слова'));
});
