// Continue manually started conversations using the same synthetic customer's
// previously supplied natural answers, selected by the actual next question.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.AUDIT_TEST_URL || 'http://localhost:3340';
const dir=path.join(process.env.TEMP,'aiaudit-review-20260905');
const name=process.argv[2], prefix=process.env.AUDIT_REVIEW_PREFIX || 'fix-';
const original=JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
const file=path.join(dir,prefix+name+'.json');
const log=JSON.parse(fs.readFileSync(file,'utf8'));
const answers={};
for(let i=1;i<original.length;i++) answers[original[i-1].response.intakeState.currentQuestion]=original[i].message;
Object.assign(answers,name==='shop'?{
  acquisition:'მხოლოდ Instagram-ზე პოსტებს ვდებ, რეკლამაში ფულს არ ვხარჯავ.',
  conversion:'კვირაში დაახლოებით 50 მომართვიდან 10 ჩანთა იყიდება.',
  pain:'ბოლო თვეში რამდენიმე ჩანთა გაუყიდავი დამრჩა, ახალი მომხმარებელი ცოტაა.',
  priority_check:'ახლა ყველაზე მნიშვნელოვანია, რომ მეტმა ადამიანმა ნახოს ჩვენი ჩანთები.',
}:name==='vague'?{
  area:'Пока кажется, что главная трудность — привлечение клиентов. Документы обрабатываем без задержек.',
  objective:'Наверное, освободить время консультантов, но приоритет — стабильный поток клиентов.',
  impact:'Не знаю, потери не считали.',
  acquisition:'Клиенты в основном приходят по знакомству, месяц густо, месяц пусто.',
  systems:'Переписка по email, предложения в документах. CRM пока нет.',
  baseline:'Не знаю, измерений пока нет.',
}:{});
let injected=false;
for(let i=0;i<26;i++){
  const state=log.at(-1).response.intakeState;
  if(state.complete) break;
  const weather=name==='vague'&&state.currentQuestion==='impact'&&!injected;
  const message=weather?'А какая завтра погода в Тбилиси?':answers[state.currentQuestion];
  assert(message,`Missing natural answer: ${name}/${state.currentQuestion}`);
  const response=await fetch(base+'/api/ai-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:message}],intakeState:state}),signal:AbortSignal.timeout(60000)});
  const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));
  log.push({message,response:body});fs.writeFileSync(file,JSON.stringify(log,null,2));
  console.log(JSON.stringify({case:name,turn:log.length,question:body.content.split('\n')[0],field:body.intakeState.currentQuestion,focus:body.intakeState.focus}));
  if(weather){assert.equal(body.intakeState.facts.impact,undefined);assert.equal(body.intakeState.currentQuestion,'impact');injected=true;}
  if(name==='shop') assert.equal(body.intakeState.focus,'growth');
}
const final=log.at(-1).response;assert(final.intakeState.complete);
assert(!final.content.includes('погода'));assert(!final.content.includes('мы их не спрашивали'));
if(name==='clinic'){assert.equal(final.assessment.product,'aiCHATS');assert(final.content.includes('11 часов'));assert(final.content.includes('только врач'));assert(!final.content.includes('до старта измерьте исходный результат'));}
if(name==='shop'){assert.equal(final.assessment.product,null);assert(!final.content.includes('დასრულებული ზარი'));assert(final.content.includes('ნახვა'));}
if(name==='vague') assert.equal(final.assessment.product,null);
console.log(JSON.stringify({case:name,result:'PASS',turns:log.length,assessment:final.assessment,report:final.content}));
