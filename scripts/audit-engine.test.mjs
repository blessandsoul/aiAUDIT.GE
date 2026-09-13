import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, FIELDS } from '../src/lib/audit-bank.ts';
import { advanceAudit, assess, createIntakeState, exactChoice, focusHint, isIntakeComplete, questionFor, requiredFields } from '../src/lib/audit-engine.ts';
import { buildFinalBrief } from '../src/lib/audit-report.ts';
import { signState, verifyState } from '../src/lib/audit-session.ts';
import { DEEP_FIELDS } from '../src/lib/audit-deep-bank.ts';
import { auditTurnLimit, deepFieldsFor, deepResolved } from '../src/lib/audit-engine.ts';
const empty = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };
test('deep mode has its own signed limit and cannot leak fields into quick', () => {
  const quick = createIntakeState('en');
  const deep = createIntakeState('en', 'deep');
  quick.focus = deep.focus = 'chats';
  assert.equal(auditTurnLimit(quick), 24);
  assert.equal(auditTurnLimit(deep), 40);
  assert(DEEP_FIELDS.every(f => requiredFields(deep).includes(f)));
  assert(DEEP_FIELDS.every(f => !requiredFields(quick).includes(f)));
  const next = advanceAudit(quick, 'The supervisor owns this process.', { ...empty, updates: [{field:'process_owner', value:'supervisor', status:'confirmed', evidence:'The supervisor owns this process.', correction:false}] });
  assert.equal(next.facts.process_owner, undefined);
});
test('missing deep evidence blocks a product and marks readiness limited', () => {
  const s = prepared('chats');
  s.mode = 'deep';
  assert.equal(assess(s).product, null);
  assert.equal(assess(s).readiness, 'limited');
});
function fact(s, field, value, status = 'confirmed') { s.facts[field] = { id: field+':1', field, value, status, quote: `${field}: ${value}`, turn: 1 }; }
function prepared(focus) {
  const s = createIntakeState('en'); s.focus = focus; s.turn = 4;
  for (const field of requiredFields(s)) fact(s, field, BANK[field].options[0]?.value || 'reported operational fact');
  if (focus === 'chats') fact(s, 'baseline', 'current response time is measured');
  fact(s,'severity','material'); fact(s,'repetition','repeatable'); fact(s,'data','ready'); fact(s,'owner','available'); fact(s,'constraints','review'); fact(s,'alternative','insufficient'); fact(s,'priority_check','primary');
  return s;
}
function deepReady() {
  const s=prepared('chats'); s.mode='deep';
  for(const f of DEEP_FIELDS) fact(s,f,'reported process detail');
  fact(s,'permissions','approved');fact(s,'review_capacity','available');
  return s;
}
test('Deep permits a prepared pilot only with actual permission and capacity',()=>{
  assert.equal(assess(deepReady()).verdict,'pilot');
  for(const [field,value] of [['permissions','pending'],['permissions','denied'],['permissions','the director must approve'],['review_capacity','unavailable'],['review_capacity','thirty minutes tomorrow maybe']]) {
    const s=deepReady();fact(s,field,value);
    assert.equal(assess(s).verdict,'prepare',field+value);assert.equal(assess(s).product,null);assert.equal(assess(s).readiness,'limited');
  }
});
test('inapplicable optional facts close gaps without granting permission',()=>{
  const s=deepReady();fact(s,'personal_data','','not_applicable');
  s.facts.personal_data.quote='No personal data is involved.';
  assert(deepResolved(s,'personal_data'));assert.equal(assess(s).verdict,'pilot');
  assert(buildFinalBrief(s,'en').includes('not applicable to this process'));
  fact(s,'permissions','','not_applicable');assert.equal(assess(s).verdict,'prepare');
});
test('measurement and approval paths do not require an entire AI implementation questionnaire',()=>{
  const s=createIntakeState('en','deep');s.focus='ads';fact(s,'tracking','clicks');
  assert.equal(deepFieldsFor(s).length,8);assert(!requiredFields(s).includes('adoption'));
  s.focus='office';fact(s,'office_task','approvals');assert(!requiredFields(s).includes('retention'));
  fact(s,'severity','minor');assert.equal(deepFieldsFor(s).length,0);
});
test('Deep report has ordered check, scope and stop steps with quoted evidence',()=>{
  const s=deepReady();const report=buildFinalBrief(s,'en');
  assert(report.indexOf('Step 1')<report.indexOf('Step 2'));assert(report.indexOf('Step 2')<report.indexOf('Step 3'));
  fact(s,'permissions','pending');assert(buildFinalBrief(s,'en').includes('Do not start an AI pilot yet'));
});
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
  for(const lang of ['ka','ru','en']){const report=buildFinalBrief(s,lang);assert(report.includes('“attribution: none”'));assert(!/\[[a-z_]+:\d+\]/u.test(report));assert(report.includes('ROI'));assert(!/37%|4000|4,000/.test(report));}
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
  const report=buildFinalBrief(s,'ru');assert(report.includes('С чем сравнивать результат: “Вечером 90 обращений, ответ через 11 часов”'));assert(!/\[[a-z_]+:\d+\]/u.test(report));assert(report.includes('Лечение — только врач'));
  assert(!report.includes('до старта измерьте исходный результат'));assert(report.indexOf('С чем сравнивать')<report.indexOf('Основания — ваши слова'));
});

test('neutral all-caps system names keep the current Georgian language',()=>{
  const s=createIntakeState('ka');s.currentQuestion='data';
  const next=advanceAudit(s,'GOOGLE SHEETS',empty);
  assert.equal(next.language,'ka');
  const q=questionFor({...next,currentQuestion:'data',asked:{...next.asked,data:1},facts:{...next.facts,systems:{id:'systems:1',field:'systems',value:'Google Sheets',status:'confirmed',quote:'GOOGLE SHEETS',turn:1}}});
  assert.match(q.content,/არის|ხელმისაწვდომია/u);assert.doesNotMatch(q.content,/You said|Are real examples/u);
});

test('explicit social autoresponder request routes to Chats even if the model chose a generic route',()=>{
  const message='ვყიდი ტანსაცმელს და მინდა ავტომოპასუხე სოც ქსელებში';
  const s=advanceAudit(createIntakeState('ka'),message,{...empty,focus:'operations',focusEvidence:message});
  assert.equal(s.focus,'chats');
});

test('repeated Chats workflow clarification confirms where the tracking-code error happened',()=>{
  const s=createIntakeState('ka');s.focus='chats';s.currentQuestion='process';s.asked.process=2;
  s.facts.pain={id:'pain:3',field:'pain',value:'tracking code sent incorrectly',status:'confirmed',quote:'არასწორი თრექინგ კოდი მივწერე მომხმარებელს',turn:3};
  s.facts.impact={id:'impact:4',field:'impact',value:'operator salary 700 GEL',status:'confirmed',quote:'ოპერატორი მყავს რომელსაც 700 ლარს ვუხდი',turn:4};
  const q=questionFor(s);
  assert.match(q.content,/თქვენ ახსენეთ.*თრექინგ/u);assert.match(q.content,/სოციალურ ქსელში პასუხისას მოხდა/u);
  assert.doesNotMatch(q.content,/You said|tracking code|\[pain:/iu);
});

test('a non-tracking code never invents a tracking-code follow-up',()=>{
  const s=createIntakeState('ka');s.focus='chats';s.currentQuestion='process';s.asked.process=2;
  s.facts.pain={id:'pain:3',field:'pain',value:'promo code confusion',status:'confirmed',quote:'ფასდაკლების კოდი ავურიეთ',turn:3};
  const q=questionFor(s);
  assert.doesNotMatch(q.content,/თრექინგ|ტრექინგ/u);assert.match(q.content,/შეტყობინების მიღებიდან პასუხის გაგზავნამდე/u);
});

test('a routine tracking-code workflow never becomes an incorrect-code incident',()=>{
  const s=createIntakeState('ka');s.focus='chats';s.currentQuestion='process';s.asked.process=2;
  s.facts.pain={id:'pain:3',field:'pain',value:'tracking lookup delays replies',status:'confirmed',quote:'თრექინგ კოდს შეკვეთიდან ვაკოპირებთ და პასუხი გვიანდება',turn:3};
  const q=questionFor(s);
  assert.doesNotMatch(q.content,/არასწორად გაგზავნილი თრექინგ/u);assert.match(q.content,/შეტყობინების მიღებიდან პასუხის გაგზავნამდე/u);
  const preparedState=createIntakeState('ka');preparedState.focus='chats';preparedState.focusQuote='მინდა ავტომოპასუხე სოციალურ ქსელში';preparedState.complete=true;
  const reported=(field,value,quote,status='confirmed')=>{preparedState.facts[field]={id:`${field}:2`,field,value,status,quote,turn:2};};
  reported('business','clothing store','ვყიდი ტანსაცმელს');reported('objective','social autoresponder','მინდა ავტომოპასუხე სოციალურ ქსელში');reported('pain','tracking lookup delays replies','თრექინგ კოდს შეკვეთიდან ვაკოპირებთ და პასუხი გვიანდება');reported('response','delays','პასუხი გვიანდება');reported('repetition','repeatable','უმეტესად მსგავსი შემთხვევაა');reported('process','','არ ვიცი','unknown');reported('scale','40 hours per week','კვირაში 40 საათი');reported('impact','','არ ვიცი','unknown');reported('severity','material','რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას');reported('systems','inbox','Instagram inbox');reported('data','ready','კი, შეგვიძლია მოვამზადოთ');reported('alternative','insufficient','ვცადეთ, მაგრამ პრობლემა დარჩა');reported('owner','available','პასუხისმგებელი ადამიანი გვყავს');reported('constraints','review','შედეგს ადამიანი დაამტკიცებს');reported('priority_check','primary','ეს არის მთავარი პრიორიტეტი');
  const report=buildFinalBrief(preparedState,'ka');assert.doesNotMatch(report,/არასწორი თრექინგ-კოდის შემთხვევები|კოდის სანდო წყარო/u);
});

test('clothing social-autoresponder scenario produces a bounded Chats preparation report',()=>{
  const s=createIntakeState('ka');s.focus='chats';s.turn=16;s.complete=true;s.stopReason='enough';
  s.focusQuote='ვყიდი ტანსაცმელს და მინდა ავტომოპასუხე სოც ქსელებში';
  const reported=(field,value,quote,status='confirmed')=>{s.facts[field]={id:`${field}:7`,field,value,status,quote,turn:7};};
  reported('business','clothing store','ვყიდი ტანსაცმელს');
  reported('objective','social autoresponder','მინდა ავტომოპასუხე სოც ქსელებში');
  reported('pain','tracking-code error','არასწორი თრექინგ კოდი მივწერე მომხმარებელს');
  reported('response','delays','პასუხი გვიანდება');
  reported('repetition','repeatable','უმეტესად მსგავსი შემთხვევაა');
  reported('process','','არ ვიცი','unknown');s.asked.process=2;
  reported('scale','40 hours per week','კვირაში 40 საათი');
  reported('impact','operator paid 700 GEL','ოპერატორი მყავს რომელსაც 700 ლარს ვუხდი');
  reported('severity','material','რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას');
  reported('systems','Google Sheets','GOOGLE SHEETS');
  reported('data','ready','Yes, we can prepare them');
  reported('alternative','insufficient','ვცადე, მაგრამ არ გამოვიდა');
  reported('owner','available','პასუხისმგებელი ადამიანი გვყავს');
  reported('constraints','review','შედეგს ადამიანი დაამტკიცებს');
  reported('priority_check','primary','ეს არის მთავარი პრიორიტეტი');
  s.facts.baseline={id:'baseline:7',field:'baseline',value:'',status:'unknown',quote:'არ ვიცი',turn:7};
  const a=assess(s);assert.equal(a.verdict,'prepare');assert.equal(a.product,'aiCHATS');assert.equal(a.opportunity,'supported');assert.equal(a.readiness,'limited');
  const report=buildFinalBrief(s,'ka');
  assert.match(report,/aiCHATS.*ჯერ არ დაიწყოთ პილოტი ან ავტომატური გაგზავნა/u);
  assert.match(report,/ჯერ არ ჩართოთ ავტომატური გაგზავნა/u);
  assert.match(report,/საწყისი პასუხის დრო/u);assert.match(report,/არასწორი თრექინგ-კოდის შემთხვევები/u);
  assert.match(report,/საწყისი მაჩვენებლები/u);assert.match(report,/ანაზღაურება ხარჯის კონტექსტია და არა დადასტურებული დანაკარგი/u);
  assert.doesNotMatch(report,/გაყიდვები გაორმაგ|დაზოგავთ 700|\[[a-z_]+:\d+\]/u);
});

test('fully evidenced social-autoresponder case can advance from preparation to a Chats pilot',()=>{
  const s=prepared('chats');s.focusQuote='We need an auto responder on Instagram social media.';
  fact(s,'response','delays');fact(s,'repetition','repeatable');fact(s,'process','Messages are checked, product details are verified, then a reply is sent.');
  fact(s,'impact','Two hours of operator time are lost each day.');fact(s,'baseline','Median first reply is 45 minutes.');
  assert.equal(assess(s).verdict,'pilot');assert.equal(assess(s).product,'aiCHATS');
});

test('FAQ-only Chats preparation does not invent tracking or salary context',()=>{
  const s=createIntakeState('ka');s.focus='chats';s.focusQuote='მინდა ავტომოპასუხე სოციალურ ქსელში';s.complete=true;
  const reported=(field,value,quote,status='confirmed')=>{s.facts[field]={id:`${field}:2`,field,value,status,quote,turn:2};};
  reported('business','clothing store','ვყიდი ტანსაცმელს');reported('objective','social autoresponder','მინდა ავტომოპასუხე სოციალურ ქსელში');
  reported('pain','delayed answers','ხშირად გვიან ვპასუხობთ კითხვებს');reported('response','delays','პასუხი გვიანდება');reported('repetition','repeatable','უმეტესად მსგავსი შემთხვევაა');
  reported('process','','არ ვიცი','unknown');reported('scale','40 hours per week','კვირაში 40 საათი');reported('impact','','არ ვიცი','unknown');reported('severity','material','რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას');
  reported('systems','inbox','Instagram inbox');reported('data','ready','კი, შეგვიძლია მოვამზადოთ');reported('alternative','insufficient','ვცადეთ, მაგრამ პრობლემა დარჩა');reported('owner','available','პასუხისმგებელი ადამიანი გვყავს');reported('constraints','review','შედეგს ადამიანი დაამტკიცებს');reported('priority_check','primary','ეს არის მთავარი პრიორიტეტი');
  const report=buildFinalBrief(s,'ka');assert.equal(assess(s).product,'aiCHATS');assert.doesNotMatch(report,/თრექინგ|ტრექინგ|ანაზღაურება/u);assert.match(report,/ჯერ არ ჩართოთ ავტომატური გაგზავნა/u);
});
