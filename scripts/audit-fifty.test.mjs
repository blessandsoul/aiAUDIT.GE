import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK } from '../src/lib/audit-bank.ts';
import { createIntakeState, requiredFields, assess } from '../src/lib/audit-engine.ts';
import { buildFinalBrief } from '../src/lib/audit-report.ts';

// Expectations declared independently of the execution loop. Structured-state
// tests: not model interviews or independent verification of customer facts.
const products = { chats:'aiCHATS', calls:'aiCALL', ads:'aiADS', content:'aiCONTENT', docs:'aiDOCS', web:'aiWEB', office:'aiOFFICE' };
const variants = [
  ['ready', {}, 'pilot'],
  ['no owner', {owner:'unavailable'}, 'prepare'],
  ['no data', {data:'absent'}, 'prepare'],
  ['high risk', {constraints:'high_risk'}, 'prepare'],
  ['minor impact', {severity:'minor'}, 'not_now'],
  ['conflicting volume', {scale:null}, 'insufficient'],
];
function put(s, field, value, status='confirmed') {
  s.facts[field]={id:`${field}:1`,field,value,status,quote:`Reported ${field}: ${value}`,turn:1};
}
function prepared(focus, changes={}) {
  const s=createIntakeState('en');s.focus=focus;s.turn=8;
  for(const f of requiredFields(s)) put(s,f,BANK[f].options[0]?.value || `Observed ${f} for this business`);
  for(const [f,v] of Object.entries({business:'Business with a repeated operational workflow',severity:'material',repetition:'repeatable',data:'ready',owner:'available',constraints:'review',alternative:'insufficient',priority_check:'primary',...(focus==='ads'?{acquisition:'paid',tracking:'purchases'}:{}),...changes})) {
    if(v===null) {
      put(s,f,'unresolved','contradicted');s.facts[f].previous={value:'old estimate',quote:'Earlier estimate',turn:1};
    } else put(s,f,v);
  }
  return s;
}
function check(s, verdict, product, requiredPattern) {
  const a=assess(s);assert.equal(a.verdict,verdict);assert.equal(a.product,product);
  for(const language of ['en','ru','ka']) {
    const report=buildFinalBrief(s,language);
    assert(report.includes('[business:1]'));
    assert(!/37%|4,000 GEL/.test(report));
    if(requiredPattern && language==='en')assert.match(report,requiredPattern);
    if(verdict==='pilot')assert.match(report,/14/);
    if(verdict==='prepare'&&language==='en')assert.match(report,/Do not start a pilot yet/);
  }
}
for(const [focus,product] of Object.entries(products))for(const [name,changes,verdict] of variants) {
  test(`${focus}: ${name}`,()=>check(prepared(focus,changes),verdict,verdict==='pilot'?product:null));
}
const special = [
  ['approval delay','content',{content_gap:'approval'},'process_first',/assign an approver/],
  ['CSV before AI','office',{office_task:'transfer',alternative:'not_tried'},'process_first',/CSV import/],
  ['final expert decision','docs',{docs_task:'decision'},'process_first',/qualified specialist/],
  ['expert calls','calls',{call_task:'expert'},'process_first',/qualified specialist/],
  ['clicks not purchases','ads',{tracking:'clicks'},'measurement_first',/test order/],
  ['no issue','chats',{severity:'none'},'not_now',/Do not buy/],
  ['approval-only office','office',{office_task:'approvals',repetition:'unique'},'process_first',/approval deadline/],
  ['unrequested cross-domain evidence','chats',{docs_task:'decision'},'pilot',/one channel/],
];
for(const [name,focus,changes,verdict,pattern] of special)test(name,()=>check(prepared(focus,changes),verdict,verdict==='pilot'?products[focus]:null,pattern));
