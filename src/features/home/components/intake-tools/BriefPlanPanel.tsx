'use client';

import { Ico } from '@/components/common/Ico';

export type IntakeModule = string;

export type Brief = {
  prompt: string;
  module: IntakeModule;
  model: string;
  power: string;
  deepAnalysis: boolean;
};

type BriefPlanPanelProps = {
  brief: Brief;
  answers: string[];
  onAnswer: (answer: string) => void;
  onOpenWorkspace: () => void;
  onHumanHandoff: () => void;
  onEdit: () => void;
};

type BriefRoute = {
  title: string;
  summary: string;
  phases: string[];
  range: string;
  rangeNote: string;
  questions: Array<{ question: string; options: string[] }>;
};

const ROUTES: Record<string, BriefRoute> = {
  aiCHATS: { title: 'AI კლიენტებთან კომუნიკაცია', summary: '24/7 პასუხები, ლიდების კვალიფიკაცია და სწორი გადამისამართება არხებს შორის.', phases: ['არხებისა და პასუხების რუკა', 'ცოდნის ბაზა და სცენარები', 'ტესტირება რეალურ დიალოგებზე'], range: '150-400 GEL / თვე', rangeNote: 'ფუნქციებისა და შეტყობინებების მოცულობის მიხედვით: 2 000 შეტყობინება ან ულიმიტო გეგმა.', questions: [{ question: 'რომელი არხი არის მთავარი დღეს?', options: ['Instagram / Facebook', 'WhatsApp', 'ვებსაიტი'] }, { question: 'რა უნდა გააკეთოს AI-მ პირველ რიგში?', options: ['კითხვებზე პასუხი', 'ლიდის კვალიფიკაცია', 'შეკვეთის მიღება'] }, { question: 'როდის იკარგება ყველაზე მეტი მოთხოვნა?', options: ['სამუშაო საათების შემდეგ', 'შაბათ-კვირას', 'პიკის საათებში'] }] },
  aiCALL: { title: 'ხმოვანი ოპერატორი ქართულად', summary: 'ზარების პირველადი მიღება, საჭიროების დაზუსტება და ადამიანთან დროული გადაცემა.', phases: ['ზარის სცენარის რუკა', 'ქართული ხმისა და ცოდნის მომზადება', 'პილოტი და ხარისხის კონტროლი'], range: 'ინდივიდუალური გაანგარიშება', rangeNote: 'ფასი დამოკიდებულია ზარების მოცულობაზე, სამუშაო საათებზე, ინტეგრაციებსა და საჭირო ფუნქციებზე.', questions: [{ question: 'რა ტიპის ზარებია ყველაზე ხშირი?', options: ['ახალი კლიენტები', 'ჯავშნები', 'მხარდაჭერა'] }, { question: 'როდის გჭირდებათ პასუხი?', options: ['24/7', 'სამუშაო საათებში', 'პიკის საათებში'] }, { question: 'სად უნდა გადავიდეს დარეკვის შედეგი?', options: ['მენეჯერთან', 'CRM-ში', 'SMS / მესენჯერში'] }] },
  aiADS: { title: 'რეკლამისა და ლიდების სისტემა', summary: 'კამპანიის მიზნები, კრिएტივი, ლიდის გზა და გაზომვადი ოპტიმიზაცია ერთ სამუშაო გეგმაში.', phases: ['ფანელისა და გაზომვის აუდიტი', 'კამპანიისა და კრिएტივის სტრუქტურა', 'ყოველკვირეული ოპტიმიზაცია და ანგარიში'], range: '500 GEL / თვიდან', rangeNote: 'ფუნქციები და მასალის მოცულობა განსაზღვრავს გეგმას; სარეკლამო ბიუჯეტი ამ თანხაში არ შედის.', questions: [{ question: 'რა არის მთავარი შედეგი?', options: ['ლიდები', 'ონლაინ გაყიდვები', 'ცნობადობა'] }, { question: 'სად მიდის კლიენტი რეკლამიდან?', options: ['Instagram Direct', 'ვებსაიტი', 'WhatsApp'] }, { question: 'უკვე გაქვთ გაზომვა გამართული?', options: ['დიახ', 'ნაწილობრივ', 'არა'] }] },
  aiCONTENT: { title: 'კონტენტის წარმოების სისტემა', summary: 'ბრენდის ენიდან გეგმამდე, ვიზუალამდე და რეგულარულ გამოქვეყნებამდე.', phases: ['ბრენდის ხმისა და ვიზუალური წესების განსაზღვრა', 'თვიური კონტენტ-გეგმა', 'წარმოება და ანალიტიკური მიმოხილვა'], range: '500-2 000 GEL / თვე', rangeNote: 'ფასი მოიცავს ფუნქციებსა და გამოქვეყნების მოცულობას: 8-30 პოსტი, 3-10 ვიდეო და 5-8 გრაფიკა.', questions: [{ question: 'რომელი არხი არის პრიორიტეტი?', options: ['Instagram', 'Facebook', 'ორივე'] }, { question: 'რისი მიღება გსურთ კონტენტიდან?', options: ['მოთხოვნები', 'ნდობა', 'გაყიდვები'] }, { question: 'რამდენად ხშირად გსურთ გამოქვეყნება?', options: ['კვირაში 2-ჯერ', 'კვირაში 3-4-ჯერ', 'ყოველდღე'] }] },
  aiWEB: { title: 'ვებ-პროდუქტი AI ინტეგრაციით', summary: 'სწრაფი, გასაგები ვებ-გამოცდილება, რომელიც შეკითხვას გადაიყვანს მოქმედებასა და ლიდში.', phases: ['ამოცანისა და გვერდების რუკა', 'დიზაინი და ინტერაქტიული პროტოტიპი', 'განვითარება, გადახდები ან AI ინტეგრაცია'], range: '2 000 GEL-დან', rangeNote: 'საიტი: 10 გვერდამდე. E-commerce: 4 000 GEL-დან. პლატფორმა: 5 000 GEL-დან, ფუნქციისა და ინტეგრაციების მიხედვით.', questions: [{ question: 'რა უნდა გააკეთოს ვიზიტორმა?', options: ['დატოვოს მოთხოვნა', 'იყიდოს', 'მიიღოს კონსულტაცია'] }, { question: 'რამდენი ძირითადი გვერდი გჭირდებათ?', options: ['1-3', '4-10', '10+'] }, { question: 'რა უნდა დაუკავშირდეს საიტს?', options: ['AI ასისტენტი', 'გადახდა', 'CRM'] }] },
  aiSTAFF: { title: 'ცოცხალი AI გადაწყვეტილების სესია', summary: 'სპეციალისტი გაარკვევს ამოცანას, რისკებსა და რეალურ ინტეგრაციებს, სანამ ზუსტ შეთავაზებას მოამზადებს.', phases: ['მიზნისა და პროცესის დაზუსტება', 'შესაძლებლობებისა და შეზღუდვების შეფასება', 'ზუსტი შემდეგი ნაბიჯის შეთანხმება'], range: 'ზუსტი შეთავაზება დაზუსტების შემდეგ', rangeNote: 'რთული ან შერეული ამოცანისთვის ფასი პასუხისმგებლობით ითვლება მოცულობისა და ინტეგრაციების მიხედვით.', questions: [{ question: 'რომელი შედეგი არის ყველაზე მნიშვნელოვანი?', options: ['დროის დაზოგვა', 'მეტი ლიდი', 'ნაკლები ოპერაციული შეცდომა'] }, { question: 'სად არის პროცესი დღეს?', options: ['ცხრილებში', 'CRM-ში', 'მესენჯერებში'] }, { question: 'როდის გსურთ დაწყება?', options: ['ამ თვეში', 'მომდევნო თვეში', 'ვიკვლევ შესაძლებლობებს'] }] },
};

function inferModule(prompt: string, selected: IntakeModule): string {
  if (selected !== 'Auto') return selected;
  const value = prompt.toLowerCase();
  if (/call|ზარ|ტელეფ|ხმოვან/.test(value)) return 'aiCALL';
  if (/რეკლამ|meta|google|ლიდ/.test(value)) return 'aiADS';
  if (/კონტენტ|ვიდეო|პოსტ|სოც/.test(value)) return 'aiCONTENT';
  if (/საიტ|ვებ|e-?commerce|მაღაზ/.test(value)) return 'aiWEB';
  if (/ბოტ|chat|whatsapp|instagram|მესენ/.test(value)) return 'aiCHATS';
  return 'aiSTAFF';
}

export function routeBrief(brief: Brief) {
  return ROUTES[inferModule(brief.prompt, brief.module)];
}

export function BriefPlanPanel({ brief, answers, onAnswer, onOpenWorkspace, onHumanHandoff, onEdit }: BriefPlanPanelProps) {
  const route = routeBrief(brief);
  const currentQuestion = route.questions[answers.length];
  const progress = Math.min(100, Math.round((answers.length / route.questions.length) * 100));

  return <section className="briefPlan" aria-live="polite">
    <div className="briefPlanHeader"><div><span className="briefPlanEyebrow"><Ico name="solar:magic-stick-3-bold-duotone" className="size-4" /> წინასწარი AI-ბრიფი</span><h2>{route.title}</h2><p>{route.summary}</p></div><button type="button" className="briefPlanEdit" onClick={onEdit}>ტექსტის შეცვლა</button></div>
    <div className="briefPlanPrompt"><span>თქვენი ამოცანა</span><p>{brief.prompt}</p></div>
    {currentQuestion ? <div className="briefQuestion">
      <div className="briefQuestionMeta"><span>დაზუსტება {answers.length + 1} / {route.questions.length}</span><span>{progress}%</span></div><div className="briefProgress"><span style={{ width: `${progress}%` }} /></div><h3>{currentQuestion.question}</h3>
      <div className="briefOptionGrid">{currentQuestion.options.map((option) => <button key={option} type="button" onClick={() => onAnswer(option)}>{option}</button>)}</div>
    </div> : <div className="briefResult">
      <div className="briefRoadmap"><div className="briefResultHeading"><Ico name="solar:map-point-wave-bold-duotone" className="size-5" /><div><span>თქვენი საწყისი გეგმა</span><h3>სამი გასაგები ეტაპი</h3></div></div><ol>{route.phases.map((phase, index) => <li key={phase}><span>{index + 1}</span>{phase}</li>)}</ol></div>
      <div className="briefEstimate"><span>საწყისი დიაპაზონი</span><strong>{route.range}</strong><p>{route.rangeNote}</p></div>
      <div className="briefEvidence"><Ico name="solar:shield-check-bold-duotone" className="size-5" /><p><strong>რას ვადასტურებთ შემდეგ:</strong> არხებს, ფუნქციებს, შეტყობინებების ან ზარების მოცულობას და ინტეგრაციებს. მხოლოდ ამის შემდეგ იქნება ზუსტი შეთავაზება.</p></div>
      <div className="briefActions"><button type="button" className="briefPrimary" onClick={onOpenWorkspace}>სრული გეგმის გახსნა <Ico name="solar:arrow-right-up-bold-duotone" className="size-4" /></button><button type="button" className="briefSecondary" onClick={onHumanHandoff}>სპეციალისტთან გაგრძელება</button></div>
      <p className="briefDraftNotice"><Ico name="solar:diskette-bold-duotone" className="size-3.5" /> ეს ბრიფი შენახულია მხოლოდ ამ ბრაუზერში, სანამ თავად არ გააგზავნით.</p>
    </div>}
  </section>;
}
