export type Language = 'ka' | 'ru' | 'en';
export type Localized = Record<Language, string>;
export const l = (ka: string, ru: string, en: string): Localized => ({ ka, ru, en });
export const FOCUSES = ['discovery', 'growth', 'attribution', 'chats', 'calls', 'ads', 'content', 'docs', 'web', 'office', 'app', 'rescue', 'staff', 'fleet', 'operations'] as const;
export type Focus = typeof FOCUSES[number];
type Option = { value: string; label: Localized };
export type Question = { text: Localized; meaning: string; options: Option[] };
const option = (value: string, ka: string, ru: string, en: string): Option => ({ value, label: l(ka, ru, en) });
const q = (meaning: string, ka: string, ru: string, en: string, options: Option[] = []): Question => ({ meaning, text: l(ka, ru, en), options });
export const UNKNOWN = l('არ ვიცი', 'Не знаю', 'I don’t know');
export const DECLINED = l('გამოტოვება', 'Пропустить', 'Skip');

// One semantic question owns both its wording and its answer choices. Free text
// remains available; quantities, deadlines and job titles are never prefilled.
export const BANK = {
  business: q('What exactly the business sells and to whom. A bare "shop" is partial.', 'რას ყიდის თქვენი კომპანია და ვინ არის მთავარი მომხმარებელი?', 'Что продаёт ваша компания и кто основной покупатель?', 'What does your company sell, and who is the main customer?'),
  objective: q('Desired outcome, not a proven result.', 'რომელი შედეგის გაუმჯობესებაა ახლა თქვენთვის ყველაზე მნიშვნელოვანი?', 'Какой результат сейчас важнее всего улучшить?', 'Which result matters most to improve right now?'),
  area: q('The process the user wants examined first; choose only from their evidence.', 'რომელ პროცესში ხედავთ ყველაზე დიდ სირთულეს?', 'В каком процессе вы видите главную трудность?', 'Which process is causing the most difficulty?', [
    option('growth', 'მომხმარებლის მოზიდვა და გაყიდვები', 'Привлечение клиентов и продажи', 'Acquisition and sales'),
    option('chats', 'მომხმარებელთან კომუნიკაცია', 'Общение с клиентами', 'Customer communication'),
    option('operations', 'გუნდის შიდა სამუშაო', 'Внутренняя работа команды', 'Internal team work'),
  ]),
  pain: q('A specific observed failure; broad low activity or desire for AI alone is partial.', 'ბოლოს რა მოხდა ამ პროცესში ისეთი, რისი გამოსწორებაც გსურთ?', 'Что в последний раз произошло в этом процессе, что вы хотите исправить?', 'What happened recently in this process that you want to fix?'),
  process: q('Current workflow steps and people; tools alone are not a workflow.', 'როგორ სრულდება ეს სამუშაო დღეს, დაწყებიდან შედეგამდე?', 'Как эта работа выполняется сейчас — от начала до результата?', 'How is this work done today, from start to result?'),
  channels: q('Actual channels used, not examples mentioned in assistant questions.', 'საიდან მოდის მომხმარებლის ძირითადი მომართვა?', 'Откуда приходят основные обращения клиентов?', 'Where do most customer enquiries come from?'),
  bottleneck: q('Distinguish insufficient reach, few enquiries, purchase conversion, and fulfilment. Low activity alone does not resolve this.', 'სად ფერხდება გაყიდვა ყველაზე მეტად?', 'На каком этапе продажи чаще всего останавливаются?', 'Where do sales most often get stuck?', [
    option('reach', 'ცოტა ადამიანი ხედავს შეთავაზებას', 'Мало людей видят предложение', 'Few people see the offer'),
    option('enquiries', 'ნახვა არის, მომართვა ცოტაა', 'Просмотры есть, обращений мало', 'People see it but rarely enquire'),
    option('conversion', 'მწერენ, მაგრამ იშვიათად ყიდულობენ', 'Пишут, но редко покупают', 'People enquire but rarely buy'),
    option('fulfilment', 'შეკვეთის შესრულება ფერხდება', 'Проблема в выполнении заказа', 'Order fulfilment is the problem'),
  ]),
  conversion: q('Actual enquiry-to-purchase baseline with period or explicitly unknown; a sales growth target is not this fact.', 'ჩვეულებრივ პერიოდში მიღებული მომართვებიდან დაახლოებით რამდენი სრულდება შეძენით?', 'Сколько обращений за обычный период примерно заканчивается покупкой?', 'Roughly how many enquiries become purchases in a typical period?'),
  loss_reason: q('Customer-reported reason for not purchasing, or explicitly unknown. Never infer price, speed or quality.', 'რა მიზეზს ასახელებს მომხმარებელი, როცა შეძენაზე უარს ამბობს?', 'Какую причину называют покупатели, когда отказываются от покупки?', 'What reason do customers give for not buying?'),
  acquisition: q('Current acquisition mechanism.', 'როგორ იზიდავთ ახალ მომხმარებელს ახლა?', 'Как вы сейчас привлекаете новых покупателей?', 'How do you attract new customers today?', [
    option('organic', 'პოსტებითა და რეკომენდაციებით', 'Публикациями и рекомендациями', 'Posts and referrals'),
    option('paid', 'ფასიანი რეკლამით', 'Платной рекламой', 'Paid advertising'),
    option('influencers', 'ინფლუენსერებთან თანამშრომლობით', 'Через блогеров', 'Influencer partnerships'),
    option('mixed', 'რამდენიმე გზით', 'Несколькими способами', 'A mix of channels'),
  ]),
  attribution: q('How an order is linked to a specific influencer or campaign. Excel/admin panel does NOT establish attribution.', 'რით ადგენთ, რომ შეკვეთა კონკრეტული ინფლუენსერისგან მოვიდა?', 'По чему вы определяете, что заказ пришёл от конкретного блогера?', 'How do you identify which influencer an order came from?', [
    option('link', 'ინდივიდუალური ბმულით', 'По индивидуальной ссылке', 'An individual tracking link'),
    option('code', 'პირადი პრომოკოდით', 'По личному промокоду', 'A unique promo code'),
    option('ask', 'მყიდველს ვეკითხებით', 'Спрашиваем покупателя', 'We ask the buyer'),
    option('none', 'წყაროს არ ვაფიქსირებთ', 'Источник не фиксируем', 'We do not record the source'),
  ]),
  reporting_gap: q('Whether source data are absent, lost, fragmented, or present but slow to combine. Difficulty counting sales alone is partial.', 'რომელ ეტაპზე რთულდება ინფლუენსერის შედეგის დათვლა?', 'На каком этапе становится трудно посчитать результат блогера?', 'Where does measuring influencer performance break down?', [
    option('missing', 'შეკვეთას წყარო არ ახლავს', 'У заказа нет источника', 'Orders have no source attached'),
    option('fragmented', 'მონაცემები სხვადასხვა ადგილასაა', 'Данные разбросаны по системам', 'Data are split across systems'),
    option('manual', 'მონაცემები გვაქვს, შეჯამებას დრო სჭირდება', 'Данные есть, долго сводим вручную', 'Data exist but take time to combine'),
    option('criteria', 'არ ვიცით, რას შევადაროთ შედეგი', 'Неясно, с чем сравнивать результат', 'We lack a clear comparison criterion'),
  ]),
  attribution_check: q('Whether source information is actually retained on completed orders, not just links distributed.', 'შეგიძლიათ დასრულებული შეკვეთის ჩანაწერში ინფლუენსერის ბმულის ან კოდის ნახვა?', 'В записи завершённого заказа виден код или источник блогера?', 'Does a completed order retain the influencer code or source?', [
    option('yes', 'კი, შეკვეთაში ჩანს', 'Да, виден в заказе', 'Yes, it is retained'),
    option('partial', 'მხოლოდ ნაწილში ჩანს', 'Только у части заказов', 'Only on some orders'),
    option('no', 'არა, შეკვეთაში არ ჩანს', 'Нет, в заказе не виден', 'No, it is not retained'),
  ]),
  reporting_decision: q('Decision the report will change; a pretty report is not a business consequence.', 'ამ ანალიტიკით რომელი გადაწყვეტილების მიღება გსურთ?', 'Какое решение вы хотите принимать по этой аналитике?', 'What decision should this analysis help you make?', [
    option('budget', 'ბიუჯეტის განაწილება', 'Распределять бюджет', 'Allocate budget'),
    option('partners', 'პარტნიორის შერჩევა ან შეცვლა', 'Выбирать или менять блогеров', 'Choose or replace partners'),
    option('reporting', 'ანგარიშის მომზადების დაჩქარება', 'Ускорить подготовку отчёта', 'Produce reports faster'),
  ]),
  tracking: q('Purchase conversion measurement for paid advertising. Active ads or a budget alone is insufficient.', 'რეკლამის ანგარიშში რეალური შეძენა ჩანს, თუ მხოლოდ ნახვა და დაწკაპება?', 'В рекламном отчёте видны реальные покупки или только просмотры и клики?', 'Do ad reports show actual purchases or only views and clicks?', [
    option('purchases', 'რეალური შეძენა ჩანს', 'Видны покупки', 'Purchases are tracked'),
    option('clicks', 'მხოლოდ ნახვა და დაწკაპება', 'Только просмотры и клики', 'Only views and clicks'),
    option('none', 'შედეგს არ ვზომავთ', 'Результат не измеряем', 'We do not track outcomes'),
  ]),
  ads_work: q('Concrete repetitive ad management task; wanting sales is not proof of repetitive optimization.', 'რეკლამასთან დაკავშირებული რომელი სამუშაო მეორდება და გართმევთ დროს?', 'Какая повторяющаяся работа с рекламой отнимает время?', 'Which repeated advertising task consumes your time?'),
  repetition: q('Whether the target work is genuinely repetitive vs specialist unique work.', 'ამ სამუშაოში უფრო ხშირად ერთნაირი შემთხვევა მეორდება თუ ყოველი შემთხვევა განსხვავებულია?', 'В этой работе чаще повторяются похожие случаи или каждый случай уникален?', 'Does this work mostly repeat similar cases, or is every case different?', [
    option('repeatable', 'უმეტესად მსგავსი შემთხვევაა', 'В основном похожие случаи', 'Mostly similar cases'),
    option('mixed', 'ორივე გვხვდება', 'И то и другое', 'A mixture of both'),
    option('unique', 'უმეტესად განსხვავებულია', 'В основном уникальные случаи', 'Mostly unique cases'),
  ]),
  response: q('Observed response bottleneck, not inferred from channel or volume.', 'მომხმარებლის მომართვაზე პასუხისას რა სირთულე ჩნდება?', 'Что затрудняет ответы на обращения клиентов?', 'What causes difficulty when responding to customers?', [
    option('delays', 'პასუხი გვიანდება', 'Ответ задерживается', 'Replies are delayed'),
    option('missed', 'მომართვა უპასუხოდ რჩება', 'Часть обращений остаётся без ответа', 'Some enquiries go unanswered'),
    option('workload', 'ვპასუხობთ, მაგრამ დიდ დროს ვხარჯავთ', 'Отвечаем, но тратим много времени', 'We reply but spend a lot of time'),
    option('fine', 'ამ მხრივ სირთულე არ გვაქვს', 'С этим проблем нет', 'We have no problem here'),
  ]),
  call_task: q('Actual call task, distinguish repetitive booking from expert consultation.', 'რისთვის არის საჭირო ზარების ძირითადი ნაწილი?', 'Для чего нужна основная часть звонков?', 'What are most calls about?', [
    option('booking', 'ჩაწერა და დადასტურება', 'Запись и подтверждение', 'Booking and confirmation'),
    option('qualification', 'პირველადი კითხვები და კვალიფიკაცია', 'Первичные вопросы и квалификация', 'Initial questions and qualification'),
    option('expert', 'სპეციალისტის კონსულტაცია', 'Консультация специалиста', 'Expert consultation'),
  ]),
  call_permission: q('aiCALL does not route cold lists. Establish the relationship and permission path before any call pilot.', 'ვის ურეკავთ ამ პროცესში და რა კავშირი გაქვთ მათთან?', 'Кому вы звоните в этом процессе и какие у вас с ними отношения?', 'Who would be called in this process, and what relationship do you have with them?', [
    option('existing', 'საკუთარ კლიენტებს არსებული მომსახურების შესახებ', 'Своим клиентам по текущей услуге', 'Our own customers about an existing service'),
    option('consent', 'მათთან გვაქვს დადასტურებული თანხმობის გზა', 'Есть подтверждённый путь согласия', 'We have a confirmed consent path'),
    option('cold', 'ცივ ან შეძენილ სიას', 'По холодной или купленной базе', 'A cold or bought list'),
    option('unclear', 'ჯერ არ ვიცით', 'Пока не знаем', 'We do not know yet'),
  ]),
  content_gap: q('Which content production stage is the bottleneck; low views does not prove production bottleneck.', 'კონტენტის შექმნის რომელ ეტაპზე ფერხდება საქმე?', 'На каком этапе тормозит создание контента?', 'Where does content production get delayed?', [
    option('production', 'ტექსტის ან ვიზუალის შექმნისას', 'При создании текста или визуала', 'Writing or visual production'),
    option('approval', 'შეთანხმებისა და დამტკიცებისას', 'На согласовании', 'Review and approval'),
    option('ideas', 'თემისა და იდეის შერჩევისას', 'При выборе тем и идей', 'Choosing topics and ideas'),
    option('none', 'შექმნა არ ფერხდება', 'Создание не тормозит', 'Production is not delayed'),
  ]),
  docs_task: q('Document task and decision risk.', 'დოკუმენტებზე მუშაობისას რა გართმევთ ყველაზე მეტ დროს?', 'Что отнимает больше всего времени при работе с документами?', 'What takes most time when working with documents?', [
    option('extract', 'მონაცემის ამოღება და გადატანა', 'Извлечение и перенос данных', 'Extracting and transferring data'),
    option('search', 'ინფორმაციის მოძიება', 'Поиск информации', 'Finding information'),
    option('draft', 'მსგავსი დოკუმენტის მომზადება', 'Подготовка похожих документов', 'Drafting similar documents'),
    option('decision', 'პროფესიული გადაწყვეტილების მიღება', 'Профессиональное решение по документу', 'Making a professional decision'),
  ]),
  web_task: q('User task blocked on the site; appearance alone does not establish AI opportunity.', 'რომელ მოქმედებას ვერ ასრულებს მომხმარებელი საიტზე დამოუკიდებლად?', 'Какое действие клиент не может самостоятельно выполнить на сайте?', 'What can a customer not complete independently on your website?'),
  office_task: q('Internal workflow category. A single document workflow may belong to aiDOCS, not a broad office rebuild.', 'რომელი შიდა პროცესი მოითხოვს ყველაზე მეტ ხელით გადატანას ან შეთანხმებას?', 'Какой внутренний процесс требует больше всего ручного переноса или согласования?', 'Which internal process involves the most manual transfer or approvals?', [
    option('orders', 'შეკვეთების ან მარაგის განახლება', 'Обновление заказов или остатков', 'Updating orders or inventory'),
    option('approvals', 'შეთანხმება და დამტკიცება', 'Согласование и утверждение', 'Approvals and sign-off'),
    option('reporting', 'რამდენიმე სისტემიდან ანგარიშის შეჯერება', 'Сведение отчётов из нескольких систем', 'Reconciling reports across systems'),
    option('transfer', 'ერთი სისტემიდან მეორეში გადატანა', 'Перенос данных между системами', 'Transferring data between systems'),
  ]),
  app_task: q('A bespoke build is a new software capability, not a generic wish for AI.', 'რა ახალი მოქმედება ან ინტეგრაცია სჭირდება ბიზნესს, რომელსაც არსებული ხელსაწყო ვერ ასრულებს?', 'Какое новое действие или интеграция нужны бизнесу, которых нет в текущих инструментах?', 'What new action or integration does the business need that current tools cannot provide?', [
    option('customer', 'კლიენტისთვის ახალი ციფრული სერვისი', 'Новый цифровой сервис для клиента', 'A new digital customer service'),
    option('internal', 'განსაკუთრებული შიდა სამუშაო ადგილი', 'Специальный внутренний рабочий процесс', 'A bespoke internal workspace'),
    option('integration', 'სისტემების ახალი ინტეგრაცია', 'Новая интеграция систем', 'A new systems integration'),
  ]),
  rescue_task: q('This routes an existing application to technical assessment. It is not a security certification or a request for credentials.', 'რა ხდება უკვე არსებულ აპლიკაციაში, რის გამოც ტექნიკური შეფასება გჭირდებათ?', 'Что происходит в уже существующем приложении, из-за чего нужна техническая оценка?', 'What is happening in the existing application that requires a technical assessment?', [
    option('breaks', 'ფუნქციები ხშირად ფუჭდება', 'Функции часто ломаются', 'Features keep breaking'),
    option('maintain', 'ვერ ვცვლით ან ვერ ვუვლით', 'Не можем менять или поддерживать', 'We cannot change or maintain it'),
    option('review', 'AI-ით შექმნილი კოდი შეფასებას საჭიროებს', 'Нужна оценка кода, созданного AI', 'AI-built code needs review'),
  ]),
  staff_task: q('aiSTAFF is a live specialist, not an automated chat. Identify the human work that must remain human.', 'რომელ კლიენტურ სამუშაოს სჭირდება ცოცხალი სპეციალისტი და არა ავტომატური პასუხი?', 'Какая клиентская работа требует живого специалиста, а не автоматического ответа?', 'Which customer-facing work needs a live specialist rather than an automated reply?', [
    option('complex', 'რთული ინდივიდუალური მოთხოვნები', 'Сложные индивидуальные запросы', 'Complex individual requests'),
    option('followup', 'მოლაპარაკება და შემდგომი კომუნიკაცია', 'Переговоры и дальнейшая коммуникация', 'Negotiation and follow-up'),
    option('coverage', 'საჭიროა მეტი ცოცხალი მომსახურების მოცვა', 'Нужно больше покрытия живым сервисом', 'More live-service coverage is needed'),
  ]),
  fleet_task: q('Autonomous fleet direction is not a currently deployable Quick Audit recommendation.', 'ეს საკითხი რეალურად ავტონომიურ სატრანსპორტო ფლოტს ეხება?', 'Этот вопрос действительно касается автономного транспортного флота?', 'Is this genuinely about an autonomous transport fleet?', [
    option('yes', 'კი, ფლოტის ავტონომიურ მუშაობას', 'Да, автономной работе флота', 'Yes, autonomous fleet operation'),
    option('no', 'არა, ჩვეულებრივ ლოგისტიკურ პროცესს', 'Нет, обычному логистическому процессу', 'No, a regular logistics process'),
  ]),
  scale: q('Volume AND time period of the target process. Do not infer workload from this alone.', 'დაახლოებით რა მოცულობის სამუშაოა ჩვეულებრივ დღეში ან კვირაში?', 'Какой примерно объём этой работы за обычный день или неделю?', 'Roughly how much of this work occurs in a typical day or week?'),
  impact: q('Observed cost in time/money/errors with context. A growth aspiration is not impact.', 'რა ზიანი მოაქვს ამ სირთულეს — მაგალითად, რამდენ დროს კარგავთ ან რა საქმე რჩება შეუსრულებელი?', 'Чем обходится эта проблема — сколько времени теряется или какая работа остаётся невыполненной?', 'What does this problem cost you in time, errors, or work left undone?'),
  severity: q('Client confirms material recurring consequence, manageable nuisance, or no impact. Never derive from volume.', 'ეს სირთულე რამდენად უშლის ხელს ყოველდღიურ მუშაობას?', 'Насколько эта проблема мешает повседневной работе?', 'How much does this problem interfere with daily work?', [
    option('material', 'რეგულარულად გვაკარგვინებს დროს ან შესაძლებლობას', 'Регулярно теряем время или возможности', 'We regularly lose time or opportunities'),
    option('minor', 'მცირე უხერხულობაა, ვუმკლავდებით', 'Небольшое неудобство, справляемся', 'A minor inconvenience we can manage'),
    option('none', 'შესამჩნევი ზიანი არ გვაქვს', 'Заметного ущерба нет', 'No noticeable impact'),
  ]),
  systems: q('Named systems/data sources used; no invented integration feasibility.', 'რომელ სისტემაში ინახება ამ სამუშაოსთვის საჭირო ინფორმაცია?', 'В какой системе хранится информация для этой работы?', 'Where is the information needed for this work stored?'),
  data: q('Availability of usable source data/materials; software presence does not mean data readiness.', 'ამ პროცესის შესამოწმებლად რეალური მაგალითები და საჭირო მონაცემები ხელმისაწვდომია?', 'Есть ли реальные примеры и исходные данные для проверки этого процесса?', 'Are real examples and source data available to test this process?', [
    option('ready', 'კი, შეგვიძლია მოვამზადოთ', 'Да, можем подготовить', 'Yes, we can prepare them'),
    option('partial', 'მხოლოდ ნაწილი გვაქვს', 'Есть только часть', 'Only partly available'),
    option('absent', 'ჯერ არ გვაქვს', 'Пока нет', 'Not yet available'),
  ]),
  alternative: q('Whether a simpler non-AI process/tool fix was tried and what it changed.', 'ამ პრობლემის მოგვარება უკვე სცადეთ პროცესის შეცვლით ან არსებული ხელსაწყოთი?', 'Пробовали решить проблему изменением процесса или существующим инструментом?', 'Have you tried solving this through a process change or an existing tool?', [
    option('not_tried', 'ჯერ არ გვიცდია', 'Ещё не пробовали', 'Not yet'),
    option('insufficient', 'ვცადეთ, მაგრამ პრობლემა დარჩა', 'Пробовали, проблема осталась', 'We tried, but the problem remains'),
    option('solved', 'ძირითადი პრობლემა უკვე მოგვარდა', 'Основная проблема уже решена', 'The main problem is already solved'),
  ]),
  owner: q('Availability of a responsible pilot owner; title of decision maker alone does not establish availability.', 'ვინ შეძლებს მცირე ტესტის შედეგების შემოწმებას და შეცდომების გასწორებას?', 'Кто сможет проверять результаты небольшого теста и разбирать ошибки?', 'Who could review a small test and handle errors?', [
    option('available', 'პასუხისმგებელი ადამიანი გვყავს', 'Есть ответственный человек', 'We have a responsible person'),
    option('unavailable', 'ამისთვის დრო ან ადამიანი ჯერ არ გვყავს', 'Пока нет человека или времени', 'No person or time available yet'),
  ]),
  constraints: q('Consequences of an error and human approval, tied to the actual process.', 'ამ პროცესში შეცდომის შემთხვევაში რა უნდა დარჩეს აუცილებლად ადამიანის კონტროლქვეშ?', 'Что в этом процессе обязательно должно оставаться под контролем человека при риске ошибки?', 'What must stay under human control if an error occurs?', [
    option('review', 'შედეგს ადამიანი დაამტკიცებს', 'Результат утверждает человек', 'A person approves the result'),
    option('low_risk', 'მარტივი მოქმედებაა და შეცდომის გასწორება შეგვიძლია', 'Действие простое, ошибку можно исправить', 'Simple actions with reversible errors'),
    option('high_risk', 'შეცდომას სერიოზული შედეგი შეიძლება მოჰყვეს', 'Ошибка может иметь серьёзные последствия', 'Errors could have serious consequences'),
  ]),
  baseline: q('Current measured result and period for the target process, or explicitly no measurement. Desired doubled sales is not baseline.', 'რომელი მიმდინარე მაჩვენებელი გაქვთ, რომელსაც ტესტის შედეგს შევადარებთ?', 'Какой текущий показатель есть, чтобы сравнить с результатом теста?', 'What current measure could we compare against a test result?'),
  priority_check: q('Confirm whether this is the main bottleneck or another process is more urgent. Do not auto switch focus unless explicit.', 'ამ პრობლემის მოგვარება ახლა მთავარი პრიორიტეტია, თუ სხვა პროცესი უფრო მეტად გაბრკოლებთ?', 'Решить эту проблему сейчас важнее всего или другой процесс мешает сильнее?', 'Is this the main priority, or is another process causing more difficulty?', [
    option('primary', 'ეს არის მთავარი პრიორიტეტი', 'Это главный приоритет', 'This is the main priority'),
    option('another', 'სხვა პროცესი უფრო მნიშვნელოვანია', 'Другой процесс важнее', 'Another process matters more'),
  ]),
} satisfies Record<string, Question>;
export type Field = keyof typeof BANK;
export const FIELDS = Object.keys(BANK) as Field[];
export const BRANCH_FIELDS: Record<Focus, Field[]> = {
  discovery: ['business', 'objective', 'area', 'pain', 'process'],
  growth: ['bottleneck', 'conversion', 'loss_reason', 'acquisition'],
  attribution: ['attribution', 'reporting_gap', 'attribution_check', 'reporting_decision'],
  chats: ['response', 'repetition'],
  calls: ['call_task', 'call_permission', 'response', 'repetition'],
  ads: ['acquisition', 'tracking', 'ads_work', 'repetition'],
  content: ['content_gap', 'repetition'],
  docs: ['docs_task', 'repetition'],
  web: ['web_task', 'repetition'],
  office: ['office_task', 'repetition'],
  app: ['app_task'],
  rescue: ['rescue_task'],
  staff: ['staff_task'],
  fleet: ['fleet_task'],
  operations: ['process', 'repetition'],
};
