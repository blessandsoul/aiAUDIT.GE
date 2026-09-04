// Synthetic business fixtures. Calls the audit endpoint only; never submits leads.
import assert from 'node:assert/strict';
const base = process.env.AUDIT_TEST_URL || 'http://localhost:3008';
const common = {
  business: 'ვყიდით სპორტულ ტანსაცმელს ონლაინ, კერძო მომხმარებლებზე.',
  objective: 'გვსურს გაყიდვების გაზრდა და სამუშაოს შემცირება.',
  process: 'მენეჯერი ამოწმებს შეკვეთას, ადარებს წყაროს ჩანაწერს და შემდეგ ამზადებს ანგარიშს.',
  scale: 'ჩვეულებრივ კვირაში 40 შეკვეთას ვამუშავებთ.',
  impact: 'ამ სამუშაოს კვირაში 6 საათს ვხარჯავთ და სხვა საქმე გვიგვიანდება.',
  severity: 'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას',
  systems: 'ონლაინ მაღაზიის ადმინ პანელი და Excel.',
  data: 'კი, შეგვიძლია მოვამზადოთ',
  alternative: 'ვცადეთ, მაგრამ პრობლემა დარჩა',
  owner: 'პასუხისმგებელი ადამიანი გვყავს',
  constraints: 'შედეგს ადამიანი დაამტკიცებს',
  baseline: 'ახლა ერთი ანგარიშის მომზადებას 6 საათი სჭირდება, ამას ყოველ კვირას ვზომავთ.',
  priority_check: 'ეს არის მთავარი პრიორიტეტი',
};
const cases = {
  attribution: {
    first: 'ვყიდით სპორტულ ტანსაცმელს ონლაინ. TikTok, Instagram და ინფლუენსერ მარკეტინგს ვიყენებთ. რთულია ინფლუენსერებისგან შემოსული ზუსტი გაყიდვების დათვლა.',
    answers: { ...common, objective: 'თითოეული ინფლუენსერის ეფექტიანობის ნათელი ანალიტიკა გვინდა.', pain: 'ინფლუენსერისგან შემოსულ შეკვეთას ვერ ვადგენთ და პარტნიორს შედეგით ვერ ვირჩევთ.', attribution: 'წყაროს არ ვაფიქსირებთ', reporting_gap: 'შეკვეთას წყარო არ ახლავს', reporting_decision: 'პარტნიორის შერჩევა ან შეცვლა' },
    expect: 'measurement_first',
  },
  growth: {
    first: 'ონლაინ მაღაზიაში სპორტულ ტანსაცმელს ვყიდით და გაყიდვების გაზრდა მინდა. Facebook/Instagram-ით ვყიდით, პრობლემა დაბალი აქტივობაა. შეტყობინებებს მე ვპასუხობ პირადად, დღეში 5-10 მომართვაა.',
    answers: { ...common, pain: 'შეთავაზებას ცოტა ადამიანი ხედავს და ახალი მომართვა ცოტაა.', bottleneck: 'ცოტა ადამიანი ხედავს შეთავაზებას', acquisition: 'პოსტებითა და რეკომენდაციებით', conversion: 'დღეში 5-10 მომართვიდან ჩვეულებრივ 2 შეკვეთა სრულდება.', loss_reason: 'არ ვიცი', baseline: 'ბოლო კვირაში დღეში საშუალოდ 2 შეძენა იყო.', impact: 'საქონლის ნაწილი ერთი თვე გაუყიდავი რჩება და ახალი მარაგისთვის ფული გვაკლდება.' },
    expect: 'process_first',
  },
  chats: {
    first: 'კერძო კლინიკა ვართ, პაციენტებს ვემსახურებით. Instagram-ში დღეში 200 შეტყობინება გვაქვს. ორი ადმინისტრატორი პასუხობს, ერთი და იგივე ფასსა და ჩაწერაზე კითხულობენ. პასუხი რამდენიმე საათით გვიანდება. გვინდა ადმინისტრატორების დატვირთვის შემცირება.',
    answers: { ...common, business: 'კერძო კლინიკა ვართ და პაციენტებს ვემსახურებით.', process: 'ადმინისტრატორი კითხულობს შეტყობინებას, პასუხობს კითხვებს და პაციენტს თავისუფალ დროს სთავაზობს.', pain: 'პაციენტის შეტყობინებას რამდენიმე საათი უპასუხოდ ვტოვებთ.', response: 'პასუხი გვიანდება', repetition: 'უმეტესად მსგავსი შემთხვევაა', systems: 'Instagram-ის ინბოქსი და კლინიკის ჩაწერის კალენდარი.', baseline: 'ბოლო კვირაში პასუხის საშუალო დრო 3 საათი იყო.' },
    expect: 'pilot', product: 'aiCHATS',
  },
};
const selected = process.argv[2] ? [process.argv[2]] : Object.keys(cases);
for (const name of selected) {
  const fixture = cases[name]; let state; let message = fixture.first; const visited = [];
  for (let i = 0; i < 25; i++) {
    const response = await fetch(base + '/api/ai-intake', { method: 'POST', signal: AbortSignal.timeout(65_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: message }], intakeState: state }) });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    state = body.intakeState;
    console.log(JSON.stringify({ case: name, turn: i + 1, focus: state.focus, question: state.currentQuestion, complete: state.complete, gaps: body.progress.gaps }));
    assert(!body.content.includes('ამოცანა ვარაუდის გარეშე'));
    assert(!body.suggestions.some((s) => /გასაგებია|დამატებითი დეტალები|5.?10|1 თვეში/.test(s)));
    if (state.complete) {
      assert.equal(body.assessment.verdict, fixture.expect);
      assert.equal(body.assessment.product, fixture.product || null);
      assert(body.content.includes('შემდეგი ნაბიჯი'));
      assert(body.content.includes('მტკიცებულება'));
      console.log(JSON.stringify({ case: name, result: 'PASS', assessment: body.assessment, report: body.content }));
      break;
    }
    const field = state.currentQuestion;
    visited.push(field);
    assert(visited.filter((f) => f === field).length < 3, `Repeated question: ${field}`);
    message = fixture.answers[field];
    assert(message, `Missing fixture answer for ${field}`);
    assert(i < 24, 'Did not complete');
  }
}
