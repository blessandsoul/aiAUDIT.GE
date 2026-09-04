export const INTAKE_FACT_IDS = [
  'business_context',
  'objective',
  'current_process',
  'pain_impact',
  'audience_channels',
  'scale_frequency',
  'resources_systems',
  'constraints_handoff',
  'timeline_owner',
  'success_criteria',
] as const;

export type IntakeFactId = (typeof INTAKE_FACT_IDS)[number];
export type IntakeFactStatus = 'missing' | 'partial' | 'answered' | 'declined' | 'not_applicable' | 'needs_follow_up';
export type IntakeLanguage = 'ka' | 'ru' | 'en';

export interface IntakeFactState {
  status: IntakeFactStatus;
  summary: string;
  evidence: string;
  askedCount: number;
  updatedTurn: number;
}

export interface IntakeState {
  version: 1;
  turn: number;
  complete: boolean;
  facts: Record<IntakeFactId, IntakeFactState>;
}

export interface IntakeFactUpdate {
  field: IntakeFactId;
  status: Exclude<IntakeFactStatus, 'missing' | 'needs_follow_up'>;
  summary: string;
  evidence: string;
}

export const INTAKE_FACT_DEFINITIONS: ReadonlyArray<{
  id: IntakeFactId;
  group: 'direction' | 'workflow' | 'reach' | 'delivery' | 'decision';
  meaning: string;
  sufficientWhen: string;
}> = [
  { id: 'business_context', group: 'direction', meaning: 'what the business offers and the concrete situation behind this request', sufficientWhen: 'the business or process type is identifiable; a clear type such as restaurant, clinic, shop, or internal finance process is enough' },
  { id: 'objective', group: 'direction', meaning: 'the outcome the client wants, in business terms', sufficientWhen: 'the desired change or outcome is explicit, even without a numeric target' },
  { id: 'current_process', group: 'workflow', meaning: 'how the work is handled today, including people and steps', sufficientWhen: 'the main current method and responsible person or system are known' },
  { id: 'pain_impact', group: 'workflow', meaning: 'what fails today and what it costs in time, money, quality, or lost opportunities', sufficientWhen: 'at least one concrete failure and its practical consequence are known' },
  { id: 'audience_channels', group: 'reach', meaning: 'who is involved and where the process or customer interaction happens', sufficientWhen: 'the primary people and interaction channel or location are identifiable' },
  { id: 'scale_frequency', group: 'reach', meaning: 'volume, frequency, locations, users, or workload size, using an estimate when exact data is unavailable', sufficientWhen: 'at least one useful estimate of volume, frequency, locations, users, or workload is known' },
  { id: 'resources_systems', group: 'delivery', meaning: 'existing tools, data, content, assets, or systems only when relevant to the actual task', sufficientWhen: 'one relevant existing resource or system is known, or the client explicitly says none exists' },
  { id: 'constraints_handoff', group: 'delivery', meaning: 'limits, risks, exceptions, approvals, privacy needs, and where a human must remain involved', sufficientWhen: 'one meaningful constraint, exception, or human decision rule is known, or the client explicitly reports none' },
  { id: 'timeline_owner', group: 'decision', meaning: 'urgency, desired timing, and who owns or approves the decision', sufficientWhen: 'both timing and decision ownership are known, including explicit uncertainty about either one' },
  { id: 'success_criteria', group: 'decision', meaning: 'how the client will know the solution is useful or successful', sufficientWhen: 'at least one observable success signal is known; an estimate is enough' },
];

const MAX_TURNS = 12;
const CORE_FACT_IDS: ReadonlyArray<IntakeFactId> = [
  'business_context',
  'objective',
  'current_process',
  'pain_impact',
  'audience_channels',
  'scale_frequency',
];
const VALID_STATUSES = new Set<IntakeFactStatus>(['missing', 'partial', 'answered', 'declined', 'not_applicable', 'needs_follow_up']);
const FACT_ID_SET = new Set<string>(INTAKE_FACT_IDS);

function cleanText(value: unknown, maxLength = 360): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function emptyFact(): IntakeFactState {
  return { status: 'missing', summary: '', evidence: '', askedCount: 0, updatedTurn: 0 };
}

export function createIntakeState(): IntakeState {
  return {
    version: 1,
    turn: 0,
    complete: false,
    facts: Object.fromEntries(INTAKE_FACT_IDS.map((id) => [id, emptyFact()])) as Record<IntakeFactId, IntakeFactState>,
  };
}

export function parseIntakeState(value: unknown): IntakeState {
  if (!value || typeof value !== 'object') return createIntakeState();
  const candidate = value as { version?: unknown; turn?: unknown; complete?: unknown; facts?: unknown };
  if (candidate.version !== 1 || !candidate.facts || typeof candidate.facts !== 'object') return createIntakeState();

  const facts = createIntakeState().facts;
  const rawFacts = candidate.facts as Record<string, unknown>;
  for (const id of INTAKE_FACT_IDS) {
    const raw = rawFacts[id];
    if (!raw || typeof raw !== 'object') continue;
    const fact = raw as Record<string, unknown>;
    const status = typeof fact.status === 'string' && VALID_STATUSES.has(fact.status as IntakeFactStatus)
      ? fact.status as IntakeFactStatus
      : 'missing';
    facts[id] = {
      status,
      summary: cleanText(fact.summary),
      evidence: cleanText(fact.evidence, 500),
      askedCount: typeof fact.askedCount === 'number' ? Math.max(0, Math.min(2, Math.floor(fact.askedCount))) : 0,
      updatedTurn: typeof fact.updatedTurn === 'number' ? Math.max(0, Math.min(MAX_TURNS, Math.floor(fact.updatedTurn))) : 0,
    };
  }

  return {
    version: 1,
    turn: typeof candidate.turn === 'number' ? Math.max(0, Math.min(MAX_TURNS, Math.floor(candidate.turn))) : 0,
    complete: candidate.complete === true,
    facts,
  };
}

function isFactUpdate(value: unknown): value is IntakeFactUpdate {
  if (!value || typeof value !== 'object') return false;
  const update = value as { field?: unknown; status?: unknown; summary?: unknown; evidence?: unknown };
  return typeof update.field === 'string'
    && FACT_ID_SET.has(update.field)
    && (update.status === 'partial' || update.status === 'answered' || update.status === 'declined' || update.status === 'not_applicable')
    && typeof update.summary === 'string'
    && update.summary.trim().length > 0
    && typeof update.evidence === 'string'
    && update.evidence.trim().length > 0;
}

function hasVerbatimEvidence(message: string, evidence: string): boolean {
  const normalise = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const normalisedEvidence = normalise(evidence);
  return normalisedEvidence.length >= 2 && normalise(message).includes(normalisedEvidence);
}

function requiresImpactClarification(field: IntakeFactId, evidence: string): boolean {
  if (field !== 'pain_impact') return false;
  const normalized = evidence.toLocaleLowerCase();
  const hasConcreteSignal = /\d|lost|loss|delay|wait|unanswered|refund|error|declin|no sale|შემცირ|დაკარგ|დაყოვნ|უპასუხ|გაყიდვ|შეკვეთ|ლიდ/.test(normalized);
  const isGenericLabel = /low activity|low engagement|problem is|პრობლემა|დაბალი აქტივ|აქტივობა დაბალი/.test(normalized);
  return isGenericLabel && !hasConcreteSignal;
}

function isResolved(status: IntakeFactStatus): boolean {
  return status === 'answered' || status === 'declined' || status === 'not_applicable';
}

function canComplete(state: IntakeState): boolean {
  if (!CORE_FACT_IDS.every((id) => state.facts[id].status === 'answered')) return false;

  const hasImplementationContext = isResolved(state.facts.resources_systems.status)
    || isResolved(state.facts.constraints_handoff.status);
  return hasImplementationContext && isResolved(state.facts.success_criteria.status);
}

function closeRepeatedOrExpiredGaps(state: IntakeState): void {
  for (const id of INTAKE_FACT_IDS) {
    const fact = state.facts[id];
    if ((fact.status === 'missing' || fact.status === 'partial') && fact.askedCount >= 2) {
      fact.status = 'needs_follow_up';
      fact.summary = 'Requires human follow-up';
      fact.updatedTurn = state.turn;
    }
  }
}

function isSocialCommerceContext(state: IntakeState): boolean {
  const text = Object.values(state.facts)
    .map((fact) => `${fact.summary} ${fact.evidence}`)
    .join(' ')
    .toLocaleLowerCase();
  const isCommerce = /online shop|e-?commerce|store|მაღაზ/.test(text);
  const hasSocialChannels = /instagram|facebook|ფეისბუქ|ინსტაგრამ/.test(text);
  const wantsGrowth = /increase sales|grow sales|გაყიდვ.*გაზრდ|გაზრდ.*გაყიდვ/.test(text);
  return isCommerce && hasSocialChannels && wantsGrowth;
}

function chooseTargets(state: IntakeState, requested: unknown): IntakeFactId[] {
  const missing = INTAKE_FACT_IDS.filter((id) => state.facts[id].status === 'missing' || state.facts[id].status === 'partial');
  if (isSocialCommerceContext(state)) {
    const funnelPriority: IntakeFactId[] = ['pain_impact', 'resources_systems', 'success_criteria', 'constraints_handoff'];
    const nextFunnelTarget = funnelPriority.find((id) => missing.includes(id));
    if (nextFunnelTarget) return [nextFunnelTarget];
  }
  const requestedIds = Array.isArray(requested)
    ? requested.filter((id): id is IntakeFactId => typeof id === 'string'
      && FACT_ID_SET.has(id)
      && (state.facts[id as IntakeFactId].status === 'missing' || state.facts[id as IntakeFactId].status === 'partial'))
    : [];
  const uniqueRequested = [...new Set(requestedIds)].slice(0, 1);
  if (uniqueRequested.length > 0) return uniqueRequested;

  const first = missing[0];
  if (!first) return [];
  const group = INTAKE_FACT_DEFINITIONS.find((definition) => definition.id === first)?.group;
  const related = missing.filter((id) => INTAKE_FACT_DEFINITIONS.find((definition) => definition.id === id)?.group === group);
  return [...related, ...missing.filter((id) => !related.includes(id))].slice(0, 1);
}

export function advanceIntakeState(
  previousValue: unknown,
  updatesValue: unknown,
  requestedTargets: unknown,
  latestUserMessage: string,
): { state: IntakeState; targets: IntakeFactId[] } {
  const state = parseIntakeState(previousValue);
  state.turn = Math.min(MAX_TURNS, state.turn + 1);
  state.complete = false;

  const updates = Array.isArray(updatesValue)
    ? updatesValue.filter((update): update is IntakeFactUpdate => isFactUpdate(update) && hasVerbatimEvidence(latestUserMessage, update.evidence))
    : [];
  for (const update of updates) {
    const current = state.facts[update.field];
    state.facts[update.field] = {
      ...current,
      status: requiresImpactClarification(update.field, update.evidence) ? 'partial' : update.status,
      summary: cleanText(update.summary),
      evidence: cleanText(update.evidence, 500),
      updatedTurn: state.turn,
    };
  }

  closeRepeatedOrExpiredGaps(state);
  const targets = chooseTargets(state, requestedTargets);
  for (const id of targets) state.facts[id].askedCount = Math.min(2, state.facts[id].askedCount + 1);
  state.complete = canComplete(state);
  return { state, targets };
}

export function intakeProgress(state: IntakeState): { closed: number; total: number; complete: boolean } {
  return {
    closed: INTAKE_FACT_IDS.filter((id) => isResolved(state.facts[id].status)).length,
    total: INTAKE_FACT_IDS.length,
    complete: state.complete,
  };
}

export function isIntakeComplete(value: unknown): boolean {
  return canComplete(parseIntakeState(value));
}

export function publicFactSummary(state: IntakeState): string[] {
  return INTAKE_FACT_IDS
    .map((id) => state.facts[id])
    .filter((fact) => (fact.status === 'answered' || fact.status === 'partial') && fact.summary)
    .sort((a, b) => b.updatedTurn - a.updatedTurn)
    .slice(0, 4)
    .map((fact) => fact.summary);
}

const LABELS: Record<IntakeLanguage, Record<IntakeFactId, string>> = {
  ru: { business_context: 'Контекст бизнеса', objective: 'Цель', current_process: 'Текущий процесс', pain_impact: 'Проблема и влияние', audience_channels: 'Люди и точки контакта', scale_frequency: 'Масштаб', resources_systems: 'Имеющиеся ресурсы и системы', constraints_handoff: 'Ограничения и роль человека', timeline_owner: 'Срок и ответственный', success_criteria: 'Критерий успеха' },
  ka: { business_context: 'ბიზნესის კონტექსტი', objective: 'მიზანი', current_process: 'მიმდინარე პროცესი', pain_impact: 'პრობლემა და გავლენა', audience_channels: 'ადამიანები და შეხების წერტილები', scale_frequency: 'მასშტაბი', resources_systems: 'არსებული რესურსები და სისტემები', constraints_handoff: 'შეზღუდვები და ადამიანის როლი', timeline_owner: 'ვადა და პასუხისმგებელი', success_criteria: 'წარმატების კრიტერიუმი' },
  en: { business_context: 'Business context', objective: 'Objective', current_process: 'Current process', pain_impact: 'Problem and impact', audience_channels: 'People and touchpoints', scale_frequency: 'Scale', resources_systems: 'Existing resources and systems', constraints_handoff: 'Constraints and human role', timeline_owner: 'Timing and owner', success_criteria: 'Success criterion' },
};

export function buildFinalBrief(state: IntakeState, language: IntakeLanguage): string {
  const known = INTAKE_FACT_IDS
    .filter((id) => state.facts[id].status === 'answered')
    .map((id) => `• ${LABELS[language][id]}: ${state.facts[id].summary}`);
  const unresolved = INTAKE_FACT_IDS.filter((id) => state.facts[id].status === 'needs_follow_up');
  const intro = language === 'ru'
    ? 'По собранным фактам вот что мы поняли о задаче:'
    : language === 'ka'
      ? 'შეკრებილი ფაქტების მიხედვით, აი რა გავიგეთ ამოცანის შესახებ:'
      : 'Based on the facts collected, here is what we understand about the task:';
  const followUp = unresolved.length === 0 ? '' : language === 'ru'
    ? `\n\nНужно проверить отдельно: ${unresolved.map((id) => LABELS.ru[id]).join(', ')}.`
    : language === 'ka'
      ? `\n\nცალკე გადასამოწმებელია: ${unresolved.map((id) => LABELS.ka[id]).join(', ')}.`
      : `\n\nNeeds separate verification: ${unresolved.map((id) => LABELS.en[id]).join(', ')}.`;
  const closing = language === 'ru'
    ? '\n\nЭто первичная диагностическая картина, а не обещание результата. Если я исказил какой-то факт, поправьте только его.'
    : language === 'ka'
      ? '\n\nეს არის პირველადი დიაგნოსტიკური სურათი და არა შედეგის დაპირება. თუ რომელიმე ფაქტი არასწორად გავიგე, მხოლოდ ის შემისწორეთ.'
      : '\n\nThis is an initial diagnostic picture, not a promise of results. If I misread a fact, correct only that point.';
  return `${intro}\n\n${known.join('\n')}${followUp}${closing}`;
}

const QUESTIONS: Record<IntakeLanguage, Record<IntakeFactId, string>> = {
  ru: { business_context: 'Что это за бизнес или процесс и что именно вы предлагаете клиентам?', objective: 'Какого результата вы хотите добиться?', current_process: 'Как это работает сейчас, по каким шагам и что приходится делать вручную?', pain_impact: 'Где сейчас возникает главная проблема и к чему она приводит?', audience_channels: 'Кто участвует в процессе и где происходит основное взаимодействие?', scale_frequency: 'Каков примерный объём или частота, даже если точных цифр пока нет?', resources_systems: 'Какие материалы, данные или системы уже есть именно для этой задачи?', constraints_handoff: 'Какие есть ограничения и в каких случаях решение обязательно должен принимать человек?', timeline_owner: 'Когда это нужно и кто принимает окончательное решение?', success_criteria: 'По какому результату вы поймёте, что решение действительно работает?' },
  ka: { business_context: 'რა ბიზნესზე ან პროცესზეა საუბარი და რას სთავაზობთ მომხმარებლებს?', objective: 'რა შედეგის მიღება გსურთ?', current_process: 'როგორ მუშაობს ეს პროცესი ახლა, რა ნაბიჯებია და რას აკეთებთ ხელით?', pain_impact: 'სად ჩნდება მთავარი პრობლემა და რა შედეგს იწვევს?', audience_channels: 'ვინ მონაწილეობს პროცესში და სად ხდება ძირითადი კომუნიკაცია?', scale_frequency: 'დაახლოებით რა მოცულობა ან სიხშირეა, თუნდაც ზუსტი რიცხვი ჯერ არ გქონდეთ?', resources_systems: 'რა მასალები, მონაცემები ან სისტემები გაქვთ უკვე ამ ამოცანისთვის?', constraints_handoff: 'რა შეზღუდვებია და რომელ შემთხვევაში უნდა მიიღოს გადაწყვეტილება ადამიანმა?', timeline_owner: 'როდის გჭირდებათ შედეგი და ვინ იღებს საბოლოო გადაწყვეტილებას?', success_criteria: 'რა შედეგით მიხვდებით, რომ გადაწყვეტა ნამდვილად მუშაობს?' },
  en: { business_context: 'What business or process is this, and what do you offer customers?', objective: 'What outcome do you want to achieve?', current_process: 'How does this work today, step by step, and what is still handled manually?', pain_impact: 'Where does the main problem occur and what does it cause?', audience_channels: 'Who is involved and where does the main interaction happen?', scale_frequency: 'What is the approximate volume or frequency, even if exact numbers are unavailable?', resources_systems: 'What materials, data, or systems already exist specifically for this task?', constraints_handoff: 'What constraints apply, and when must a human make the decision?', timeline_owner: 'When is this needed and who owns the final decision?', success_criteria: 'What result would prove that the solution is actually working?' },
};

function socialCommerceFallbackQuestion(state: IntakeState, target: IntakeFactId, language: IntakeLanguage): string | null {
  if (!isSocialCommerceContext(state)) return null;
  if (target === 'pain_impact') {
    return language === 'ka'
      ? 'თქვენ თქვით, რომ შეტყობინებებს თავად პასუხობთ. „დაბალი აქტივობა“ უფრო რას ნიშნავს: ცოტა ნახვა და ჩართულობა, ცოტა შეტყობინება, თუ შეტყობინებებიდან ცოტა შეძენა?'
      : language === 'ru'
        ? 'Вы сказали, что отвечаете на сообщения сами. «Низкая активность» для вас — это мало просмотров и реакций, мало сообщений или мало покупок из сообщений?'
        : 'You said you answer messages yourself. Does “low activity” mean low reach and engagement, few messages, or few purchases from those messages?';
  }
  if (target === 'resources_systems') {
    return language === 'ka'
      ? 'ამ ეტაპზე Facebook/Instagram-ზე ფასიან რეკლამას იყენებთ, თუ აქტივობა მხოლოდ ორგანულად მოდის?'
      : language === 'ru'
        ? 'Вы используете платную рекламу в Facebook/Instagram или активность сейчас только органическая?'
        : 'Are you currently using paid Facebook/Instagram ads, or is activity entirely organic?';
  }
  if (target === 'success_criteria') {
    return language === 'ka'
      ? 'დღეს ითვლით, ამ მომართვებიდან დაახლოებით რამდენი სრულდება შეკვეთით, თუ ეს ჯერ არ იზომება?'
      : language === 'ru'
        ? 'Вы сейчас считаете, сколько из этих 5–10 обращений примерно заканчивается заказом, или пока это не измеряется?'
        : 'Do you currently track how many of those 5–10 enquiries become orders, or is that not measured yet?';
  }
  return null;
}

export function buildFallbackQuestion(targets: IntakeFactId[], language: IntakeLanguage, state?: IntakeState): string {
  const contextualQuestion = state && targets.length === 1
    ? socialCommerceFallbackQuestion(state, targets[0], language)
    : null;
  if (contextualQuestion) return contextualQuestion;
  const questions = targets.map((id) => QUESTIONS[language][id]);
  return questions.join(' ');
}

export function hasEmptyAcknowledgementPrefix(reply: string): boolean {
  return /^(?:გასაგებია|კარგი,? გასაგებია|ძალიან კარგი|გმადლობთ|მადლობა|понятно|(?:я\s+)?понял[а]?|понимаю|отличн[а-яё]*|i understand|great)(?:[\s:,.!?]|$)/iu.test(reply.trim());
}

const ANSWERS: Record<IntakeLanguage, Record<IntakeFactId, [string, string, string]>> = {
  ru: { business_context: ['Мы оказываем услуги частным клиентам', 'Мы продаём товары компаниям', 'Это внутренний процесс команды'], objective: ['Хотим сократить ручную работу', 'Хотим увеличить продажи', 'Хотим повысить скорость и качество'], current_process: ['Сейчас всё делаем вручную', 'Процесс частично автоматизирован', 'Процесс зависит от нескольких сотрудников'], pain_impact: ['Теряем время и обращения', 'Ошибки влияют на качество', 'Пока точный ущерб не измеряли'], audience_channels: ['Основные участники - клиенты и администраторы', 'Процесс идёт через онлайн-каналы', 'Это внутреннее взаимодействие команды'], scale_frequency: ['Это происходит ежедневно', 'Объём меняется, точных цифр нет', 'Могу привести пример за обычную неделю'], resources_systems: ['Уже есть материалы и рабочие данные', 'Используем несколько отдельных систем', 'Готовой базы пока нет'], constraints_handoff: ['Сложные случаи должен решать человек', 'Есть обязательное согласование владельца', 'Особых ограничений пока не определили'], timeline_owner: ['Нужно в ближайший месяц, решает владелец', 'Жёсткого срока нет, отвечает руководитель', 'Срок и ответственного ещё надо определить'], success_criteria: ['Успех - меньше ручной работы', 'Успех - больше завершённых обращений', 'Сначала нужно измерить текущий результат'] },
  ka: { business_context: ['მომსახურებას კერძო მომხმარებლებს ვთავაზობთ', 'პროდუქტებს კომპანიებს ვთავაზობთ', 'ეს გუნდის შიდა პროცესია'], objective: ['ხელით სამუშაოს შემცირება გვინდა', 'გაყიდვების ზრდა გვინდა', 'სისწრაფისა და ხარისხის გაუმჯობესება გვინდა'], current_process: ['ახლა ყველაფერს ხელით ვაკეთებთ', 'პროცესი ნაწილობრივ ავტომატიზებულია', 'პროცესი რამდენიმე თანამშრომელზეა დამოკიდებული'], pain_impact: ['ვკარგავთ დროსა და მოთხოვნებს', 'შეცდომები ხარისხზე მოქმედებს', 'ზუსტი ზიანი ჯერ არ გაგვიზომავს'], audience_channels: ['მთავარი მონაწილეები კლიენტები და ადმინისტრატორები არიან', 'პროცესი ონლაინ არხებში მიმდინარეობს', 'ეს გუნდის შიდა ურთიერთქმედებაა'], scale_frequency: ['ეს ყოველდღიურად ხდება', 'მოცულობა იცვლება და ზუსტი რიცხვი არ გვაქვს', 'ჩვეულებრივი კვირის მაგალითს მოვიყვან'], resources_systems: ['უკვე გვაქვს მასალები და სამუშაო მონაცემები', 'რამდენიმე ცალკე სისტემას ვიყენებთ', 'მზა ბაზა ჯერ არ გვაქვს'], constraints_handoff: ['რთული შემთხვევა ადამიანმა უნდა გადაწყვიტოს', 'მფლობელის თანხმობა სავალდებულოა', 'განსაკუთრებული შეზღუდვა ჯერ არ გვაქვს'], timeline_owner: ['ერთ თვეში გვჭირდება და მფლობელი წყვეტს', 'მკაცრი ვადა არ გვაქვს და პასუხისმგებელი ხელმძღვანელია', 'ვადა და პასუხისმგებელი ჯერ დასადგენია'], success_criteria: ['წარმატება ხელით სამუშაოს შემცირებაა', 'წარმატება მეტი დასრულებული მოთხოვნაა', 'ჯერ მიმდინარე შედეგი უნდა გავზომოთ'] },
  en: { business_context: ['We provide services to individual customers', 'We sell products to businesses', 'This is an internal team process'], objective: ['We want to reduce manual work', 'We want to increase sales', 'We want better speed and quality'], current_process: ['Everything is manual today', 'The process is partly automated', 'The process depends on several employees'], pain_impact: ['We lose time and enquiries', 'Errors affect quality', 'We have not measured the exact impact'], audience_channels: ['Customers and administrators are the main participants', 'The process happens through online channels', 'This is internal team collaboration'], scale_frequency: ['This happens every day', 'Volume varies and we do not have exact figures', 'I can give an example from a normal week'], resources_systems: ['We already have working materials and data', 'We use several separate systems', 'There is no prepared knowledge base yet'], constraints_handoff: ['A human must handle complex cases', 'Owner approval is mandatory', 'No special constraints have been defined'], timeline_owner: ['We need it within a month and the owner decides', 'There is no hard deadline and the manager owns it', 'Timing and ownership are not decided'], success_criteria: ['Success means less manual work', 'Success means more completed enquiries', 'We first need to measure the current result'] },
};

export function fallbackSuggestions(language: IntakeLanguage, targets: IntakeFactId[], state?: IntakeState): string[] {
  if (targets.length === 0) return [];
  if (state && isSocialCommerceContext(state) && targets.length === 1 && targets[0] === 'pain_impact') {
    return language === 'ka'
      ? ['ნახვა და ჩართულობა დაბალია', 'შეტყობინებები ცოტაა', 'შეტყობინებებიდან შეკვეთამდე ცოტა მიდის']
      : language === 'ru'
        ? ['Мало просмотров и реакций', 'Мало входящих сообщений', 'Из сообщений редко получается заказ']
        : ['Reach and engagement are low', 'There are few incoming messages', 'Few messages become orders'];
  }
  return [0, 1, 2].map((index) => targets.map((id) => ANSWERS[language][id][index]).join('; '));
}
