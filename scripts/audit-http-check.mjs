import assert from 'node:assert/strict';
const base=process.env.AUDIT_TEST_URL || 'http://localhost:3339';
async function post(content,state,extra={}) {
  return fetch(base+'/api/ai-intake',{method:'POST',headers:{'Content-Type':'application/json',...extra},signal:AbortSignal.timeout(65_000),body:JSON.stringify({messages:[{role:'user',content}],intakeState:state})});
}
assert.equal((await post('test',undefined,{Origin:'https://untrusted.invalid'})).status,403);
assert.equal((await post('x'.repeat(3001))).status,400);
assert.equal((await post('password=synthetic-test-only')).status,400);
assert.equal((await post('test',{version:1})).status,409);
const initial=await post('We run a dental clinic. Receptionists answer repetitive booking messages, but patients often wait until the next morning.');
assert.equal(initial.status,200);const a=await initial.json();assert.equal(a.intakeState.language,'en');
const tampered=structuredClone(a.intakeState);tampered.facts={};
assert.equal((await post('anything',tampered)).status,409);
const russian=await post('Наша цель — сократить задержки ответа пациентам, а не заменить врача.',a.intakeState);
assert.equal(russian.status,200);const b=await russian.json();assert.equal(b.intakeState.language,'ru');assert.equal(b.intakeState.turn,2);
assert(b.intakeState.facts.business,'Language switch keeps facts');
assert(b.suggestions.includes('Не знаю'));assert(b.suggestions.includes('Пропустить'));
const unknown=await post('Не знаю',b.intakeState);assert.equal(unknown.status,200);
const c=await unknown.json();assert.equal(c.intakeState.facts[b.intakeState.currentQuestion].status,'unknown');
console.log('HTTP PASS: origin, length, secrets, legacy session, tamper, EN→RU continuity, honest unknown. No lead sent.');
