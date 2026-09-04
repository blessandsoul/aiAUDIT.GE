import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.AUDIT_PLAYWRIGHT);
const base=process.env.AUDIT_TEST_URL || 'http://localhost:3339';
await mkdir('artifacts/audit-check',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base+'/ka',{waitUntil:'domcontentloaded'});
const answers={
  business:'ვყიდით სპორტულ ტანსაცმელს ონლაინ, კერძო მომხმარებლებზე.', objective:'გვსურს თითოეული ინფლუენსერის შედეგის გაზომვა.',
  attribution:'წყაროს არ ვაფიქსირებთ',reporting_gap:'შეკვეთას წყარო არ ახლავს',reporting_decision:'პარტნიორის შერჩევა ან შეცვლა',
  process:'მენეჯერი ხელით ამოწმებს გაყიდვებს და Excel-ში ამზადებს ანგარიშს.',scale:'თვეში 5-10 ინფლუენსერთან ვთანამშრომლობთ.',
  impact:'კვირაში 6 საათს ვკარგავთ ანგარიშის მომზადებაზე.',severity:'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას',
};
let text='ვყიდით სპორტულ ტანსაცმელს ონლაინ. გვინდა ინფლუენსერების შედეგის გაზომვა. რთულია გავიგოთ, რომელი შეკვეთა რომელი ინფლუენსერისგან მოდის.';
let last;
for(let i=0;i<5;i++){
  const waiting=page.waitForResponse(r=>r.url().endsWith('/api/ai-intake')&&r.request().method()==='POST',{timeout:65000});
  const button=page.getByRole('button',{name:text,exact:true});
  if(await button.count()) await button.click();
  else {await page.locator('textarea.heroTextarea').fill(text); await page.locator('button.heroSendBtn').click();}
  const response=await waiting;assert.equal(response.status(),200);last=await response.json();
  await page.getByText(last.content,{exact:true}).waitFor({timeout:15000});
  const labels=await page.locator('.heroConversationSuggestions button').allTextContents();
  assert.deepEqual(labels,last.suggestions);
  assert.equal(await page.getByRole('dialog').count(),0,'No contact gate during interview');
  console.log(JSON.stringify({browserTurn:i+1,question:last.intakeState.currentQuestion,choices:labels}));
  text=answers[last.intakeState.currentQuestion] || 'არ ვიცი';
}
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/audit-check/mobile.png',fullPage:false});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile horizontal overflow');
const waiting=page.waitForResponse(r=>r.url().endsWith('/api/ai-intake')&&r.request().method()==='POST');
await page.getByRole('button',{name:'დასკვნა არსებული ინფორმაციით',exact:true}).click();
const finished=await(await waiting).json();assert(finished.intakeState.complete);assert.equal(finished.intakeState.stopReason,'limited');
await page.getByText(finished.content,{exact:true}).waitFor({timeout:15000});
assert.equal(await page.getByRole('dialog').count(),0,'Report must be available before contact');
await page.setViewportSize({width:1440,height:1050});
await page.screenshot({path:'artifacts/audit-check/report.png',fullPage:false});
await context.addInitScript(()=>{window.print=()=>{};});
const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'PDF / ბეჭდვა',exact:true}).click();
const printable=await popupPromise;
await printable.locator('pre').waitFor();assert((await printable.locator('pre').innerText()).includes('aiAUDIT'));
await printable.pdf({path:'artifacts/audit-check/report.pdf',format:'A4'});await printable.close();
await page.getByRole('button',{name:'შედეგების განხილვა',exact:true}).click();
await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('checkbox').isChecked(),false);
assert.deepEqual(errors,[]);
console.log('Browser PASS: actual answer chips, mobile, early limited report, PDF, optional consent dialog. No lead sent.');
await browser.close();
