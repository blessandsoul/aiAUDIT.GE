import {mkdir,writeFile} from 'node:fs/promises';
import {extract} from '../src/lib/audit-extractor.ts';
import {createIntakeState,advanceAudit,val} from '../src/lib/audit-engine.ts';
const cases=[
 ['en','permissions','The director must approve it, but permission has not been granted.','pending'],
 ['ru','permissions','Директор должен согласовать, но разрешения пока нет.','pending'],
 ['ka','permissions','დირექტორმა უნდა მოგვცეს ნებართვა, ჯერ არ მიგვიღია.','pending'],
 ['en','permissions','Use of these test records is prohibited.','denied'],
 ['ru','permissions','Использовать эти данные для теста запрещено.','denied'],
 ['ka','permissions','ამ მონაცემების გამოყენება ტესტისთვის აკრძალულია.','denied'],
 ['en','review_capacity','The manager is responsible, but has no time allocated for this test.','unavailable'],
 ['ru','review_capacity','Руководитель назначен, но времени на проверку у него нет.','unavailable'],
 ['ka','review_capacity','შემმოწმებელი გვყავს, მაგრამ ტესტისთვის დრო არ აქვს.','unavailable'],
 ['en','permissions','The director has already authorized these records for this specific test.','approved'],
 ['ru','review_capacity','Проверяющему уже выделено полчаса каждый день на этот тест.','available'],
 ['ka','review_capacity','შემმოწმებელს ამ ტესტისთვის დრო უკვე გამოყოფილი აქვს.','available'],
];
const root=`artifacts/audit-check/readiness-${Date.now()}`;await mkdir(root,{recursive:true});
const results=[];
for(const [language,field,message,expected] of cases){
 const s=createIntakeState(language,'deep');s.focus='chats';s.currentQuestion=field;
 const extraction=await extract(s,message);const state=advanceAudit(s,message,extraction);
 const actual=val(state,field);results.push({language,field,message,expected,actual,pass:actual===expected,extraction});
}
await writeFile(`${root}/results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({root,total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass)}));
if(results.some(r=>!r.pass))process.exitCode=1;
