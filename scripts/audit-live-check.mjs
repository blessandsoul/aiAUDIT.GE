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
  calls: {
    first: 'კლინიკაში საკუთარ პაციენტებს ჩაწერის დადასტურებაზე ვურეკავთ. ზარები მეორდება და ადმინისტრატორი ვერ ასწრებს. გვინდა მხოლოდ ამ პროცესის შემოწმება.',
    answers: { ...common, business: 'კერძო კლინიკა ვართ და პაციენტებს ვემსახურებით.', objective: 'ჩაწერის დადასტურების პროცესის გამარტივება გვინდა.', pain: 'ადმინისტრატორი დადასტურების ზარებს გვიან აკეთებს და ნაწილი შეუმოწმებელი რჩება.', process: 'ადმინისტრატორი იღებს ხვალინდელი ჩაწერების სიას, ურეკავს პაციენტს და პასუხს კალენდარში წერს.', call_task: 'ჩაწერა და დადასტურება', call_permission: 'საკუთარ კლიენტებს არსებული მომსახურების შესახებ', response: 'პასუხი გვიანდება', repetition: 'უმეტესად მსგავსი შემთხვევაა', systems: 'ჩაწერის კალენდარი და პაციენტების სია.', baseline: 'გასულ კვირაში 25 დადასტურების ზარს ხელით ვაკეთებდით.' },
    expect: 'pilot', product: 'aiCALL',
  },
  ads: {
    first: 'ფასიან Meta კამპანიებს ვმართავთ და რეალურ შეძენებს ვზომავთ. მენეჯერი ყოველდღე ხელით ადარებს კამპანიებს და ბიუჯეტებს. ეს განმეორებადი სამუშაოა.',
    answers: { ...common, business: 'ონლაინ მაღაზია ვართ.', objective: 'რეკლამის მართვის დროის შემცირება გვინდა.', pain: 'კამპანიების შემოწმება დროულად ვერ სრულდება და ცვლილებები გვიანდება.', acquisition: 'ფასიანი რეკლამით', tracking: 'რეალური შეძენა ჩანს', ads_work: 'მენეჯერი ყოველდღე ამოწმებს კამპანიებს, ხარჯს და შეძენებს.', repetition: 'უმეტესად მსგავსი შემთხვევაა', baseline: 'ყოველ დილით 90 წუთს ვხარჯავთ კამპანიების შემოწმებაზე.' },
    expect: 'pilot', product: 'aiADS',
  },
  office: {
    first: 'შეკვეთების ინფორმაცია ხელით გადაგვაქვს Excel-დან საწყობის სისტემაში და დამტკიცებებს ველოდებით. ეს ყოველდღე მეორდება და შეცდომებს იწვევს.',
    answers: { ...common, business: 'დისტრიბუციის კომპანია ვართ.', objective: 'შიდა შეკვეთების პროცესის შეცდომების შემცირება გვინდა.', pain: 'შეკვეთის მონაცემი გვიან გადადის და ნაწილი შეცდომით შედის.', process: 'ოპერატორი იღებს შეკვეთას Excel-ში, გადააქვს საწყობის სისტემაში და მენეჯერის დამტკიცებას ელოდება.', office_task: 'ერთი სისტემიდან მეორეში გადატანა', repetition: 'უმეტესად მსგავსი შემთხვევაა', systems: 'Excel, საწყობის სისტემა და ელფოსტა.', baseline: 'გასულ კვირაში 8 შეკვეთის ხელით გასწორება დაგვჭირდა.' },
    expect: 'pilot', product: 'aiOFFICE',
  },
  app: {
    first: 'გვჭირდება ახალი აპლიკაცია, რომ B2B კლიენტმა დამოუკიდებლად მოითხოვოს შეთავაზება და მონაცემი CRM-ში გადავიდეს. არსებულ ხელსაწყოს ასეთი ინტეგრაცია არ აქვს.',
    answers: { ...common, business: 'B2B მომსახურების კომპანია ვართ.', objective: 'კლიენტის მოთხოვნის ახალი ციფრული გზა გვჭირდება.', pain: 'მოთხოვნები ელფოსტაში იკარგება და CRM-ში ხელით შეგვყავს.', process: 'კლიენტი ელფოსტით წერს, მენეჯერი კითხულობს და CRM-ში ხელით ამატებს.', app_task: 'სისტემების ახალი ინტეგრაცია', systems: 'ელფოსტა და CRM.', baseline: 'გასულ თვეში 12 მოთხოვნა ხელით შევიტანეთ.' },
    expect: 'scoped_discovery', product: 'aiAPP',
  },
  rescue: {
    first: 'AI-ით აწყობილი არსებული აპლიკაცია ხშირად ფუჭდება და ვერ ვცვლით. გვჭირდება ტექნიკური შეფასება და შეკეთების scope, არა ახალი პროდუქტი.',
    answers: { ...common, business: 'SaaS პროდუქტი გვაქვს.', objective: 'არსებული აპლიკაციის სტაბილურობის შეფასება გვინდა.', pain: 'რელიზის შემდეგ ფუნქციები ფუჭდება და მომხმარებლები ვერ ასრულებენ მოქმედებას.', process: 'გუნდი იღებს bug report-ს, ხელით ეძებს კოდში მიზეზს და შემდეგ ასწორებს.', rescue_task: 'ფუნქციები ხშირად ფუჭდება', systems: 'არსებული ვებ-აპლიკაცია და issue tracker.', baseline: 'ბოლო თვეში ოთხი განმეორებითი bug report გვქონდა.' },
    expect: 'technical_assessment', product: 'vibeCODING',
  },
  staff: {
    first: 'კლიენტებს რთული ინდივიდუალური მოთხოვნები აქვთ და ავტომატური პასუხი არ გვინდა. გვჭირდება ცოცხალი სპეციალისტი follow-up-ისთვის.',
    answers: { ...common, business: 'უძრავი ქონების სააგენტო ვართ.', objective: 'რთული კლიენტური მოთხოვნების ხარისხიანად დამუშავება გვინდა.', pain: 'ინდივიდუალური კლიენტის follow-up დროულად ვერ სრულდება.', process: 'სპეციალისტი კითხულობს მოთხოვნას, არჩევს ობიექტს და აგრძელებს მოლაპარაკებას.', staff_task: 'მოლაპარაკება და შემდგომი კომუნიკაცია', baseline: 'გასულ კვირაში 14 მოთხოვნას მეორე პასუხი დაუგვიანდა.' },
    expect: 'human_service', product: 'aiSTAFF',
  },
  fleet: {
    first: 'ავტონომიური ტაქსის ფლოტის მომავალი პროექტი გვაინტერესებს.',
    answers: { ...common, business: 'ტრანსპორტის კომპანია ვართ.', objective: 'ფლოტის მომავლის შეფასება გვინდა.', pain: 'ავტონომიური ფლოტის მიმართულება გვინდა გავიგოთ.', process: 'ფლოტს ოპერატორები მართავენ.', fleet_task: 'კი, ფლოტის ავტონომიურ მუშაობას', scale: '20 მანქანა გვყავს.', impact: 'გადაწყვეტილებისთვის მეტი ინფორმაცია გვჭირდება.', severity: 'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას' },
    expect: 'not_available',
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
