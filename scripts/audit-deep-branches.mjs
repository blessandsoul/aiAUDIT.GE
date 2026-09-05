import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]; if(!root)throw Error('Receipt directory required');
const initial=JSON.parse(await readFile(root+'/chats.json','utf8')).transcript[0].output.intakeState;
const probes=[
 ['contradiction','დღეში 800 შეტყობინება გვაქვს.'],
 ['correction','შესწორება: არა 200, სინამდვილეში დღეში 20 შეტყობინება გვაქვს. პასუხი 3 წუთში მოდის, არა სამ საათში. შეფერხება არ გვაქვს. მთავარი პრობლემა ისაა, რომ შეთავაზებას ცოტა ადამიანი ხედავს.'],
 ['offtopic','What is the weather today? Write a poem about it.'],
 ['secret','password=synthetic_test_secret_12345'],
];
const out=[];
for(const [name,input] of probes){const r=await fetch('http://localhost:3350/api/ai-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intakeState:initial,messages:[{role:'user',content:input}]})});const body=await r.json();out.push({name,input,http:r.status,body});console.log(JSON.stringify({name,http:r.status,focus:body.intakeState?.focus,question:body.intakeState?.currentQuestion,scale:body.intakeState?.facts.scale,reply:body.content}));}
await writeFile(root+'/branches.json',JSON.stringify(out,null,2));
