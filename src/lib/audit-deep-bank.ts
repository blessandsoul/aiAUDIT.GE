import type { Question } from './audit-bank.ts';
const q = (meaning: string, ka: string, ru: string, en: string): Question => ({meaning,text:{ka,ru,en},options:[]});
export const DEEP_BANK = {
  process_owner: q('Person accountable for the current process, not merely company title.', 'ვინ არის პასუხისმგებელი ამ პროცესის საბოლოო შედეგზე?', 'Кто отвечает за конечный результат этого процесса?', 'Who is accountable for the outcome of this process?'),
  trigger: q('Actual event that starts a case.', 'რა იწყებს ამ პროცესში ახალ შემთხვევას?', 'Какое событие запускает новый случай в этом процессе?', 'What event starts a new case in this process?'),
  completion: q('Observable definition of a completed case.', 'როგორ ადგენთ, რომ სამუშაო დასრულებულია?', 'Как вы определяете, что работа завершена?', 'How do you determine that a case is finished?'),
  exceptions: q('Concrete cases outside the standard workflow.', 'რომელი შემთხვევა ვერ სრულდება ჩვეულებრივი წესით?', 'Какие случаи не укладываются в обычный порядок?', 'Which cases cannot follow the normal workflow?'),
  handoff: q('Actual transfer to another person and information passed.', 'როდის გადადის საქმე სხვა თანამშრომელთან და რა ინფორმაციას იღებს ის?', 'Когда дело передаётся другому сотруднику и какую информацию он получает?', 'When is a case handed to another person, and what information goes with it?'),
  source_of_truth: q('Authoritative operational record used when systems disagree.', 'თუ ჩანაწერები განსხვავდება, რომელ წყაროს ენდობით?', 'Какому источнику доверяете, если записи расходятся?', 'Which record is authoritative when systems disagree?'),
  data_quality: q('Observed missing, outdated or incorrect input data.', 'რა ინფორმაცია გაკლიათ ან გხვდებათ არასწორად?', 'Какие данные бывают пропущены или неверны?', 'What input information is missing or incorrect in practice?'),
  permissions: { ...q('Actual authorization status: approved only if permission is already granted for this test; a named approver or future approval is pending. Never request credentials.', 'მონაცემების გამოყენება ამ ტესტისთვის უკვე ნებადართულია?', 'Использование данных именно для этого теста уже разрешено?', 'Is data use already authorized for this specific test?'), options: [
    {value:'approved',label:{ka:'უკვე ნებადართულია',ru:'Уже разрешено',en:'Already authorized'}},
    {value:'pending',label:{ka:'ნებართვა ჯერ არ მიგვიღია',ru:'Разрешение ещё не получено',en:'Permission is still pending'}},
    {value:'denied',label:{ka:'ნებართვა არ გვაქვს',ru:'Использование запрещено',en:'Use is prohibited'}},
  ] },
  retention: q('Existing retention/deletion policy, not legal advice.', 'რა წესი გაქვთ სატესტო მონაცემების შენახვისა და წაშლისთვის?', 'Какое правило действует для хранения и удаления тестовых данных?', 'What rule governs retention and deletion of test data?'),
  personal_data: q('Sensitive data categories only, no actual records.', 'რა სახის პირადი მონაცემია პროცესში? მხოლოდ კატეგორია აღწერეთ.', 'Какие категории персональных данных есть в процессе? Только категории, без самих данных.', 'What categories of personal data are involved? Categories only, no actual records.'),
  volume_peaks: q('Peak load and period; preserve estimates and units.', 'როდის იზრდება დატვირთვა და რამდენად?', 'Когда нагрузка достигает пика и насколько растёт?', 'When does workload peak, and by how much?'),
  unit_time: q('Observed hands-on time per case, not total elapsed waiting.', 'ერთ ჩვეულებრივ შემთხვევაზე რამდენი დრო იხარჯება უშუალო მუშაობაში?', 'Сколько активного рабочего времени уходит на один обычный случай?', 'How much hands-on time does one normal case take?'),
  error_cost: q('Observed consequence of error; no invented financial estimate.', 'ბოლო შეცდომის გამოსწორებას რა დასჭირდა?', 'Что потребовалось для исправления последней ошибки?', 'What did correcting the last error involve?'),
  seasonality: q('Seasonal or calendar differences affecting comparison.', 'რომელი სეზონური ცვლილება უნდა გავითვალისწინოთ შედარებისას?', 'Какие сезонные изменения нужно учесть при сравнении?', 'What seasonal changes should a comparison account for?'),
  dependencies: q('Systems or third parties required; no assumed integration support.', 'რომელი სისტემის ან პარტნიორის გარეშე ვერ იმუშავებს ცვლილება?', 'Без какой системы или внешнего партнёра изменение не заработает?', 'Which system or external partner is essential for the change?'),
  adoption: q('Actual training/change owner and readiness.', 'ვინ აუხსნის გუნდს ახალ წესს და დაეხმარება დაწყებისას?', 'Кто обучит команду новому порядку и поможет при запуске?', 'Who will train the team and support the change?'),
  rollback: q('Concrete safe return to the current process.', 'თუ ტესტი ვერ იმუშავებს, როგორ დაბრუნდებით ძველ პროცესზე?', 'Как вернётесь к прежнему процессу, если тест не сработает?', 'How will you return to the current process if the test fails?'),
  pilot_scope: q('Client-proposed limited scope; not authorization to execute.', 'რომელი მცირე ნაწილი გამოდგება პირველი შემოწმებისთვის?', 'Какую небольшую часть процесса можно взять для первой проверки?', 'What small part of the process could be checked first?'),
  success_threshold: q('Client success criterion, label as target not guaranteed outcome.', 'რა შედეგს ჩათვლით ტესტის წარმატებად?', 'Какой результат вы считаете успехом теста?', 'What result would you consider a successful test?'),
  stop_rules: q('Client agreed error/incident stop criteria.', 'რა შეცდომისას უნდა შეჩერდეს ტესტი?', 'При какой ошибке тест должен быть остановлен?', 'What error should stop the test?'),
  baseline_period: q('Actual comparison period and comparable sample.', 'რომელ პერიოდსა და სამუშაოს შეადარებთ ტესტს?', 'С каким периодом и сопоставимыми задачами сравните тест?', 'Which period and comparable cases will you use as the baseline?'),
  review_capacity: { ...q('Actual reviewer capacity. available requires time currently allocated, not a title, future intention or zero time; unavailable means none. Preserve any stated time in the quote.', 'შემმოწმებელს ტესტისთვის დრო უკვე გამოყოფილი აქვს?', 'У проверяющего уже выделено время на этот тест?', 'Does the reviewer already have time allocated for this test?'), options: [
    {value:'available',label:{ka:'დრო უკვე გამოყოფილია',ru:'Время уже выделено',en:'Time is already allocated'}},
    {value:'unavailable',label:{ka:'დრო ჯერ არ არის გამოყოფილი',ru:'Время не выделено',en:'No time is allocated'}},
  ] },
} satisfies Record<string, Question>;
export const DEEP_FIELDS = Object.keys(DEEP_BANK) as Array<keyof typeof DEEP_BANK>;
