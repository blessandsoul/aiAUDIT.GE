// Synthetic QA only. Never send lead/contact requests or start a scrape.
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.AUDIT_TEST_URL||'http://localhost:3350';
const root='artifacts/audit-check/sales-'+Date.now();await mkdir(root,{recursive:true});
const original={business:'ვთავაზობთ სერვისს სარემონტო მომსახურების',objective:'გაყიდვები',area:'მომხმარებლის მოზიდვა და გაყიდვები',bottleneck:'მწერენ, მაგრამ იშვიათად ყიდულობენ',conversion:'არ ვიცი',loss_reason:'ძვირია',acquisition:'ფასიანი რეკლამით',pain:'რეკლამაზე ფული იხარჯება შედეგი არ მოაქვს',process:'დილიდან თანამშრომლები არიან ჩართულები შემოსულ ლიდებს ამუშავებენ მაგრამ გაყიდვა ძალიან რთულია და საუკეთესო ფასის შემთხვევაშიც არ დასტურდება',scale:'არ ვიცი',impact:'დრო იკარგება თანამშრომლების და ასევე ბიუჯეტიც',severity:'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას',systems:'ფეისბუქზე',baseline:'არ ვიცი',priority_check:'ეს არის მთავარი პრიორიტეტი'};
const cases=process.env.AUDIT_SALES_CASE==='sparse'?['sparse']:['sparse','synthetic_case'];
let failed=false;
for(const name of cases){
 const answers={...original,...(name==='synthetic_case'?{customer:'ბინის მფლობელები',lost_case:'ბოლო მომხმარებელს ბინის რემონტი სურდა. დეტალური ხარჯთაღრიცხვა გავუგზავნეთ, თქვა ძვირია და აღარ გვიპასუხა.',follow_up:'მეორედ არ დავკავშირებივართ.',loss_stage:'დეტალური შეთავაზების შემდეგ'}:{})};
 let state,message='მაქვს სარემონტო კომპანია არ ვარ კმაყოფილი მუშაობით ნუ კი მუშაობს მაგრამ შესაძლებლობების მაქსიმუმი არ იხარჯება';const transcript=[];
 for(let i=0;i<24;i++){
  const r=await fetch(base+'/api/ai-intake',{method:'POST',signal:AbortSignal.timeout(70000),headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:message}],intakeState:state})});
  const output=await r.json();transcript.push({input:message,status:r.status,output});
  if(r.status!==200)break;
  state=output.intakeState;console.log(JSON.stringify({name,turn:i+1,question:state.currentQuestion,business:state.facts.business?.status,focus:state.focus,complete:state.complete}));
  if(state.complete)break;
  message=answers[state.currentQuestion]||'არ ვიცი';
 }
 const last=transcript.at(-1).output;
 const checks={complete:!!state?.complete,business:state?.facts.business?.status==='confirmed'&&state.facts.business.quote.includes('სარემონტო'),noForcedProduct:!last.assessment?.product,actionable:!!last.content?.includes('ბოლო დაკარგული მომართვების'),hypotheses:!!last.content?.includes('ვარიანტებია და არა დადგენილი'),caseExplored:transcript.some(t=>t.output.intakeState?.currentQuestion==='lost_case'),noBaselineRepeat:!transcript.some(t=>t.output.intakeState?.currentQuestion==='baseline'),...(name==='synthetic_case'?{caseSaved:state?.facts.lost_case?.status==='confirmed',followUpSaved:state?.facts.follow_up?.status==='confirmed'}:{})};
 const pass=Object.values(checks).every(Boolean);failed ||=!pass;
 await writeFile(root+'/'+name+'.json',JSON.stringify({base,pass,checks,transcript},null,2));console.log(JSON.stringify({name,pass,checks,receipt:root+'/'+name+'.json'}));
 if(transcript.at(-1).status!==200)break;
}
if(failed)process.exitCode=1;
