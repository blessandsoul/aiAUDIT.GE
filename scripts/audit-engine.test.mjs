import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, FIELDS } from '../src/lib/audit-bank.ts';
import { advanceAudit, assess, createIntakeState, exactChoice, isIntakeComplete, questionFor, requiredFields } from '../src/lib/audit-engine.ts';
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
test('paid advertising without purchase measurement cannot receive an AI pilot',()=>{
  const s=prepared('ads');fact(s,'tracking','none');assert.equal(assess(s).verdict,'measurement_first');assert.equal(assess(s).product,null);
});
test('explicit influencer measurement overrides generic growth routing but invents no facts',()=>{
  for (const text of ['გვინდა ინფლუენსერების შედეგის გაზომვა', 'Не можем посчитать продажи от блогеров', 'We cannot attribute orders to influencers']) {
    const s=advanceAudit(createIntakeState(),text,{...empty,focus:'growth',focusEvidence:text});
    assert.equal(s.focus,'attribution');assert.equal(s.facts.attribution,undefined);assert.equal(assess(s).product,null);
  }
});
