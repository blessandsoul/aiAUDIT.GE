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
const auditPageUrl=page.url();
await page.locator('[data-aiaudit-chat-ready="true"] textarea.heroTextarea').waitFor({state:'visible',timeout:15000});
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
  else {
    const textarea=page.locator('textarea.heroTextarea');
    await textarea.fill(text);
    await page.waitForFunction(()=>!(document.querySelector('button.heroSendBtn') instanceof HTMLButtonElement) || !document.querySelector('button.heroSendBtn').disabled,{timeout:5000});
    await page.locator('button.heroSendBtn').click();
  }
  const response=await waiting;assert.equal(response.status(),200);last=await response.json();
  assert.equal(last.intakeState.focus,'attribution','An explicit influencer source problem must stay in measurement diagnosis');
  if (/^aiAUDIT\s*·\s*(?:Quick|Deep)/i.test(last.content)) {
    await page.locator('.heroAuditReport').waitFor({timeout:15000});
  } else {
    await page.getByText(last.content,{exact:true}).waitFor({timeout:15000});
  }
  if (i === 0) {
    await page.locator('.heroFullscreenChatMode').waitFor({timeout:5000});
    const locked = await page.evaluate(() => ({ bodyPosition: document.body.style.position, scrollY: window.scrollY }));
    assert.equal(locked.bodyPosition, 'fixed', 'Chat locks the landing page body');
    await page.mouse.move(720, 500);
    await page.mouse.wheel(0, 700);
    const afterWheel = await page.evaluate(() => window.scrollY);
    assert.equal(afterWheel, locked.scrollY, 'Wheel does not scroll the landing page behind chat');
    await page.goBack();
    await page.locator('.heroFullscreenChatMode').waitFor({state:'detached',timeout:5000});
    assert.equal(page.url(),auditPageUrl,'Browser Back closes chat without leaving the audit page');
    await page.getByRole('button',{name:'ჩატის გაგრძელება',exact:true}).click();
    await page.locator('.heroFullscreenChatMode').waitFor({timeout:5000});
  }
  const labels=await page.locator('.heroConversationSuggestions button').allTextContents();
  assert.deepEqual(labels,last.suggestions);
  assert.equal(await page.locator('.heroFullscreenChatMode[role="dialog"]').count(),1,'Fullscreen chat dialog remains mounted during interview');
  assert.equal(await page.locator('.aiIntakeLeadDialog:visible').count(),0,'No contact gate during interview');
  console.log(JSON.stringify({browserTurn:i+1,question:last.intakeState.currentQuestion,choices:labels}));
  text=answers[last.intakeState.currentQuestion] || 'არ ვიცი';
}
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/audit-check/mobile.png',fullPage:false});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile horizontal overflow');
assert.equal(await page.evaluate(()=>document.body.style.position),'fixed','Mobile chat keeps the landing page locked');
const mobileScrollBefore=await page.evaluate(()=>window.scrollY); await page.mouse.move(195,400); await page.mouse.wheel(0,500); assert.equal(await page.evaluate(()=>window.scrollY),mobileScrollBefore,'Mobile wheel stays in chat');
const waiting=page.waitForResponse(r=>r.url().endsWith('/api/ai-intake')&&r.request().method()==='POST');
const finishButton=page.locator('.heroFullscreenChatMode').getByRole('button',{name:'დასკვნა არსებული ინფორმაციით',exact:true});
assert.equal(await finishButton.count(),1,'Finish action is inside fullscreen chat');
await finishButton.click();
const finished=await(await waiting).json();assert(finished.intakeState.complete);assert.equal(finished.intakeState.stopReason,'limited');
await page.locator('.heroAuditReport').waitFor({timeout:15000});
assert(await page.getByText('დასკვნა',{exact:true}).count(),'Report summary includes the conclusion section');
assert.equal(await page.locator('.heroConversationTrace').count(),0,'Per-turn AI trace is not shown in normal chat');
const reportSurface=page.locator('.heroFullscreenChatMode');
const summaryHeadings=await reportSurface.locator('.heroAuditSummaryCard > span').allTextContents();
assert(summaryHeadings.length>=3,'Report renders conclusion, next step and measurement summary cards');
assert(summaryHeadings.some((heading)=>/მოკლე დასკვნა|დასკვნა|Краткий вывод|Вывод|Brief conclusion|Conclusion/.test(heading)),'Report exposes a localized conclusion heading');
assert(summaryHeadings.some((heading)=>/შემდეგი ნაბიჯი|Следующий шаг|Next step/.test(heading)),'Report exposes a localized next-step heading');
assert(summaryHeadings.some((heading)=>/გავზომ|измер|measure/i.test(heading)),'Report exposes a localized measurement heading');
assert.equal(await reportSurface.getByRole('button',{name:'შედეგების განხილვა',exact:true}).count(),1,'Lead action is inside fullscreen chat');
assert.equal(await reportSurface.getByRole('button',{name:'ანგარიშის ჩამოტვირთვა',exact:true}).count(),1,'Download action is inside fullscreen chat');
assert.equal(await reportSurface.getByRole('button',{name:'PDF / ბეჭდვა',exact:true}).count(),1,'PDF action is inside fullscreen chat');
const downloadPromise=page.waitForEvent('download');
await reportSurface.getByRole('button',{name:'ანგარიშის ჩამოტვირთვა',exact:true}).click();
assert.equal((await downloadPromise).suggestedFilename(),'aiAUDIT-report.txt');
for (const width of [390,320]) {
  await page.setViewportSize({width,height:844});
  for (const name of ['შედეგების განხილვა','ანგარიშის ჩამოტვირთვა','PDF / ბეჭდვა']) {
    const box=await reportSurface.getByRole('button',{name,exact:true}).boundingBox();
    assert(box && box.x>=0 && box.x+box.width<=width+1,`Action ${name} is reachable at ${width}px`);
  }
}
const reportScrollY=await page.evaluate(()=>window.scrollY);
await reportSurface.getByRole('button',{name:'ჩატიდან დაბრუნება',exact:true}).click();
await page.locator('.heroFullscreenChatMode').waitFor({state:'detached',timeout:5000});
assert.equal(await page.evaluate(()=>window.scrollY),reportScrollY,'Leaving chat restores page position');
await page.getByRole('button',{name:'ჩატის გაგრძელება',exact:true}).click();
await page.locator('.heroFullscreenChatMode').waitFor({timeout:5000});
assert.equal(await page.locator('.heroFullscreenChatMode[role="dialog"]').count(),1,'Chat dialog remains after resume');
assert.equal(await page.locator('.aiIntakeLeadDialog:visible').count(),0,'Report is available before contact');
await page.setViewportSize({width:1440,height:1050});
await page.screenshot({path:'artifacts/audit-check/report.png',fullPage:false});
await context.addInitScript(()=>{window.print=()=>{};});
const popupPromise=page.waitForEvent('popup');await page.locator('.heroFullscreenChatMode').getByRole('button',{name:'PDF / ბეჭდვა',exact:true}).click();
const printable=await popupPromise;
await printable.locator('pre').waitFor();assert((await printable.locator('pre').innerText()).includes('aiAUDIT'));
await printable.pdf({path:'artifacts/audit-check/report.pdf',format:'A4'});await printable.close();
await page.locator('.heroFullscreenChatMode').getByRole('button',{name:'შედეგების განხილვა',exact:true}).click();
const contactDialog=page.locator('.aiIntakeLeadDialog');
await contactDialog.waitFor();assert.equal(await contactDialog.getByRole('checkbox').isChecked(),false);
const shoePage=await context.newPage();
await shoePage.setViewportSize({width:390,height:844});
await shoePage.goto(base+'/ka',{waitUntil:'domcontentloaded'});
await shoePage.locator('[data-aiaudit-chat-ready="true"] textarea.heroTextarea').waitFor({timeout:15000});
const shoeAnswers={
  business:'მაქვს ფეხსაცმლის მაღაზია', objective:'არ ვიცი', area:'მომხმარებლის მოზიდვა და გაყიდვები',
  bottleneck:'ნახვა არის, მომართვა ცოტაა', acquisition:'პოსტებითა და რეკომენდაციებით',
  pain:'არ ვიცი', severity:'მცირე უხერხულობაა, ვუმკლავდებით', priority_check:'ეს არის მთავარი პრიორიტეტი',
};
let shoeField='business';let shoeResult;
for(let turn=0;turn<9;turn++){
  const answer=shoeAnswers[shoeField] || 'არ ვიცი';
  const waiting=shoePage.waitForResponse(r=>r.url().endsWith('/api/ai-intake')&&r.request().method()==='POST',{timeout:65000});
  await shoePage.locator('textarea.heroTextarea').fill(answer);
  await shoePage.locator('button.heroSendBtn').click();
  const response=await waiting;assert.equal(response.status(),200);
  shoeResult=await response.json();
  if(shoeResult.intakeState.complete)break;
  shoeField=shoeResult.intakeState.currentQuestion;
}
assert(shoeResult?.intakeState.complete,'Shoe-store audit completes');
assert(shoeResult.intakeState.turn<=9,'Minor shoe-store audit avoids a long interrogation');
assert.equal(shoeResult.assessment.verdict,'not_now');
await shoePage.locator('.heroAuditReportSummary .heroAuditSummaryCard').first().waitFor({timeout:15000});
assert.equal(await shoePage.locator('.heroAuditSummaryCard').count(),3,'Conclusion, action and metric are immediately visible');
assert.equal(await shoePage.locator('.heroAuditReportDetails').getAttribute('open'),null,'Technical detail starts collapsed');
await shoePage.screenshot({path:'artifacts/audit-check/mobile-shoe-report.png',fullPage:false});
assert.equal(await shoePage.evaluate(()=>document.body.style.position),'fixed','Shoe report stays fullscreen on mobile');
assert.deepEqual(errors,[]);
console.log(`Browser PASS: fullscreen/mobile, report actions, PDF and shoe-store audit in ${shoeResult.intakeState.turn} turns. No lead sent.`);
await browser.close();
