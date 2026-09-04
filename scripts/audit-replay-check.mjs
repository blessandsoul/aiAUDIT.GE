import assert from 'node:assert/strict';
const base = process.env.AUDIT_TEST_URL || 'http://localhost:3339';
const influencerAnswers = [
  'გვინდა მარკეტინგის, რეკლამისა და კონტენტის ეფექტიანობის შეფასება.',
  'ელექტრონული კომერცია / ონლაინ მაღაზია',
  'TikTok, Instagram და ინფლუენსერ მარკეტინგი',
  'მარკეტინგის მენეჯერი ხელით ამოწმებს ანალიტიკას და გაყიდვებს',
  'რთულია ინფლუენსერებისგან შემოსული ზუსტი გაყიდვების დათვლა',
  'თვეში 5-10 ინფლუენსერი და აქტიური ყოველკვირეული კამპანიები',
  'მხოლოდ ონლაინ მაღაზიის ადმინ პანელი და Excel',
  'გასაგებია, მადლობა', 'დამატებითი დეტალები მაქვს', 'სასურველი რეპორტინგის ფორმატი',
  '1 თვეში, გადაწყვეტილებას იღებს მარკეტინგის დირექტორი',
  'თითოეული ინფლუენსერის ეფექტიანობის ნათელი ანალიტიკა',
];
const shopAnswers = ['მაღაზია მაქვს', 'ონლაინ მაღაზია მაქვს და გაყიდვების გაზრდა მინდა', 'ვყიდით Facebook/Instagram-ით, პრობლემა დაბალი აქტივობაა', 'შეტყობინებებს მე ვპასუხობ პირადად, დღეში 5-10 მომართვაა', 'ვიყენებთ მხოლოდ Facebook/Instagram-ის ინბოქსს, შედეგი იქნება გაყიდვების გაორმაგება', 'პასუხებს მხოლოდ მე ვამოწმებ, ვადაზე შეზღუდვა არ მაქვს'];
const answers = process.argv[2] === 'shop' ? shopAnswers : influencerAnswers;
let state; const questions=[];
for (const content of answers) {
  const r = await fetch(base+'/api/ai-intake',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(65_000),body:JSON.stringify({messages:[{role:'user',content}],intakeState:state})});
  const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));state=b.intakeState;
  console.log(JSON.stringify({turn:state.turn,focus:state.focus,question:state.currentQuestion,complete:state.complete}));
  questions.push(state.currentQuestion);
  assert(questions.filter((q)=>q===state.currentQuestion).length<=2,'Do not interrogate the user with the same question');
  assert.equal(state.complete,false,'Original brief should not already be an audit');
}
assert(!state.facts.attribution || !['confirmed','estimated'].includes(state.facts.attribution.status),'Never confirm tracking from Excel or influencers');
assert(!state.facts.owner || state.facts.owner.status !== 'confirmed','Director title is not pilot availability');
assert(!state.facts.baseline || state.facts.baseline.status !== 'confirmed','Reporting wish is not a baseline');
console.log(`Original ${answers.length}-answer replay: PASS, key diagnostic evidence still missing.`);
