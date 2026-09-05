import {mkdir,writeFile} from 'node:fs/promises';
process.env.AUDIT_FIXTURES_ONLY='1';const {cases}=await import('./audit-live-check.mjs');
const root='artifacts/audit-check/positive-'+Date.now();await mkdir(root,{recursive:true});
for(const name of ['ads','office']){
 const f=structuredClone(cases[name]);
 const business=name==='ads'?'We sell sports clothing online to individual shoppers.':'We distribute packaged food to independent grocery stores.';
 f.first=business+' '+f.first;f.answers.business=business;
 if(name==='ads'){f.answers.process='The marketing manager checks campaign spending and verified purchases, compares campaigns and prepares proposed budget changes for approval.';f.answers.scale='We review 12 active paid advertising campaigns every working day.';}
 let state,message=f.first;const transcript=[];
 for(let i=0;i<18;i++){
  const response=await fetch('http://localhost:3350/api/ai-intake',{method:'POST',signal:AbortSignal.timeout(65000),headers:{'Content-Type':'application/json'},body:JSON.stringify({intakeState:state,messages:[{role:'user',content:message}]})});const body=await response.json();
  transcript.push({input:message,http:response.status,output:body});if(!response.ok)break;state=body.intakeState;
  console.log(JSON.stringify({name,turn:i+1,question:state.currentQuestion,complete:state.complete}));
  if(state.complete)break;message=f.answers[state.currentQuestion];if(!message)break;
 }
 const last=transcript.at(-1);const pass=last.output?.intakeState?.complete&&last.output.assessment?.product===f.product;
 await writeFile(root+'/'+name+'.json',JSON.stringify({pass,transcript},null,2));console.log(JSON.stringify({name,pass,assessment:last.output.assessment,receipt:root+'/'+name+'.json'}));
 if(last.http===429)break;
}
